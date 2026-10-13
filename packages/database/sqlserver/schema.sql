-- PACKING VIDEO PROOF - SQL SERVER DDL SPECIFICATION
-- Database: packing_proof_db
-- Target: SQL Server 2005+ Compatibility

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'packing_proof_db')
BEGIN
    CREATE DATABASE packing_proof_db;
END
GO

USE packing_proof_db;
GO

-- 1. BUSINESSES (Tenants / Companies)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[businesses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[businesses] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [name] NVARCHAR(100) NOT NULL,
        [code] VARCHAR(50) NOT NULL UNIQUE,
        [contact_name] NVARCHAR(100) NULL,
        [phone] VARCHAR(20) NULL,
        [email] VARCHAR(100) NULL,
        [plan_tier] VARCHAR(30) NOT NULL DEFAULT 'STARTER',
        [monthly_order_limit] INT NOT NULL DEFAULT 1000,
        [max_stations] INT NOT NULL DEFAULT 1,
        [retention_days] INT NOT NULL DEFAULT 30,
        [subscription_status] VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        [subscription_expires_at] DATETIME NULL,
        [price_per_month] DECIMAL(18, 0) NOT NULL DEFAULT 299000,
        [notes] NVARCHAR(MAX) NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 2. ROLES
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[roles]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[roles] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [business_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[businesses]([id]) ON DELETE CASCADE,
        [name] VARCHAR(50) NOT NULL,
        [description] NVARCHAR(255) NULL,
        [permissions] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [uq_role_business_name] UNIQUE ([business_id], [name])
    );
END
GO

-- 3. WAREHOUSES
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[warehouses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[warehouses] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [business_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[businesses]([id]) ON DELETE CASCADE,
        [name] NVARCHAR(100) NOT NULL,
        [code] VARCHAR(50) NOT NULL UNIQUE,
        [address] NVARCHAR(MAX) NULL,
        [timezone] VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 4. USERS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [business_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[businesses]([id]) ON DELETE CASCADE,
        [warehouse_id] VARCHAR(36) NULL REFERENCES [dbo].[warehouses]([id]),
        [username] VARCHAR(50) NOT NULL UNIQUE,
        [password_hash] VARCHAR(255) NOT NULL,
        [full_name] NVARCHAR(100) NOT NULL,
        [email] VARCHAR(100) NOT NULL UNIQUE,
        [role_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[roles]([id]),
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [uq_user_id_warehouse] UNIQUE ([id], [warehouse_id])
    );
END
GO

-- 5. STATIONS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[stations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[stations] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [warehouse_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[warehouses]([id]) ON DELETE CASCADE,
        [name] NVARCHAR(100) NOT NULL,
        [code] VARCHAR(50) NOT NULL UNIQUE,
        [computer_name] VARCHAR(100) NULL,
        [ip_address] VARCHAR(45) NULL,
        [status] VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
        [last_heartbeat_at] DATETIME NULL,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [uq_station_id_warehouse] UNIQUE ([id], [warehouse_id])
    );
END
GO

-- 6. WORKERS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[workers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[workers] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [station_id] VARCHAR(36) NOT NULL UNIQUE REFERENCES [dbo].[stations]([id]) ON DELETE CASCADE,
        [token_hash] VARCHAR(255) NOT NULL,
        [current_epoch] VARCHAR(36) NULL,
        [version] VARCHAR(30) NOT NULL DEFAULT '1.0.0',
        [status] VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
        [ip_address] VARCHAR(45) NULL,
        [last_heartbeat_at] DATETIME NULL,
        [system_telemetry] NVARCHAR(MAX) NULL,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 7. CAMERAS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cameras]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[cameras] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [station_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[stations]([id]) ON DELETE CASCADE,
        [name] NVARCHAR(100) NOT NULL,
        [type] VARCHAR(20) NOT NULL DEFAULT 'RTSP',
        [rtsp_url] NVARCHAR(MAX) NULL,
        [username] NVARCHAR(100) NULL,
        [password_encrypted] NVARCHAR(MAX) NULL,
        [status] VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [uq_camera_id_station] UNIQUE ([id], [station_id])
    );
END
GO

-- 8. ORDERS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[orders] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [warehouse_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[warehouses]([id]) ON DELETE CASCADE,
        [order_code] VARCHAR(100) NOT NULL,
        [tracking_code] VARCHAR(100) NOT NULL,
        [platform] VARCHAR(50) NOT NULL DEFAULT 'OTHER',
        [customer_info] NVARCHAR(MAX) NULL,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [uq_orders_warehouse_tracking] UNIQUE ([warehouse_id], [tracking_code])
    );
    CREATE INDEX [idx_orders_tracking_code] ON [dbo].[orders] ([tracking_code]);
    CREATE INDEX [idx_orders_order_code] ON [dbo].[orders] ([order_code]);
END
GO

-- 9. PACKING SESSIONS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[packing_sessions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[packing_sessions] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [warehouse_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[warehouses]([id]),
        [order_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[orders]([id]),
        [station_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[stations]([id]),
        [camera_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[cameras]([id]),
        [user_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[users]([id]),
        [status] VARCHAR(30) NOT NULL DEFAULT 'WAITING',
        [idempotency_key] VARCHAR(100) NULL UNIQUE,
        [worker_epoch] VARCHAR(36) NULL,
        [version] INT NOT NULL DEFAULT 1,
        [start_time] DATETIME NOT NULL DEFAULT GETDATE(),
        [end_time] DATETIME NULL,
        [cancellation_reason] NVARCHAR(MAX) NULL,
        [has_partial_video] BIT NOT NULL DEFAULT 0,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX [idx_sessions_station_status] ON [dbo].[packing_sessions] ([station_id], [status]);
    CREATE INDEX [idx_sessions_created_at] ON [dbo].[packing_sessions] ([created_at]);
END
GO

-- 10. PACKING COMMANDS (Transactional Outbox)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[packing_commands]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[packing_commands] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [session_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[packing_sessions]([id]) ON DELETE CASCADE,
        [station_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[stations]([id]),
        [command_type] VARCHAR(50) NOT NULL,
        [idempotency_key] VARCHAR(100) NOT NULL UNIQUE,
        [worker_epoch] VARCHAR(36) NULL,
        [payload] NVARCHAR(MAX) NOT NULL,
        [payload_hash] VARCHAR(64) NOT NULL,
        [status] VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        [retry_count] INT NOT NULL DEFAULT 0,
        [error_message] NVARCHAR(MAX) NULL,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [dispatched_at] DATETIME NULL,
        [acked_at] DATETIME NULL,
        [executed_at] DATETIME NULL
    );
    CREATE INDEX [idx_commands_station_status] ON [dbo].[packing_commands] ([station_id], [status]);
END
GO

-- 11. WORKER EVENTS INBOX (Backend Deduplication Journal)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[worker_events_inbox]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[worker_events_inbox] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [event_id] VARCHAR(100) NOT NULL UNIQUE,
        [worker_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[workers]([id]) ON DELETE CASCADE,
        [session_id] VARCHAR(36) NULL REFERENCES [dbo].[packing_sessions]([id]),
        [event_type] VARCHAR(50) NOT NULL,
        [sequence_number] BIGINT NOT NULL,
        [payload] NVARCHAR(MAX) NOT NULL,
        [processed_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX [idx_inbox_worker_seq] ON [dbo].[worker_events_inbox] ([worker_id], [sequence_number]);
END
GO

-- 12. VIDEOS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[videos]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[videos] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [packing_session_id] VARCHAR(36) NOT NULL UNIQUE REFERENCES [dbo].[packing_sessions]([id]) ON DELETE CASCADE,
        [filename] NVARCHAR(255) NOT NULL,
        [local_path] NVARCHAR(MAX) NOT NULL,
        [nas_path] NVARCHAR(MAX) NULL,
        [duration] DECIMAL(8, 2) NOT NULL DEFAULT 0.0,
        [file_size] BIGINT NOT NULL DEFAULT 0,
        [sha256] VARCHAR(64) NOT NULL,
        [thumbnail_path] NVARCHAR(MAX) NULL,
        [sync_status] VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
        [sync_attempts] INT NOT NULL DEFAULT 0,
        [sync_error] NVARCHAR(MAX) NULL,
        [is_partial] BIT NOT NULL DEFAULT 0,
        [is_locked] BIT NOT NULL DEFAULT 0,
        [locked_by] VARCHAR(36) NULL REFERENCES [dbo].[users]([id]),
        [locked_at] DATETIME NULL,
        [lock_reason] NVARCHAR(MAX) NULL,
        [dispute_status] VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
        [purge_status] VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        [purged_at] DATETIME NULL,
        [version] INT NOT NULL DEFAULT 1,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX [idx_videos_sync_status] ON [dbo].[videos] ([sync_status]);
    CREATE INDEX [idx_videos_lock_purge] ON [dbo].[videos] ([is_locked], [purge_status]);
    CREATE INDEX [idx_videos_created_at] ON [dbo].[videos] ([created_at]);
END
GO

-- 13. STORAGE CONFIGS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[storage_configs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[storage_configs] (
        [id] VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT CONVERT(VARCHAR(36), NEWID()),
        [warehouse_id] VARCHAR(36) NOT NULL REFERENCES [dbo].[warehouses]([id]) ON DELETE CASCADE,
        [storage_type] VARCHAR(50) NOT NULL,
        [path] NVARCHAR(MAX) NOT NULL,
        [username] NVARCHAR(100) NULL,
        [password_encrypted] NVARCHAR(MAX) NULL,
        [retention_days] INT NOT NULL DEFAULT 90,
        [local_retention_days] INT NOT NULL DEFAULT 14,
        [enabled] BIT NOT NULL DEFAULT 1,
        [is_default] BIT NOT NULL DEFAULT 0,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- 14. SYSTEM LOGS
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[system_logs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[system_logs] (
        [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
        [business_id] VARCHAR(36) NULL REFERENCES [dbo].[businesses]([id]),
        [warehouse_id] VARCHAR(36) NULL REFERENCES [dbo].[warehouses]([id]),
        [level] VARCHAR(20) NOT NULL,
        [module] VARCHAR(50) NOT NULL,
        [message] NVARCHAR(MAX) NOT NULL,
        [metadata] NVARCHAR(MAX) NULL,
        [user_id] VARCHAR(36) NULL REFERENCES [dbo].[users]([id]),
        [station_id] VARCHAR(36) NULL REFERENCES [dbo].[stations]([id]),
        [created_at] DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX [idx_logs_module_level] ON [dbo].[system_logs] ([module], [level], [created_at]);
END
GO

-- ATOMIC TRIGGER: Single Active Session per Station (D01-01)
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_check_single_active_station_session')
    DROP TRIGGER trg_check_single_active_station_session;
GO

CREATE TRIGGER trg_check_single_active_station_session
ON [dbo].[packing_sessions]
FOR INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT station_id
        FROM [dbo].[packing_sessions]
        WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING', 'INDETERMINATE_TIMEOUT')
        GROUP BY station_id
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR ('ACTIVE_SESSION_EXISTS: Station already has an active or unverified recording session.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

-- ATOMIC TRIGGER: Single Active Session per Camera (D01-01)
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_check_single_active_camera_session')
    DROP TRIGGER trg_check_single_active_camera_session;
GO

CREATE TRIGGER trg_check_single_active_camera_session
ON [dbo].[packing_sessions]
FOR INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT camera_id
        FROM [dbo].[packing_sessions]
        WHERE status IN ('WAITING', 'RECORDING', 'PROCESSING', 'CANCELLING', 'INDETERMINATE_TIMEOUT')
        GROUP BY camera_id
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR ('ACTIVE_CAMERA_EXISTS: Camera already has an active recording session.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

-- Additive migration. Existing rows remain LEGACY until their physical owner is audited.
IF COL_LENGTH('dbo.videos', 'storage_owner') IS NULL
  ALTER TABLE dbo.videos ADD storage_owner VARCHAR(20) NOT NULL CONSTRAINT DF_videos_storage_owner DEFAULT 'LEGACY';
GO
IF COL_LENGTH('dbo.videos', 'drive_file_id') IS NULL
  ALTER TABLE dbo.videos ADD drive_file_id VARCHAR(200) NULL;
GO
