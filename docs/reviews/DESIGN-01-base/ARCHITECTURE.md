# PACKING VIDEO PROOF - SYSTEM ARCHITECTURE

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
> **Status:** Phase 1 Design Specification  
> **Target Audience:** Engineering Team, System Architects, DevOps, QA

---

## 1. Executive Summary & Core Philosophy

**PACKING VIDEO PROOF** is a specialized, high-reliability video recording and audit trail system for fulfillment warehouses, e-commerce operations (Shopee, TikTok Shop, Lazada), and 3PL fulfillment hubs.

### Core Tenets
1. **Zero Cloud Dependency (LAN-First):** The warehouse must operate seamlessly during internet outages. Local recording, database transactions, and proof verification function entirely within the local area network.
2. **Fail-Safe Video Pipeline:** Video is **never** written directly across network shares (SMB/NAS) during recording. Network latency or transient SMB disconnects must never corrupt an active packing recording.
   $$\text{Camera} \xrightarrow{\text{RTSP/USB}} \text{FFmpeg} \xrightarrow{\text{RAM/NVMe}} \text{Local Temp} \xrightarrow{\text{Finalize + SHA256}} \text{Local Storage} \xrightarrow{\text{Async Queue}} \text{NAS / Share}$$
3. **Data Immutability & Forensic Integrity:** The primary video file is immutable. The exact cryptographic hash (SHA-256) is recorded immediately upon stream finalization. Any subsequent watermarking or trimming creates a derivative artifact; the original raw proof is never altered.
4. **Physical Warehouse Ergonomics:** The packing UI is purpose-built for warehouse packing stations (1366x768 resolution minimum, high-contrast, visible from 1.5–2 meters, zero mouse requirement, 100% USB barcode scanner driven).
5. **Separation of Concerns:** Strict isolation between Admin management, Packing execution, Backend orchestration, and Media processing.

---

## 2. High-Level System Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                      PACKING VIDEO PROOF LAN                                       |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                           +--------------------------------+     |
|    |      ADMIN WEB (Vite/React) |                           |     USER WEB (Vite/React)      |     |
|    |  - Station/Camera Config    |                           |  - Packing Station Screen      |     |
|    |  - Video Search & Proof     |                           |  - USB Scanner (HID Keyboard)  |     |
|    |  - Storage & Retention      |                           |  - Giant Status & Live Stream  |     |
|    +--------------+--------------+                           +---------------+----------------+     |
|                   |                                                          |                      |
|                   | REST API / JWT                                           | REST / WebSockets    |
|                   v                                                          v                      |
|    +------------------------------------------------------------------------------------------+     |
|    |                                  BACKEND API SERVICE (Fastify/NestJS)                    |     |
|    |  - Auth & RBAC (Argon2/JWT)                 - Packing Session State Machine              |     |
|    |  - Barcode Validation Engine                - Audit Logging & System Event Bus           |     |
|    |  - Storage Manager & Retention Engine       - Worker Coordination & Health Monitor       |     |
|    +----------------------------+---------------------------------------------+---------------+     |
|                                 |                                             |                     |
|                   Prisma/Drizzle|ORM                             Internal HTTP|/ WebSocket RPC      |
|                                 v                                             v                     |
|    +----------------------------+---------+          +------------------------+---------------+     |
|    |          POSTGRESQL 16               |          |           VIDEO WORKER SERVICE         |     |
|    |  - Users, Roles, Stations            |          |  (Node.js Native + Child Process FFmpeg)|     |
|    |  - Packing Sessions & Orders         |          |  - Camera Monitor (RTSP/Webcam)        |     |
|    |  - Video Metadata & SHA256 Hashes    |          |  - FFmpeg Process Lifecycle Manager    |     |
|    |  - Retention & Dispute Locks         |          |  - SHA256 & Thumbnail Generator        |     |
|    +--------------------------------------+          |  - Local File -> NAS Sync Engine       |     |
|                                                      |  - Heartbeat & Health Telemetry        |     |
|                                                      +-----+--------------------+-------------+     |
|                                                            |                    |                   |
|                                         Direct Capture / OS|Device              | Disk I/O & SMB    |
|                                                            v                    v                   |
|                                                +-----------+--+     +-----------+-------------+     |
|                                                | CAMERAS      |     | STORAGE SUB-SYSTEM      |     |
|                                                | - RTSP H.264 |     | 1. Local Temp SSD       |     |
|                                                | - USB Webcams|     | 2. Local Final Archive  |     |
|                                                +--------------+     | 3. NAS / Windows Share  |     |
|                                                                     +-------------------------+     |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown & Responsibilities

