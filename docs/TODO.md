# PACKING VIDEO PROOF - PROJECT ROADMAP & IMPLEMENTATION PHASES

> **Status Tracking:** Phase 1 Design Specification - Review Round 2 (Codex Findings D01-01 through D01-10 Addressed)  
> **Rule:** Do not proceed to application coding until Architecture & Design Packet is approved by Codex.

---

## Phase Checklist

- [ ] **PHASE 1: System Architecture & Baseline Specifications (Review Round 2)**
  - [x] Create initial baseline documentation suite (`ARCHITECTURE.md`, `DATABASE.md`, `API_CONTRACT.md`, `FOLDER_STRUCTURE.md`, `FLOW_PACKING.md`, `VIDEO_PROCESSING.md`, `SECURITY.md`, `DEPLOYMENT.md`)
  - [x] Capture Base snapshot `docs/reviews/DESIGN-01-base/`
  - [x] Receive Codex Review Round 1 (`docs/reviews/DESIGN-01-CODEX-R1.md`)
  - [x] Address P1 findings (D01-01, D01-02, D01-03, D01-04, D01-05, D01-07)
  - [x] Address P2 findings (D01-06, D01-08, D01-09, D01-10)
  - [x] Update review packet `docs/reviews/DESIGN-01.md` with Round 2 fixes and evidence
  - [ ] Codex Round 2 Verification & Formal Sign-off

- [ ] **PHASE 2: Repository Structure & Monorepo Initialization**
  - [ ] Initialize PNPM Workspaces & Turborepo config
  - [ ] Create `/apps` folders (`admin-web`, `user-web`, `backend-api`, `video-worker`)
  - [ ] Create `/packages` folders (`shared-types`, `shared-ui`, `shared-utils`, `database`)
  - [ ] Setup base `tsconfig.json`, `.editorconfig`, `.gitignore`

- [ ] **PHASE 3: Database Layer & Migrations**
  - [ ] Initialize Prisma in `packages/database`
  - [ ] Define PostgreSQL models: Business, Warehouse, Station, Worker, Camera, Order, PackingSession, PackingCommand, WorkerEventsInbox, Video, StorageConfig, SystemLog
  - [ ] Configure conditional partial unique indexes in migrations (`uq_active_station_session`, `uq_active_camera_session`)
  - [ ] Create Docker Compose for local PostgreSQL 16
  - [ ] Create database seed script with default roles and warehouse

- [ ] **PHASE 4: Backend API - Authentication & Core Modules**
  - [ ] Fastify setup with TypeScript and TypeBox/Zod validation
  - [ ] Argon2id password hashing & JWT authentication (Access + Refresh tokens)
  - [ ] Resource-scoped authorization guards (Warehouse checking)
  - [ ] Worker WSS Gateway (`/ws/worker`) with `X-Worker-Token` validation and epoch management
  - [ ] CRUD endpoints: Warehouses, Stations, Cameras, Users
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
  - [ ] Real-time station status indicators (Ready, Waiting, Recording, Processing, Completed, Failed)
  - [ ] Anti-mistake confirmation modals (duplicate scan, scanning mid-record)
  - [ ] Low-latency camera live stream viewport
  - [ ] Giant timer display (visible from 1.5–2 meters)

- [ ] **PHASE 7: Video Worker Daemon - Service Foundation**
  - [ ] Standalone Node.js TypeScript daemon
  - [ ] WSS Client connecting to Backend Gateway with 10-second heartbeat and epoch tracking
  - [ ] Disk space monitoring & critical threshold alarm (Local Temp SSD)
  - [ ] Windows DirectShow and RTSP stream probe utilities
  - [ ] Local SQLite Command and Event Journal

- [ ] **PHASE 8: FFmpeg Recording Pipeline**
  - [ ] FFmpeg process spawning, supervisor, and pipe management
  - [ ] Ingestion to `D:\PackingVideoTemp\session_{id}.fmp4` (Fragmented MP4: `-f mp4 -movflags empty_moov+default_base_moof+frag_keyframe`)
  - [ ] Graceful termination (`q` on stdin / SIGINT) and safe remux to standard MP4 with `-movflags +faststart`
  - [ ] Startup recovery scan for orphaned `.fmp4` files
  - [ ] Thumbnail generator (JPEG extraction at 1s)
  - [ ] SHA-256 cryptographic stream calculation

- [ ] **PHASE 9: Reliable NAS & Windows Share Sync Engine**
  - [ ] Atomic file move from Local Temp to Local Archive with collision-proof short ID
  - [ ] Async background copy to Windows Share / NAS (`\\SERVER\PackingVideo\...`)
  - [ ] Mandatory remote SHA-256 calculation and verification before marking `SYNCED`
  - [ ] Resilient retry queue with exponential backoff on NAS offline
  - [ ] Status updates: `LOCAL` $\rightarrow$ `PENDING` $\rightarrow$ `SYNCING` $\rightarrow$ `SYNCED`

- [ ] **PHASE 10: Video Proof Search & Audit Portal**
  - [ ] Search by tracking code, order code, date range, station, operator
  - [ ] Web video player with HTTP 206 partial content byte-range seeking
  - [ ] On-demand cryptographic hash verification against database SHA-256
  - [ ] Dispute lock toggle with two-phase purge protection

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

- [ ] **PHASE 13: Comprehensive Testing Suite (Runtime Verification)**
  - [ ] Barcode scanning & multi-scan conflict resolution integration tests
  - [ ] Start/Stop recording integration tests with 202/201 status validation
  - [ ] SHA-256 hash validation tests
  - [ ] NAS offline simulation test (verifying zero video loss)
  - [ ] RBAC permission & warehouse boundary tests

- [ ] **PHASE 14: Deployment & Production Packaging**
  - [ ] Windows Service installation scripts for Video Worker (`nssm`) with hardened NTFS ACLs
  - [ ] Docker Compose for Backend API, PostgreSQL, and Nginx reverse proxy
  - [ ] Production runbooks & disaster recovery reconciliation verification
