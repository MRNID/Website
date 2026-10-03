# PACKING VIDEO PROOF - PROJECT ROADMAP & IMPLEMENTATION PHASES

> **Status Tracking:** Phase 1 Design Specification Refined (Aligned with Baseline & Multi-Module Contracts)  
> **Rule:** Do not proceed to application coding until Architecture & Design Packet is reviewed and approved.

---

## Phase Checklist

- [x] **PHASE 1: System Architecture & Baseline Specifications**
  - [x] Create `docs/ARCHITECTURE.md` (System Topology, LAN-First, Ingestion Pipeline, Concurrency)
  - [x] Create `docs/DATABASE.md` (PostgreSQL DDL, Prisma Schema, Conditional Indexes, Outbox, Concurrency)
  - [x] Create `docs/API_CONTRACT.md` (REST API specs, 202/201 status codes, Idempotency, Worker WSS Protocol)
  - [x] Create `docs/FOLDER_STRUCTURE.md` (Monorepo breakdown, apps & packages)
  - [x] Create `docs/FLOW_PACKING.md` (USB Scanner logic, conflict resolution, recording lifecycle)
  - [x] Create `docs/VIDEO_PROCESSING.md` (fMP4 ingestion, faststart remux, crash recovery)
  - [x] Create `docs/SECURITY.md` (Resource-scoped RBAC, Worker Token Auth, Retention Locks)
  - [x] Create `docs/DEPLOYMENT.md` (LAN Network Topology, Windows NSSM Service, RPO/RTO, Reconciliation)
  - [x] Create `docs/reviews/DESIGN-01.md` (Formal Review Packet for Codex Audit)

- [ ] **PHASE 2: Repository Structure & Monorepo Initialization**
  - [ ] Initialize PNPM Workspaces & Turborepo config
  - [ ] Create `/apps` folders (`admin-web`, `user-web`, `backend-api`, `video-worker`)
  - [ ] Create `/packages` folders (`shared-types`, `shared-ui`, `shared-utils`, `database`)
  - [ ] Setup base `tsconfig.json`, `.editorconfig`, `.gitignore`

- [ ] **PHASE 3: Database Layer & Migrations**
  - [ ] Initialize Prisma in `packages/database`
  - [ ] Define PostgreSQL models: Business, Warehouse, Station, Worker, Camera, Order, PackingSession, PackingCommand, Video, StorageConfig, SystemLog
  - [ ] Configure conditional partial unique indexes in migrations
  - [ ] Create Docker Compose for local PostgreSQL 16
  - [ ] Create database seed script with default roles (`SUPER_ADMIN`, `PACKING_USER`, etc.) and default warehouse

- [ ] **PHASE 4: Backend API - Authentication & Core Modules**
  - [ ] Fastify setup with TypeScript and TypeBox/Zod validation
  - [ ] Argon2 password hashing & JWT authentication (Access + Refresh tokens)
  - [ ] Resource-scoped authorization guards (Warehouse checking)
  - [ ] Worker WSS Gateway (`/ws/worker`) with `X-Worker-Token` validation
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
  - [ ] Real-time station status indicators (Ready, Connecting, Recording, Processing, Completed, Failed)
  - [ ] Anti-mistake confirmation modals (duplicate scan, scanning mid-record)
  - [ ] Low-latency camera live stream viewport
  - [ ] Giant timer display (visible from 1.5–2 meters)

- [ ] **PHASE 7: Video Worker Daemon - Service Foundation**
  - [ ] Standalone Node.js TypeScript daemon with local RPC HTTP listener (`localhost:4005`)
  - [ ] WSS Client connecting to Backend Gateway with 10-second heartbeat
  - [ ] Disk space monitoring & critical threshold alarm (Local Temp SSD)
  - [ ] Windows DirectShow and RTSP stream probe utilities

- [ ] **PHASE 8: FFmpeg Recording Pipeline**
  - [ ] FFmpeg process spawning, supervisor, and pipe management
  - [ ] Ingestion to `D:\PackingVideoTemp\session_{id}.fmp4` (Fragmented MP4)
  - [ ] Graceful termination (`q` on stdin / SIGINT) and remux to standard MP4 with `-movflags +faststart`
  - [ ] Startup recovery scan for orphaned `.fmp4` files
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
  - [ ] Start/Stop recording integration tests with 202/201 status validation
  - [ ] SHA-256 hash validation tests
  - [ ] NAS offline simulation test (verifying zero video loss)
  - [ ] RBAC permission & warehouse boundary tests

- [ ] **PHASE 14: Deployment & Production Packaging**
  - [ ] Windows Service installation scripts for Video Worker (`nssm`)
  - [ ] Docker Compose for Backend API, PostgreSQL, and Nginx reverse proxy
  - [ ] Production runbooks & administrator troubleshooting guide
