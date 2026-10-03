# PACKING VIDEO PROOF - PROJECT ROADMAP & IMPLEMENTATION PHASES

> **Status Tracking:** Phase 1 Drafted — architecture review and contract alignment pending.  
> **Rule:** Do not proceed to application coding until Architecture is reviewed and approved.

Điểm vào thiết kế: [BASELINE.md](BASELINE.md). Checklist tài liệu bên dưới chỉ xác nhận đã có bản nháp, không xác nhận kiến trúc đã được nghiệm thu. Thứ tự triển khai theo các điểm kiểm tra A–E trong baseline; cần kiểm chứng luồng quay trên một trạm trước khi mở rộng toàn bộ UI.

---

## Phase Checklist

- [ ] **PHASE 1: System Architecture & Specifications — review pending**
  - [ ] Resolve the open contracts listed in `docs/BASELINE.md`
  - [ ] Align API, database, worker topology, state transitions and recovery rules
  - [ ] Record architecture review outcome before application implementation
  - [x] Create `docs/ARCHITECTURE.md` (System Topology, LAN-First, Storage Pipeline)
  - [x] Create `docs/DATABASE.md` (PostgreSQL DDL, Prisma Schema, Indexes, Relations)
  - [x] Create `docs/API_CONTRACT.md` (REST API specs, internal Worker RPC, envelopes)
  - [x] Create `docs/FOLDER_STRUCTURE.md` (Monorepo breakdown, apps & packages)
  - [x] Create `docs/FLOW_PACKING.md` (USB Scanner logic, conflict resolution, recording lifecycle)
  - [x] Create `docs/TODO.md` (Roadmap & phase gatekeeper)

- [ ] **PHASE 2: Repository Structure & Monorepo Initialization**
  - [ ] Initialize PNPM Workspaces & Turborepo config
  - [ ] Create `/apps` folders (`admin-web`, `user-web`, `backend-api`, `video-worker`)
  - [ ] Create `/packages` folders (`shared-types`, `shared-ui`, `shared-utils`, `database`)
  - [ ] Setup base `tsconfig.json`, `.editorconfig`, `.gitignore`

- [ ] **PHASE 3: Database Layer & Migrations**
  - [ ] Initialize Prisma in `packages/database`
  - [ ] Define PostgreSQL models: User, Role, Warehouse, Station, Camera, Order, PackingSession, Video, StorageConfig, SystemLog
  - [ ] Create Docker Compose for local PostgreSQL 16
  - [ ] Create database seed script with default roles (`SUPER_ADMIN`, `PACKING_USER`, etc.) and root admin

- [ ] **PHASE 4: Backend API - Authentication & Core Modules**
  - [ ] Fastify / NestJS setup with TypeScript
  - [ ] Argon2 password hashing & JWT authentication (Access + Refresh tokens)
  - [ ] RBAC authorization guards
  - [ ] CRUD endpoints: Users, Roles, Warehouses, Stations, Cameras
  - [ ] AES-256-GCM encryption service for sensitive credentials (RTSP, NAS)

- [ ] **PHASE 5: Admin Web Management Portal**
  - [ ] Vite + React + TypeScript + Tailwind CSS setup
  - [ ] Login screen with JWT token storage
  - [ ] Navigation shell & sidebar
  - [ ] Station & Camera management interfaces
  - [ ] User & Role provisioning screens
  - [ ] Storage configuration screen (Local Temp, Local Final, NAS UNC paths)

- [ ] **PHASE 6: User Web - Packing Station Operator Interface**
  - [ ] Purpose-built UI for 1366x768 screens with high-contrast elements
  - [ ] Global USB Barcode Scanner hook with debounce and keyboard auto-capture
  - [ ] Real-time station status indicators (Ready, Recording, Processing, Completed, Failed)
  - [ ] Anti-mistake confirmation modals (duplicate scan, scanning mid-record)
  - [ ] Low-latency camera live stream viewport
  - [ ] Giant timer display (visible from 1.5–2 meters)

- [ ] **PHASE 7: Video Worker Daemon - Service Foundation**
  - [ ] Standalone Node.js TypeScript daemon with local RPC HTTP listener (`localhost:4005`)
  - [ ] 10-second heartbeat mechanism reporting to Backend API
  - [ ] Disk space monitoring & critical threshold alarm (Local Temp SSD)
  - [ ] Windows DirectShow and RTSP stream probe utilities

- [ ] **PHASE 8: FFmpeg Recording Pipeline**
  - [ ] FFmpeg process spawning, supervisor, and pipe management
  - [ ] Record to `D:\PackingVideoTemp\session_{id}.tmp.mp4`
  - [ ] Graceful termination (`q` on stdin / SIGINT) with `-movflags +faststart`
  - [ ] Recovery on unexpected worker restart (orphaned temp file cleanup)
  - [ ] Thumbnail generator (JPEG extraction at 1s)
  - [ ] SHA-256 cryptographic stream calculation

- [ ] **PHASE 9: Reliable NAS & Windows Share Sync Engine**
  - [ ] Atomic file move from Local Temp to Local Archive (`D:\PackingVideo\YYYY\MM\DD\...`)
  - [ ] Async background copy to Windows Share / NAS (`\\SERVER\PackingVideo\...`)
  - [ ] Resilient retry queue with exponential backoff on NAS offline
  - [ ] Status updates: `LOCAL` $\rightarrow$ `PENDING` $\rightarrow$ `SYNCING` $\rightarrow$ `SYNCED`

- [ ] **PHASE 10: Video Proof Search & Audit Portal**
  - [ ] Search by tracking code, order code, date range, station, operator
  - [ ] Web video player with HTTP 206 partial content byte-range seeking
  - [ ] On-demand cryptographic hash verification against database SHA-256
  - [ ] Dispute lock toggle (`is_locked`, `dispute_status`, `lock_reason`)

- [ ] **PHASE 11: Real-time Dashboard & Monitoring**
  - [ ] Daily KPIs: Orders packed, videos produced, storage used
  - [ ] Real-time camera & worker status indicators (Online/Offline)
  - [ ] NAS sync queue health monitor (Pending/Failed counts)
  - [ ] Hourly throughput chart (Orders / Hour)

- [ ] **PHASE 12: Security Hardening & Encryption**
  - [ ] Rate limiting on API endpoints
  - [ ] Audit trail event logger (`system_logs`)
  - [ ] Video file download permission verification
  - [ ] AES-256-GCM encrypted database columns for credentials

- [ ] **PHASE 13: Comprehensive Testing Suite**
  - [ ] Barcode scanning & multi-scan conflict resolution tests
  - [ ] Start/Stop recording integration tests
  - [ ] SHA-256 hash validation tests
  - [ ] NAS offline simulation test (verifying zero video loss)
  - [ ] RBAC permission tests

- [ ] **PHASE 14: Deployment & Production Packaging**
  - [ ] Windows Service installation scripts for Video Worker (`nssm` / `node-windows`)
  - [ ] Docker Compose for Backend API, PostgreSQL, and Nginx reverse proxy
  - [ ] Production runbooks & administrator troubleshooting guide
