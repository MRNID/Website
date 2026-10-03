# PACKING VIDEO PROOF - DATABASE SCHEMA SPECIFICATION

> **Document Version:** 2.0.0 (Updated to Baseline Alignment)  
> **Target RDBMS:** PostgreSQL 15+  
> **ORM Engine:** Prisma ORM / Drizzle ORM

---

## 1. Entity-Relationship Overview & Boundary Scoping

```mermaid
erDiagram
    BUSINESSES ||--o{ WAREHOUSES : owns
    BUSINESSES ||--o{ ROLES : configures
    WAREHOUSES ||--o{ STATIONS : contains
    WAREHOUSES ||--o{ USERS : assigns
    ROLES ||--o{ USERS : grants
    STATIONS ||--one WORKERS : authenticates
    STATIONS ||--o{ CAMERAS : mounts
    STATIONS ||--o{ PACKING_SESSIONS : hosts
    USERS ||--o{ PACKING_SESSIONS : operates
    ORDERS ||--o{ PACKING_SESSIONS : verifies
    PACKING_SESSIONS ||--one VIDEOS : produces
    PACKING_SESSIONS ||--o{ PACKING_COMMANDS : logs
    USERS ||--o{ SYSTEM_LOGS : triggers
    STATIONS ||--o{ SYSTEM_LOGS : generates
    WAREHOUSES ||--o{ STORAGE_CONFIGS : provisions

    BUSINESSES {
        uuid id PK
        string name
        string code UK
        boolean is_active
        timestamp created_at
    }

    ROLES {
        uuid id PK
        uuid business_id FK
        string name UK
        string description
        jsonb permissions
    }

    USERS {
        uuid id PK
        uuid business_id FK
        uuid warehouse_id FK
        string username UK
        string password_hash
        string full_name
        string email UK
        uuid role_id FK
        boolean is_active
        timestamp created_at
    }

    WAREHOUSES {
        uuid id PK
        uuid business_id FK
        string name
        string code UK
        string address
        string timezone
        boolean is_active
        timestamp created_at
    }

    STATIONS {
        uuid id PK
        uuid warehouse_id FK
        string name
        string code UK
        string computer_name
        string ip_address
        string status
        timestamp last_heartbeat_at
        timestamp created_at
    }

    WORKERS {
        uuid id PK
        uuid station_id FK, UK
        string token_hash
        string version
        string status
        string ip_address
        timestamp last_heartbeat_at
        jsonb system_telemetry
        timestamp updated_at
    }

    CAMERAS {
        uuid id PK
        uuid station_id FK
        string name
        string type
        string rtsp_url
        string username
        string password_encrypted
        string status
        timestamp created_at
    }

    ORDERS {
        uuid id PK
        uuid warehouse_id FK
        string order_code
        string tracking_code UK
        string platform
        timestamp created_at
    }

    PACKING_SESSIONS {
        uuid id PK
        uuid warehouse_id FK
        uuid order_id FK
        uuid station_id FK
        uuid camera_id FK
        uuid user_id FK
        string status
        string idempotency_key UK
        int version
        timestamp start_time
        timestamp end_time
        text cancellation_reason
        timestamp created_at
    }

    PACKING_COMMANDS {
        uuid id PK
        uuid session_id FK
        uuid station_id FK
        string command_type
        string idempotency_key UK
        jsonb payload
        string status
        int retry_count
        text error_message
        timestamp created_at
        timestamp executed_at
    }

    VIDEOS {
        uuid id PK
        uuid packing_session_id FK, UK
        string filename
        string local_path
        string nas_path
        numeric duration
        bigint file_size
        string sha256
        string thumbnail_path
        string sync_status
        int sync_attempts
        text sync_error
        boolean is_locked
        uuid locked_by FK
        timestamp locked_at
        text lock_reason
        string dispute_status
        int version
        timestamp created_at
        timestamp updated_at
    }

    STORAGE_CONFIGS {
        uuid id PK
        uuid warehouse_id FK
        string storage_type
        string path
        string username
        string password_encrypted
        int retention_days
        int local_retention_days
        boolean enabled
        boolean is_default
        timestamp created_at
    }

    SYSTEM_LOGS {
        bigserial id PK
        uuid business_id FK
        uuid warehouse_id FK
        string level
        string module
        string message
        jsonb metadata
        uuid user_id FK
        uuid station_id FK
        timestamp created_at
    }
```

---

## 2. PostgreSQL DDL Specification

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BUSINESSES (Multi-warehouse / Tenant Foundation)
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROLES
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_business_name UNIQUE (business_id, name)
);