### 3.1. Frontend Modules (`/apps`)
1. **Admin Web (`/apps/admin-web`):**
   - Independent Single Page Application (SPA).
   - Serves warehouse managers, system admins, CSKH, and auditors.
   - Comprehensive CRUD for Warehouses, Stations, Cameras, Users, and Storage configurations.
   - Video proof search portal with live playback, download, copy path, and cryptographic SHA-256 verification.
   - Dashboard with telemetry: Orders/hour, cameras online/offline, worker heartbeat, disk utilization, sync queues.

2. **User Web (`/apps/user-web`):**
   - Lightweight, ultra-responsive packing interface.
   - Optimized for touchscreens and barcode guns (auto-focusing hidden/visible inputs, ENTER interception).
   - Station-locked mode (persisted station UUID in local storage or URL parameter).
   - Real-time video preview using low-latency WebRTC/MSE/HLS/MJPEG stream proxies provided by the worker.
   - Visual and audio cues (chimes for success, warning buzzers for duplicate or conflicting scans).

### 3.2. Backend API (`/apps/backend-api`)
- Built with **Node.js (TypeScript) + Fastify** (high throughput, low latency) or **NestJS**.
- **REST Endpoints:** Authentication, Session CRUD, Camera metadata, Order searches, Dispute locks, Logs.
- **WebSocket Gateway:**
  - Real-time station state dispatching (RECORDING, PROCESSING, COMPLETED, FAILED).
  - Worker health monitor (tracks 10s heartbeats, marks worker OFFLINE after 30s of silence).
- **Security & Crypto:**
  - Passwords hashed with **Argon2id**.
  - RTSP passwords and NAS network share credentials stored with **AES-256-GCM** with an environment-injected Master Key.

### 3.3. Video Worker (`/apps/video-worker`)
- Autonomous Node.js daemon running on the station host machine or an edge server with physical/network access to the cameras.
- **FFmpeg Orchestration:**
  - Spawns and supervises FFmpeg child processes with stdout/stderr pipes.
  - Graceful stop via `q` command on standard input or `SIGINT` to ensure MP4 container atoms (`moov`) are finalized without corrupting the file.
  - Automatically falls back to `-movflags +faststart` to guarantee immediate web browser playback capability.
- **Local Pipeline Execution:**
  - Temporary recording to `D:\PackingVideoTemp\session_{id}.tmp.mp4`.
  - Atomically renames/moves completed file to structured local directory `D:\PackingVideo\YYYY\MM\DD\{filename}.mp4`.
  - Computes SHA-256 stream hash during post-processing.
  - Extracts representative video thumbnail (JPEG) at 1.0 second mark.
- **Reliable Storage Sync Engine:**
  - In-memory queue with SQLite/disk-backed state persistence for failed copy jobs.
  - Syncs to Windows UNC paths (e.g. `\\SERVER\PackingVideo\...`) using buffered streams.
  - If NAS is unreachable, sets DB `sync_status = 'PENDING'` and backs off exponentially without blocking packing operations.

