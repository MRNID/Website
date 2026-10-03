# PACKING VIDEO PROOF - DEPLOYMENT & DISASTER RECOVERY SPECIFICATION

> **Document Version:** 2.2.0 (Post Codex R1 Review - Findings D01-06, D01-09, D01-10 Addressed)  
> **Target Environment:** On-Premises Warehouse LAN (Windows 10/11 Station PCs + Linux/Windows Main Server)

---

## 1. Network Topology (LAN First)

```text
[ Warehouse LAN Subnet: 192.168.1.0/24 ]
├── 192.168.1.10: Main Server Node (PostgreSQL 16, Backend Fastify API, Nginx Static Host)
├── 192.168.1.15: NAS / File Server (SMB Windows Share: \\SERVER\PackingVideo)
├── 192.168.1.51..70: Station Packing PCs (Windows 11 + USB Barcode Gun + Video Worker Agent)
└── 192.168.1.101..120: RTSP IP Cameras (PoE Industrial Switch, isolated CCTV VLAN)
```

### Communication Channels (D01-06)
- **Web Browsers (Admin Web & User Web) $\rightarrow$ Main Server:** HTTPS (`port 443`) and WebSocket (`wss://192.168.1.10/ws/station`).
- **Station Video Worker $\rightarrow$ Main Server:** Outbound WebSocket Client (`wss://192.168.1.10:4000/ws/worker`) with `X-Worker-Token`.
- **Station Video Worker $\rightarrow$ NAS:** Windows SMB Share protocol over port 445 (`\\SERVER\PackingVideo`).
- **Station Video Worker $\rightarrow$ Camera:** RTSP TCP over port 554 (`rtsp://192.168.1.101:554/...`) or local DirectShow USB.
- **Video Playback Flow:**
  - *Synced Video:* Browser $\rightarrow$ Main Server API (HTTP 206) $\rightarrow$ Read from NAS SMB Share.
  - *Local Video (Pending NAS sync):* Browser $\rightarrow$ Main Server API $\rightarrow$ Tunnel request through Worker WSS data channel / cached preview. No station inbound HTTP ports required.

---

## 2. Hardened Windows Station Preparation (D01-09)

### 2.1. Disk Volumes & Hardened NTFS ACLs
```powershell
# Create storage directories
New-Item -ItemType Directory -Force -Path "D:\PackingVideoTemp"
New-Item -ItemType Directory -Force -Path "D:\PackingVideo"

# Disable inheritance and remove standard User modify/delete permissions
icacls "D:\PackingVideoTemp" /inheritance:r
icacls "D:\PackingVideoTemp" /grant:r "SYSTEM:(OI)(CI)F"
icacls "D:\PackingVideoTemp" /grant:r "Administrators:(OI)(CI)F"
icacls "D:\PackingVideoTemp" /grant:r "NT SERVICE\PackingVideoWorker:(OI)(CI)F"

icacls "D:\PackingVideo" /inheritance:r
icacls "D:\PackingVideo" /grant:r "SYSTEM:(OI)(CI)F"
icacls "D:\PackingVideo" /grant:r "Administrators:(OI)(CI)F"
icacls "D:\PackingVideo" /grant:r "NT SERVICE\PackingVideoWorker:(OI)(CI)M"
icacls "D:\PackingVideo" /grant:r "Users:(OI)(CI)RX"   # Read-Only for packing operators
```

### 2.2. Video Worker as a Managed Windows Service (NSSM)
```powershell
# Install Video Worker Service using correct NSSM parameters
nssm install PackingVideoWorker "C:\Program Files\nodejs\node.exe"
nssm set PackingVideoWorker AppDirectory "E:\Website\apps\video-worker"
nssm set PackingVideoWorker AppParameters "dist/index.js --config=C:\PackingProof\worker.config.json"
nssm set PackingVideoWorker AppEnvironmentExtra "BACKEND_WS_URL=wss://192.168.1.10:4000/ws/worker`nWORKER_TOKEN=st_secret_token_pack01"
nssm set PackingVideoWorker ObjectName "NT SERVICE\PackingVideoWorker"
nssm set PackingVideoWorker Start SERVICE_AUTO_START
nssm set PackingVideoWorker AppThrottle 5000
nssm start PackingVideoWorker
```

---

## 3. Disaster Recovery & Reconciliation Design Targets (D01-10)

### 3.1. Design Targets (To be Empirically Benchmark in Phase 14)
- **Recovery Point Objective (RPO) Target:** $\le 1\text{ hour}$ for PostgreSQL transactions. $0\text{ video loss}$ for locally finalized videos on SSD.
- **Recovery Time Objective (RTO) Target:** $\le 30\text{ minutes}$ for complete server node restoration.

### 3.2. Storage Reconciliation Protocol (Orphan & Missing Files)
In the event of a database restoration from backup:
1. Videos finalized on NAS/SSD *after* the backup point are preserved on disk.
2. The Worker writes a JSON sidecar file `{filename}.proof.json` alongside every finalized video on disk containing:
   ```json
   {
     "sessionId": "43924f0c-...",
     "trackingCode": "SPXVN0458892182B",
     "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
     "duration": 42.5,
     "fileSize": 10485760,
     "finalizedAt": "2026-10-03T10:00:54Z"
   }
   ```
3. A post-restore reconciliation script inspects physical disks:
   - For every video file with a sidecar not present in the restored database, it reconstructs the metadata record, marks it `RESTORED_FROM_SIDECAR`, and verifies the SHA-256 hash.
   - For every database record where the physical video is missing, it marks `PHYSICAL_FILE_MISSING` for audit investigation.
