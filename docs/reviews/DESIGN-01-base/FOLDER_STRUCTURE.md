# PACKING VIDEO PROOF - MONOREPO FOLDER STRUCTURE

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
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
│   ├── admin-web/                   # Management & Video Proof Portal
│   ├── user-web/                    # Packing Station Operator Interface
│   ├── backend-api/                 # Core Fastify/NestJS Business API
│   └── video-worker/                # FFmpeg Stream Daemon & NAS Sync
├── packages/                        # Shared Internal Libraries
│   ├── database/                    # Prisma Schema, Migrations, Seeders
│   ├── shared-types/                # Shared Interfaces, DTOs, Enums
│   ├── shared-ui/                   # Reusable UI Tokens, Icons & Components
│   └── shared-utils/                # Barcode Parsers, Hashes, Formatters
├── infrastructure/                  # Deployment & Ops Configurations
│   ├── docker/                      # Docker Compose & Dockerfiles
│   ├── nginx/                       # LAN Reverse Proxy & SSL Termination
│   ├── scripts/                     # Windows Setup, FFmpeg Check, NAS mount
│   └── backup/                      # Postgres Dump & Retention Sweeper Scripts
├── docs/                            # Architectural Documentation
│   ├── ARCHITECTURE.md              # System Architecture & Philosophy
│   ├── DATABASE.md                  # Database Schema, DDL & Indexes
│   ├── API_CONTRACT.md              # REST & Internal RPC Specification
│   ├── FOLDER_STRUCTURE.md          # Monorepo Organization (This Document)
│   ├── FLOW_PACKING.md              # Detailed Barcode & Recording Lifecycle
│   ├── VIDEO_PROCESSING.md          # FFmpeg Parameters & Storage Rules
│   ├── DEPLOYMENT.md                # Windows Service & Docker LAN Setup
│   ├── SECURITY.md                  # Cryptography, Auth & Tamper-Proofing
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

### 2.1. `apps/admin-web` (SPA)
```text
apps/admin-web/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/                  # Navbar, Sidebar, PageHeader, Modals
│   │   ├── dashboard/               # MetricCards, LiveCameraGrid, StorageGauges
│   │   ├── videos/                  # VideoPlayerModal, HashVerifier, DisputeForm
│   │   └── settings/                # StorageConfigEditor, RetentionSelector
│   ├── hooks/                       # useAuth, useVideos, useStations, useDashboard
│   ├── layouts/                     # AdminLayout, AuthLayout
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── RolesPage.tsx
│   │   ├── WarehousesPage.tsx
│   │   ├── StationsPage.tsx
│   │   ├── CamerasPage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── VideosPage.tsx
│   │   ├── StoragePage.tsx
│   │   ├── WorkersPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/                    # Axios API Clients
│   ├── store/                       # Zustand Admin Session Store
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 2.2. `apps/user-web` (Packing Station UI)
```text
apps/user-web/
├── public/
│   ├── audio/
│   │   ├── scan-success.mp3         # High-clarity chime on barcode scanned
│   │   ├── warning.mp3              # Loud buzzer for duplicate/conflict scan
│   │   └── complete.mp3             # Pleasant tone when session completes
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── BarcodePrompt.tsx        # High-contrast input (visible from 2m)
│   │   ├── CameraLivePreview.tsx    # Low-latency camera canvas / video tag
│   │   ├── RecordingTimer.tsx       # Giant digital timer (MM:SS)
│   │   ├── ActionControls.tsx       # Big touch/click buttons (Start, Stop, Cancel)
│   │   ├── ConflictModal.tsx        # Barcode switch confirmation dialog
│   │   └── StationStatusBadge.tsx   # Ready, Recording, Processing, Failed
│   ├── hooks/
│   │   ├── useBarcodeScanner.ts     # Global keyboard interceptor for USB scanner
│   │   ├── usePackingSession.ts     # State machine connector to backend
│   │   └── useStationLock.ts        # Station configuration & persistence
│   ├── pages/
│   │   ├── PackingStationPage.tsx   # Main 1366x768 optimized station console
│   │   └── StationSelectPage.tsx    # Initial boot screen to choose Station ID
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 2.3. `apps/backend-api` (Fastify / NestJS Core)
```text
apps/backend-api/
├── src/
│   ├── modules/
│   │   ├── auth/                    # JWT, Argon2, Guards, RBAC Decorators
│   │   ├── users/                   # User Management
│   │   ├── warehouses/              # Multi-warehouse partition
│   │   ├── stations/                # Station registration & Heartbeat monitor
│   │   ├── cameras/                 # RTSP/Webcam repository & credentials
│   │   ├── orders/                  # Order code & Tracking code indexing
│   │   ├── packing/                 # Start/Stop Session Orchestration
│   │   ├── videos/                  # Video query, Streaming range & Hash verify
│   │   ├── storage/                 # Storage configs & Retention cron
│   │   ├── workers/                 # Worker health registry & load dispatcher
│   │   └── logs/                    # Audit logger & system event streams
│   ├── common/
│   │   ├── crypto/                  # AES-256-GCM RTSP/NAS password encryption
│   │   ├── exceptions/              # HTTP Exception filters
│   │   ├── guards/                  # Role & Permission validation guards
│   │   └── interceptors/            # Response formatting & request IDs
│   ├── websocket/
│   │   └── station.gateway.ts       # Live station status push to frontends
│   ├── config/                      # Environment variables & runtime constants
│   ├── main.ts                      # Fastify bootstrap
│   └── app.module.ts
├── package.json
└── tsconfig.json
```