-- 3. WAREHOUSES
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. STATIONS
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    computer_name VARCHAR(100),
    ip_address VARCHAR(45),
    status VARCHAR(30) NOT NULL DEFAULT 'OFFLINE', -- OFFLINE, ONLINE, BUSY, MAINTENANCE
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. WORKERS (Daemon Registration & Token Auth)
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL UNIQUE REFERENCES stations(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    version VARCHAR(30) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
    ip_address VARCHAR(45),
    last_heartbeat_at TIMESTAMPTZ,
    system_telemetry JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. CAMERAS
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'RTSP', -- 'RTSP' or 'WEBCAM'
    rtsp_url TEXT,
    username VARCHAR(100),
    password_encrypted TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. ORDERS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    order_code VARCHAR(100) NOT NULL,
    tracking_code VARCHAR(100) NOT NULL UNIQUE,
    platform VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    customer_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. PACKING SESSIONS (State Machine + Concurrency Protection)
CREATE TABLE packing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'WAITING', -- WAITING, RECORDING, PROCESSING, COMPLETED, FAILED, CANCELLED
    idempotency_key VARCHAR(100) UNIQUE,
    version INT NOT NULL DEFAULT 1,
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. PACKING COMMANDS (Transactional Outbox & Audit)
CREATE TABLE packing_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES packing_sessions(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL, -- START_RECORD, STOP_RECORD, CANCEL_RECORD
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, DISPATCHED, ACKED, FAILED
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMPTZ
);

-- 11. VIDEOS (Forensic Proof & Storage Tracking)
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packing_session_id UUID NOT NULL UNIQUE REFERENCES packing_sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    local_path TEXT NOT NULL,
    nas_path TEXT,
    duration NUMERIC(8,2) NOT NULL DEFAULT 0.0,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256 VARCHAR(64) NOT NULL,
    thumbnail_path TEXT,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'LOCAL', -- LOCAL, PENDING, SYNCING, SYNCED, FAILED
    sync_attempts INT NOT NULL DEFAULT 0,
    sync_error TEXT,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    lock_reason TEXT,
    dispute_status VARCHAR(30) NOT NULL DEFAULT 'NORMAL', -- NORMAL, DISPUTE, RESOLVED
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. STORAGE CONFIGS
CREATE TABLE storage_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    storage_type VARCHAR(50) NOT NULL, -- LOCAL_TEMP, LOCAL_ARCHIVE, NAS_SHARE
    path TEXT NOT NULL,
    username VARCHAR(100),
    password_encrypted TEXT,
    retention_days INT NOT NULL DEFAULT 90,
    local_retention_days INT NOT NULL DEFAULT 14,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. SYSTEM LOGS
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL,
    module VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Strict Concurrency & Partial Unique Constraints

```sql
-- RULE 1: STRICT SINGLE ACTIVE SESSION PER STATION
-- Prevents two tabs or operators from having multiple concurrent active sessions on the same station
CREATE UNIQUE INDEX uq_active_station_session 
ON packing_sessions (station_id) 
WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING');

-- RULE 2: STRICT SINGLE ACTIVE SESSION PER CAMERA
-- Prevents one camera from being hijacked or recorded into two sessions concurrently
CREATE UNIQUE INDEX uq_active_camera_session 
ON packing_sessions (camera_id) 
WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING');

-- RULE 3: FAST INDEX FOR PENDING NAS SYNC QUEUE
CREATE INDEX idx_videos_sync_queue 
ON videos (created_at ASC) 
WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING');

-- RULE 4: FAST SEARCH BY TRACKING AND ORDER CODES
CREATE INDEX idx_orders_tracking_code ON orders (tracking_code);
CREATE INDEX idx_orders_order_code ON orders (order_code);
CREATE INDEX idx_orders_warehouse_date ON orders (warehouse_id, created_at DESC);

-- RULE 5: RETENTION SWEEP INDEX
CREATE INDEX idx_videos_retention_sweep 
ON videos (created_at ASC) 
WHERE is_locked = FALSE AND dispute_status = 'NORMAL';
```

---

## 4. Retention & Dispute Race-Condition Prevention

To guarantee that a background retention cleanup cron **never deletes** a video that an operator or customer service agent is currently locking:

### Database Transactional Retention Sweep Algorithm
```sql
-- Run inside a SERIALIZABLE or READ COMMITTED transaction with explicit row-level locks
BEGIN;

-- Select candidate videos that have exceeded retention, are NOT locked, and have been verified on NAS
SELECT id, local_path, nas_path, sync_status 
FROM videos 
WHERE created_at < (NOW() - INTERVAL '90 days')
  AND is_locked = FALSE 
  AND dispute_status = 'NORMAL'
  AND sync_status = 'SYNCED'
FOR UPDATE SKIP LOCKED;

-- File deletion on disk occurs only AFTER the row is locked in DB
-- If CSKH simultaneously acquires lock (is_locked = TRUE), the retention job skips that row safely.

COMMIT;
```
