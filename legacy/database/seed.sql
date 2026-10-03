INSERT INTO Tenants (TenantCode, TenantName, DomainName, Status, ThemeConfig, ModuleAccess)
VALUES
('TENANT-ALPHA', 'Alpha Commerce', 'alpha.example.com', 'ACTIVE', '{"primary":"#2563eb","accent":"#10b981"}', '{"modules":["orders","inventory","reports"]}'),
('TENANT-BETA', 'Beta Retail', 'beta.example.com', 'ACTIVE', '{"primary":"#7c3aed","accent":"#f59e0b"}', '{"modules":["orders","customers","analytics"]}');

DECLARE @TenantAlphaId UNIQUEIDENTIFIER;
DECLARE @TenantBetaId UNIQUEIDENTIFIER;

SELECT @TenantAlphaId = TenantId FROM Tenants WHERE TenantCode = 'TENANT-ALPHA';
SELECT @TenantBetaId = TenantId FROM Tenants WHERE TenantCode = 'TENANT-BETA';

INSERT INTO Users (TenantId, Username, FullName, Email, PasswordHash, RoleName, IsActive)
VALUES
(@TenantAlphaId, 'admin.alpha', 'Nguyen Van A', 'admin.alpha@example.com', '$2a$12$dummyhash', 'SUPER_ADMIN', 1),
(@TenantBetaId, 'admin.beta', 'Tran Thi B', 'admin.beta@example.com', '$2a$12$dummyhash', 'SUPER_ADMIN', 1);