### 3.4. Shared Packages (`/packages`)
- **`shared-types`**: TypeScript interfaces, enums, DTOs, and API response schemas shared across all apps.
- **`shared-utils`**: Common validation helpers (barcode parser, date formatting, cryptographic wrappers).
- **`shared-ui`**: Tailored Tailwind CSS component design tokens and base components (badges, modals, buttons).
- **`database`**: Prisma schema, client generation, migration scripts, and seed data.

---

## 4. Hardware & Storage Topology

### 4.1. Directory Structure on Local Disk & NAS
```
Storage Root (e.g., D:\PackingVideo or \\SERVER\PackingVideo)
  └── 2026/
      └── 10/
          └── 03/
              ├── SPXVN123456_PACK01_20261003_163012.mp4
              ├── SPXVN123456_PACK01_20261003_163012.jpg   (Thumbnail)
              └── SPXVN123456_PACK01_20261003_163012.json  (Proof Sidecar)
```

### 4.2. Disk Space & Bandwidth Sizing
- **Video Standard:** 1080p (1920x1080) @ 25fps or 720p (1280x720) @ 25fps.
- **Video Codec:** H.264 (libx264 or hardware NVENC/QSV), CRF 26, Preset: `veryfast`.
- **Bitrate Average:** ~1.2 Mbps to 1.8 Mbps.
- **Average Packing Duration:** 45 seconds $\rightarrow$ ~8 MB to 12 MB per order.
- **Daily Volume (1,000 orders/day):** ~10 GB to 12 GB/day.
- **Monthly Volume (30 days):** ~300 GB to 360 GB.
- **Local Drive Recommendation:** Minimum 512 GB NVMe SSD for OS + Temporary Buffer + 14-day rolling buffer, backed by 4TB–16TB NAS for 90–365 day retention.

---

## 5. Reliability & Resilience Patterns

| Failure Scenario | System Reaction | Prevention / Recovery Strategy |
| :--- | :--- | :--- |
| **NAS / Network Share Drops** | Local recording finishes normally. Status flagged `PENDING`. | Sync daemon detects network error, holds file in local archive, queues retry. UI never blocks packing. |
| **Camera RTSP Signal Lost** | FFmpeg exits with error code or stalls. | Worker detects pipe close, logs `CAMERA_ERROR`, signals Backend. User Web displays bold red `CAMERA DISCONNECTED` warning. |
| **Worker Crashes during Recording** | Orphaned temp file exists. | On worker restart, sweeps `PackingVideoTemp`, repairs unfinalized MP4 using `ffmpeg -i ... -c copy`, marks session `FAILED` or saves partial proof. |
| **Operator Scans While Recording** | Scan captured by debounce/state check. | Modal halts change. User must choose: "Complete Current & Start New" or "Cancel Scan". |
| **Full Local Disk Hazard** | Monitored by Worker every 60 seconds. | If free space < 10 GB: Alert. If free space < 2 GB: Emergency halt of new recordings to prevent corrupt writes. |

---

## 6. Technology Stack Summary

| Layer | Selected Technology | Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + TypeScript + Vite | Blazing fast build, strong typing, battle-tested ecosystem |
| **Styling** | Tailwind CSS + Lucide Icons | Clean utility-first design, easy customization for high-contrast warehouse UI |
| **State & API Query** | TanStack Query v5 + Zustand | Efficient caching, automatic background refetching, lightweight station state |
| **Backend Framework** | Fastify (or NestJS with Fastify) | Benchmark leader in Node.js ecosystem, native schema validation with TypeBox/Zod |
| **Database** | PostgreSQL 16 + Prisma ORM | ACID compliance, robust indexing on tracking codes, JSONB support for logs |
| **Video Engine** | FFmpeg (Native binary) | Universal RTSP/UVC driver support, mature H.264 encoding, rock-solid stability |
| **Deployment / OS** | Windows 10/11 Pro & Windows Server / Linux Docker | Native support for Windows USB scanners, DirectShow webcam capture & SMB shares |
