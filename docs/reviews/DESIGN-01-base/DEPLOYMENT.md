# PACKING VIDEO PROOF - DEPLOYMENT GUIDE (LAN & WINDOWS)

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
> **Target Environment:** On-Premises Local Area Network (Windows 10/11 / Windows Server / Linux Docker)

---

## 1. Network Topology (LAN First)

```text
[ Warehouse LAN: 192.168.1.0/24 ]
├── 192.168.1.10: Main Server (Docker: PostgreSQL 16 + Backend API + Nginx)
├── 192.168.1.15: NAS Storage (SMB Share: \\SERVER\PackingVideo)
├── 192.168.1.51: Station 01 (Windows 11 PC + USB Scanner + User Web + Video Worker)
├── 192.168.1.52: Station 02 (Windows 11 PC + USB Scanner + User Web + Video Worker)
└── 192.168.1.101..120: RTSP IP Cameras (PoE Switch)
```

---

## 2. Directory Preparation on Packing Station & Server

```powershell
# Create storage directories on Windows
New-Item -ItemType Directory -Force -Path "D:\PackingVideoTemp"
New-Item -ItemType Directory -Force -Path "D:\PackingVideo"

# Grant read/write permissions to Service User
icacls "D:\PackingVideoTemp" /grant "Users:(OI)(CI)F" /T
icacls "D:\PackingVideo" /grant "Users:(OI)(CI)F" /T
```

---

## 3. Video Worker as a Windows Service

The Video Worker runs in the background using `nssm` (Non-Sucking Service Manager) to automatically restart on reboot or crash:

```powershell
# Install Video Worker Service
nssm install PackingVideoWorker "C:\Program Files\nodejs\node.exe" "E:\Website\apps\video-worker\dist\index.js"
nssm set PackingVideoWorker AppDirectory "E:\Website\apps\video-worker"
nssm set PackingVideoWorker Start SERVICE_AUTO_START
nssm start PackingVideoWorker
```

---

## 4. Main Server Deployment with Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: packing_postgres
    restart: always
    environment:
      POSTGRES_DB: packing_proof_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: SecretPassword123!
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend-api:
    build:
      context: ../../
      dockerfile: infrastructure/docker/Dockerfile.backend
    container_name: packing_backend
    restart: always
    environment:
      DATABASE_URL: postgresql://postgres:SecretPassword123!@postgres:5432/packing_proof_db
      PORT: 4000
    depends_on:
      - postgres
    ports:
      - "4000:4000"

volumes:
  pgdata:
```
