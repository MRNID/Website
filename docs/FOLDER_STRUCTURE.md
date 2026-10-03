# PACKING VIDEO PROOF - MONOREPO FOLDER STRUCTURE

> **Document Version:** 2.2.0 (Post Codex R1 Review - Findings D01-02, D01-06 Addressed)  
> **Repository Strategy:** Turborepo / PNPM Workspaces  
> **Language Standards:** TypeScript (Strict Mode) across all packages

---

## 1. Directory Tree Overview

```text
packing-video-proof/
├── .github/                         # CI/CD Workflows & Linter Gates
│   └── workflows/
│       ├── test.yml
│       └── build.yml
├── apps/                            # Deployable Applications
│   ├── admin-web/                   # Management & Video Proof Portal (Vite + React)
│   ├── user-web/                    # Packing Station Operator Interface (Vite + React)
│   ├── backend-api/                 # Core Fastify API & WebSocket Gateway
│   └── video-worker/                # FFmpeg Stream Daemon & NAS Sync Agent
├── packages/                        # Shared Internal Libraries
│   ├── database/                    # Prisma Schema, Migrations, Seeders
│   ├── shared-types/                # Shared Interfaces, DTOs, Enums, WS Contracts
│   ├── shared-ui/                   # Reusable UI Tokens, Icons & Components
│   └── shared-utils/                # Barcode Parsers, Hashes, Formatters
├── infrastructure/                  # Deployment & Ops Configurations
│   ├── docker/                      # Docker Compose & Dockerfiles
│   ├── nginx/                       # LAN Reverse Proxy & SSL Termination
│   ├── scripts/                     # Windows Setup, FFmpeg Check, NSSM setup
│   └── backup/                      # Postgres Dump & Storage Reconciliation Scripts
├── docs/                            # Architectural Documentation
│   ├── ARCHITECTURE.md              # System Architecture & Philosophy
│   ├── DATABASE.md                  # Database Schema, DDL & Indexes
│   ├── API_CONTRACT.md              # REST & Worker WSS Specification
│   ├── FOLDER_STRUCTURE.md          # Monorepo Organization (This Document)
│   ├── FLOW_PACKING.md              # Detailed Barcode & Recording Lifecycle
│   ├── VIDEO_PROCESSING.md          # FFmpeg Parameters & fMP4 Rules
│   ├── DEPLOYMENT.md                # Windows Service & Docker LAN Setup
│   ├── SECURITY.md                  # Cryptography, Auth & Tamper-Proofing
│   ├── BASELINE.md                  # Project Baseline & Non-Negotiable Rules
│   ├── AI_WORKFLOW.md               # Anti-Codex Collaborative Workflow
│   └── TODO.md                      # Phase Tracking & Milestone Roadmap
├── package.json                     # Monorepo Root Config (Workspaces)
├── pnpm-workspace.yaml              # Workspace Package Definitions
├── turbo.json                       # Turborepo Task Pipeline Graph
├── tsconfig.base.json               # Root TypeScript Compiler Options
├── .gitignore
└── README.md
```

---

## 2. Granular Module Breakdown

### 2.1. `apps/backend-api` (Fastify Core)
```text
apps/backend-api/
├── src/
│   ├── modules/
│   │   ├── auth/                    # JWT, Argon2id, Guards, RBAC Decorators
│   │   ├── users/                   # User Management & Warehouse assignment
│   │   ├── warehouses/              # Multi-warehouse partition
│   │   ├── stations/                # Station registration, Heartbeat monitor & Force-unlock
│   │   ├── workers/                 # Worker WSS registry, token verification & Epoch manager
│   │   ├── cameras/                 # RTSP/Webcam repository & credentials (AES-256-GCM)
│   │   ├── orders/                  # Order code & Tracking code indexing
│   │   ├── packing/                 # Start/Stop 202 Orchestrator & Outbox dispatcher
│   │   ├── inbox/                   # Worker Events Inbox (Deduplication Journal - D01-02)
│   │   ├── videos/                  # Video query, Streaming range (206) & Hash verify
│   │   ├── storage/                 # Storage configs & Two-phase Retention cron (D01-03)
│   │   └── logs/                    # Audit logger & system event streams
│   ├── websocket/
│   │   ├── worker.gateway.ts        # WSS connection tunnel for Station Workers
│   │   └── station.gateway.ts       # WSS status broadcast to User Web
│   ├── common/
│   │   ├── crypto/                  # AES-256-GCM RTSP/NAS password encryption
│   │   ├── exceptions/              # HTTP Exception filters
│   │   ├── guards/                  # Warehouse & Role authorization guards
│   │   └── interceptors/            # Idempotency & response envelope
│   ├── config/                      # Environment variables & runtime constants
│   ├── main.ts                      # Fastify bootstrap
│   └── app.module.ts
├── package.json
└── tsconfig.json
```

### 2.2. `apps/video-worker` (Recording Daemon & Agent)
```text
apps/video-worker/
├── src/
│   ├── journal/
│   │   ├── CommandJournal.ts        # Local SQLite command persistence (D01-02)
│   │   └── OutboundEventJournal.ts  # Outbound event queue with sequence numbers
│   ├── ffmpeg/
│   │   ├── FFmpegProcess.ts         # Child process manager (fMP4 ingestion, stdin)
│   │   ├── FFmpegArgsBuilder.ts     # RTSP & DirectShow parameter flags (-f mp4)
│   │   └── CrashRecovery.ts         # Startup scan & recovery of unfinalized fMP4
│   ├── camera/
│   ├── storage/
│   │   ├── PathResolver.ts          # YYYY/MM/DD directory resolver (collision-proof naming)
│   │   ├── HashCalculator.ts        # Streamed SHA-256 digester
│   │   ├── ThumbnailGenerator.ts    # Single frame extractor (JPEG)
│   │   └── NasSyncService.ts        # Verified SMB copy with remote SHA-256 validation (D01-07)
│   ├── agent/
│   │   ├── WssClient.ts             # Persistent WebSocket connection to Backend with Epoch
│   │   ├── HeartbeatTimer.ts        # 10s telemetry ticker
│   │   └── CommandHandler.ts        # START_RECORD, STOP_RECORD, CANCEL_RECORD
│   ├── worker.config.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```