### 2.4. `apps/video-worker` (Recording Daemon)
```text
apps/video-worker/
├── src/
│   ├── ffmpeg/
│   │   ├── FFmpegProcess.ts         # Child process manager (spawn, stdin, pipe)
│   │   ├── FFmpegArgsBuilder.ts     # Hardware acceleration & codec flags builder
│   │   └── StreamHealthMonitor.ts   # Detects frame freeze and pipe crash
│   ├── camera/
│   │   ├── RTSPProbe.ts             # Camera ping & handshake verification
│   │   └── DirectShowProbe.ts       # Windows USB webcam device discoverer
│   ├── storage/
│   │   ├── PathResolver.ts          # YYYY/MM/DD directory resolver
│   │   ├── HashCalculator.ts        # Streamed SHA-256 digester
│   │   ├── ThumbnailGenerator.ts    # Single frame extractor
│   │   └── NasSyncService.ts        # Windows SMB / UNC path copy with retries
│   ├── rpc/
│   │   ├── WorkerServer.ts          # Local Fastify RPC listener (port 4005)
│   │   └── HeartbeatSender.ts       # 10s ping ticker to Backend API
│   ├── worker.config.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 2.5. `packages/*`
```text
packages/
├── database/
│   ├── prisma/
│   │   ├── schema.prisma            # PostgreSQL schema definition
│   │   ├── migrations/              # Incremental SQL migrations
│   │   └── seed.ts                  # Default Roles & Admin account
│   ├── src/index.ts                 # Exported PrismaClient instance
│   └── package.json
├── shared-types/
│   ├── src/
│   │   ├── auth.types.ts
│   │   ├── session.types.ts
│   │   ├── video.types.ts
│   │   ├── camera.types.ts
│   │   ├── station.types.ts
│   │   └── index.ts
│   └── package.json
├── shared-utils/
│   ├── src/
│   │   ├── barcode-validator.ts     # Regex patterns for Shopee, TikTok, Lazada, etc.
│   │   ├── date-formatter.ts
│   │   ├── hash-verifier.ts
│   │   └── index.ts
│   └── package.json
└── shared-ui/
    ├── src/
    │   ├── theme.css                # Standard color tokens
    │   └── index.ts
    └── package.json
```

### 2.6. `infrastructure/*`
```text
infrastructure/
├── docker/
│   ├── docker-compose.yml           # PostgreSQL + Backend + Nginx
│   ├── Dockerfile.backend
│   ├── Dockerfile.admin
│   └── Dockerfile.user
├── nginx/
│   └── nginx.conf                   # LAN reverse proxy routing /api, /admin, /station
├── scripts/
│   ├── setup-windows-env.ps1        # Auto-installs FFmpeg, sets D:\ folders
│   ├── create-sample-db.ps1
│   └── test-rtsp-stream.ps1
└── backup/
    ├── backup-db.ps1                # Scheduled pg_dump to backup directory
    └── run-retention-cleanup.ps1    # Safe purge script for archived storage
```
