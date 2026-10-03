-- PACKING VIDEO PROOF - DEFAULT SEED SCRIPT (SQL Server)
USE packing_proof_db;
GO

SET NOCOUNT ON;

-- 1. Default Business
DECLARE @bizId VARCHAR(36);
IF NOT EXISTS (SELECT 1 FROM businesses WHERE code = 'DEFAULT_BIZ')
BEGIN
    SET @bizId = CONVERT(VARCHAR(36), NEWID());
    INSERT INTO businesses (id, name, code, is_active)
    VALUES (@bizId, N'Default Fulfillment Hub', 'DEFAULT_BIZ', 1);
END
ELSE
BEGIN
    SELECT @bizId = id FROM businesses WHERE code = 'DEFAULT_BIZ';
END

-- 2. Default Roles
DECLARE @superAdminRoleId VARCHAR(36), @packerRoleId VARCHAR(36);

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'SUPER_ADMIN')
BEGIN
    SET @superAdminRoleId = CONVERT(VARCHAR(36), NEWID());
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (@superAdminRoleId, @bizId, 'SUPER_ADMIN', N'System Sovereign Administrator', '["*"]');
END
ELSE
    SELECT @superAdminRoleId = id FROM roles WHERE business_id = @bizId AND name = 'SUPER_ADMIN';

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'ADMIN')
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, 'ADMIN', N'Warehouse Administrator', '["warehouse:*"]');

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'WAREHOUSE_MANAGER')
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, 'WAREHOUSE_MANAGER', N'Warehouse Floor Supervisor', '["packing:*", "video:*"]');

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'PACKING_USER')
BEGIN
    SET @packerRoleId = CONVERT(VARCHAR(36), NEWID());
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (@packerRoleId, @bizId, 'PACKING_USER', N'Packing Station Operator', '["station:pack"]');
END
ELSE
    SELECT @packerRoleId = id FROM roles WHERE business_id = @bizId AND name = 'PACKING_USER';

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'CUSTOMER_SERVICE')
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, 'CUSTOMER_SERVICE', N'Customer Dispute Specialist', '["video:view", "video:dispute"]');

IF NOT EXISTS (SELECT 1 FROM roles WHERE business_id = @bizId AND name = 'VIEWER')
    INSERT INTO roles (id, business_id, name, description, permissions)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, 'VIEWER', N'Auditor Read-Only', '["video:view"]');

-- 3. Default Warehouse
DECLARE @whId VARCHAR(36);
IF NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'WH_CENTRAL_01')
BEGIN
    SET @whId = CONVERT(VARCHAR(36), NEWID());
    INSERT INTO warehouses (id, business_id, name, code, address, timezone, is_active)
    VALUES (@whId, @bizId, N'Kho Tổng Miền Bắc 01', 'WH_CENTRAL_01', N'KCN Tiên Sơn, Bắc Ninh', 'Asia/Ho_Chi_Minh', 1);
END
ELSE
    SELECT @whId = id FROM warehouses WHERE code = 'WH_CENTRAL_01';

-- 4. Default Users (Pass: Admin@123 / Packer@123)
-- SHA-256 for Admin@123: e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7
-- SHA-256 for Packer@123: 81fda2768fe0425c11d48d491f89906f7293dcdbe3bc36daabe9820a29a5cf48
IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin')
BEGIN
    INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, @whId, 'admin', 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7', N'Quản Trị Hệ Thống', 'admin@packingproof.local', @superAdminRoleId, 1);
END

IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'packer01')
BEGIN
    INSERT INTO users (id, business_id, warehouse_id, username, password_hash, full_name, email, role_id, is_active)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @bizId, @whId, 'packer01', '81fda2768fe0425c11d48d491f89906f7293dcdbe3bc36daabe9820a29a5cf48', N'Nguyễn Văn Đóng Gói', 'packer01@packingproof.local', @packerRoleId, 1);
END

-- 5. Default Station
DECLARE @stationId VARCHAR(36);
IF NOT EXISTS (SELECT 1 FROM stations WHERE code = 'PACK01')
BEGIN
    SET @stationId = CONVERT(VARCHAR(36), NEWID());
    INSERT INTO stations (id, warehouse_id, name, code, computer_name, ip_address, status)
    VALUES (@stationId, @whId, N'Trạm Đóng Gói Số 01', 'PACK01', 'PACK-PC-01', '192.168.1.51', 'ONLINE');
END
ELSE
    SELECT @stationId = id FROM stations WHERE code = 'PACK01';

-- 6. Default Worker
-- SHA-256 for st_secret_token_pack01: ede5a7dda3c757ae4289038733435dd54213c0078dc4ce11ba599675a78b77f9
IF NOT EXISTS (SELECT 1 FROM workers WHERE station_id = @stationId)
BEGIN
    INSERT INTO workers (id, station_id, token_hash, version, status, ip_address)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @stationId, 'ede5a7dda3c757ae4289038733435dd54213c0078dc4ce11ba599675a78b77f9', '1.0.0', 'ONLINE', '192.168.1.51');
END

-- 7. Default Camera
IF NOT EXISTS (SELECT 1 FROM cameras WHERE station_id = @stationId)
BEGIN
    INSERT INTO cameras (id, station_id, name, type, rtsp_url, username, status)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @stationId, 'CAM_PACK01', 'RTSP', 'rtsp://admin:CameraPass123@192.168.1.101:554/Streaming/Channels/101', 'admin', 'ONLINE');
END

-- 8. Default Storage Configurations
IF NOT EXISTS (SELECT 1 FROM storage_configs WHERE warehouse_id = @whId AND storage_type = 'LOCAL_TEMP')
    INSERT INTO storage_configs (id, warehouse_id, storage_type, path, retention_days, local_retention_days, enabled, is_default)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @whId, 'LOCAL_TEMP', 'D:\PackingVideoTemp', 1, 1, 1, 1);

IF NOT EXISTS (SELECT 1 FROM storage_configs WHERE warehouse_id = @whId AND storage_type = 'LOCAL_ARCHIVE')
    INSERT INTO storage_configs (id, warehouse_id, storage_type, path, retention_days, local_retention_days, enabled, is_default)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @whId, 'LOCAL_ARCHIVE', 'D:\PackingVideo', 90, 14, 1, 1);

IF NOT EXISTS (SELECT 1 FROM storage_configs WHERE warehouse_id = @whId AND storage_type = 'NAS_SHARE')
    INSERT INTO storage_configs (id, warehouse_id, storage_type, path, retention_days, local_retention_days, enabled, is_default)
    VALUES (CONVERT(VARCHAR(36), NEWID()), @whId, 'NAS_SHARE', '\\SERVER\PackingVideo', 90, 14, 1, 1);

PRINT N'Default Seed Applied Successfully!';
GO
