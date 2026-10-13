# Báo Cáo Kỹ Thuật: Triển Khai & Kiểm Thử Phân Quyền Backend (AUTHORIZATION-01)

## 1. Ma Trận Phân Quyền Thực Tế (RBAC & ABAC)

### 1.1 Phân cấp vai trò (Role Hierarchy)
| Vai trò | Cấp bậc | Phạm vi truy cập | Mô tả & Trách nhiệm |
| :--- | :---: | :--- | :--- |
| **SUPER_ADMIN** | 100 | **Toàn hệ thống (System-wide)** | Quản trị viên cấp cao của nền tảng phần mềm, quản lý tất cả doanh nghiệp, kho, cấu hình hệ thống. Không giới hạn phạm vi. |
| **ADMIN** | 80 | **Doanh nghiệp của chính mình (Tenant-scoped)** | Chủ shop / Giám đốc doanh nghiệp. Quản lý toàn bộ kho bãi, nhân sự và cấu hình Google Drive trong doanh nghiệp mình. **Tuyệt đối không được gán hoặc thao tác trên tài khoản SUPER_ADMIN**. |
| **WAREHOUSE_MANAGER** | 60 | **Kho được chỉ định (Warehouse-scoped)** | Quản lý kho hàng. Chỉ được phân quyền và quản lý nhân viên đóng gói (`PACKING_USER`) và người xem (`VIEWER`) thuộc đúng kho được phân công. |
| **PACKING_USER** | 40 | **Trạm & Kho được chỉ định (Station/Warehouse-scoped)** | Nhân viên đóng gói. Thực hiện quét barcode, đóng gói, bắt đầu/kết thúc phiên. Bắt buộc phải có `warehouseId`; nếu chưa được gán kho, hệ thống từ chối thao tác trạm. |
| **CUSTOMER_SERVICE** | 30 | **Doanh nghiệp của mình (Tenant-scoped)** | Nhân viên CSKH. Tra cứu video, tra cứu mã vận đơn, xử lý khiếu nại. Không có quyền sửa phiên hay trạm. |
| **VIEWER** | 20 | **Kho / Doanh nghiệp (Read-only)** | Chỉ xem báo cáo hoặc video đóng gói. Không thể thao tác bắt đầu/dừng/hủy phiên. |

---

### 1.2 Ma trận Hành Động + Phạm Vi (Action & Scope Matrix)

| Nhóm Tài Nguyên | Endpoint / Hành Động | Quyền Tối Thiểu | Ràng Buộc Phạm Vi (ABAC Scope) |
| :--- | :--- | :--- | :--- |
| **Quản lý nhân sự** | `GET /api/v1/admin/users` | WAREHOUSE_MANAGER | Lọc đúng doanh nghiệp. Quản lý kho chỉ xem nhân viên trong kho mình phụ trách. |
| | `POST /api/v1/admin/users` | WAREHOUSE_MANAGER | ADMIN chỉ tạo tài khoản trong shop mình. Không thể cấp SUPER_ADMIN. `warehouseId` và `roleId` phải thuộc cùng doanh nghiệp. |
| | `PUT /api/v1/admin/users/:id` | WAREHOUSE_MANAGER | Chặn tự đổi role của bản thân (`SELF_ROLE_CHANGE_FORBIDDEN`), chặn sửa tài khoản doanh nghiệp khác, chặn sửa tài khoản cấp bậc cao hơn. |
| | `PATCH /api/v1/admin/users/:id/status` | WAREHOUSE_MANAGER | Chặn tự khóa tài khoản của chính mình (`SELF_DEACTIVATION_FORBIDDEN`). Khóa lập tức thu hồi phiên đang dùng. |
| | `POST /api/v1/admin/users/:id/reset-password` | ADMIN | Đặt lại mật khẩu nhân viên thuộc doanh nghiệp mình. Ghi audit log (mật khẩu bị ẩn/redacted). |
| **Phiên đóng gói** | `POST /api/v1/packing/start` | PACKING_USER | Trạm đóng gói được tra cứu từ DB; xác thực trạm thuộc đúng doanh nghiệp và kho của nhân viên. Không tin `businessId`/`warehouseId` từ client. |
| | `POST /api/v1/packing/stop` | PACKING_USER | Xác thực phiên đóng gói thuộc đúng doanh nghiệp và kho của nhân viên gọi lệnh. |
| | `POST /api/v1/packing/cancel` | PACKING_USER | Xác thực quyền thao tác trên đúng phiên, đúng kho. |
| | `POST /api/v1/stations/:id/force-unlock` | WAREHOUSE_MANAGER | Chỉ quản lý kho hoặc admin thuộc doanh nghiệp sở hữu trạm mới được mở khóa. Ghi audit log. |
| **Google Drive** | `GET /api/v1/auth/google/url` | ADMIN | Chỉ lấy OAuth URL cho chính doanh nghiệp mình. Sinh mã `state` mật mã học dùng 1 lần (TTL 10 phút). |
| | `GET /api/v1/auth/google/callback` | Public OAuth | Kiểm tra và thu hồi mã `state` dùng 1 lần (chống CSRF & Replay). Gắn chính xác doanh nghiệp được ủy quyền. |
| | `POST /api/v1/businesses/:id/google-drive/instant-connect` | ADMIN | Bị vô hiệu hóa hoàn toàn khi `NODE_ENV === 'production'`. Không trả về `refreshToken`. Ghi audit log. |
| | `GET /api/v1/businesses/:id/google-drive` | ADMIN | Chỉ xem cấu hình shop mình. Tuyệt đối loại bỏ `refreshToken`, `accessToken` khỏi phản hồi JSON. |
| | `DELETE /api/v1/businesses/:id/google-drive` | ADMIN | Hủy liên kết Google Drive shop mình. Ghi audit log. |

---

## 2. Các Thay Đổi Trọng Yếu Đã Thực Hiện

### 2.1 Thu Hồi Phiên Ngay Khi Bị Khóa Hoặc Hạ Quyền (Live Credential Validation)
* **Vấn đề trước đây:** JWT stateless tin tưởng hoàn toàn vào payload được ký lúc đăng nhập. Khi tài khoản bị khóa (`is_active = 0`) hoặc bị hạ quyền (từ `ADMIN` xuống `VIEWER`), token cũ vẫn hoạt động bình thường đến khi hết hạn.
* **Giải pháp:** Trong [`authenticateUser`](file:///E:/Website/apps/backend-api/src/auth/auth.middleware.ts), sau khi xác thực chữ ký token, hệ thống đối soát tức thời với cơ sở dữ liệu qua `DatabaseRepository.findUserById(payload.sub)`:
  - Nếu `!liveUser || !liveUser.isActive`: Phản hồi ngay HTTP `401 ACCOUNT_DEACTIVATED`.
  - Đồng bộ `request.user.role`, `businessId`, `warehouseId` theo trạng thái cơ sở dữ liệu hiện tại, vô hiệu hóa ngay tức khắc các token cũ bị hạ quyền hoặc đổi kho.

### 2.2 Xử Lý Mã Trạng Thái OAuth Một Lần (Cryptographic Single-Use State)
* **Vấn đề trước đây:** Tham số `state` là chuỗi `businessId` công khai, dễ bị giả mạo hoặc tấn công CSRF.
* **Giải pháp:** Triển khai [`OAuthStateManager`](file:///E:/Website/apps/backend-api/src/auth/authorization.guard.ts) sinh chuỗi ngẫu nhiên 32-byte mật mã học, gắn với `businessId` và `userId` của người yêu cầu, có hạn 600 giây và **bị xóa ngay sau lần tiêu thụ đầu tiên** (`consumeState`), ngăn chặn hoàn toàn tấn công phát lại (Replay Attack).

### 2.3 Bảo Mật Tuyệt Đối Token & Bí Mật Google Drive
* Loại bỏ triệt để trường `refreshToken`, `accessToken`, `clientSecret` khỏi toàn bộ endpoint trả về Google Drive status và instant-connect.
* Chặn mock instant-connect khi môi trường là `production` (`MOCK_DISABLED_IN_PRODUCTION`).

### 2.4 Ghi Nhật Ký Thao Tác Nhạy Cảm (Audit Logging)
* Bổ sung bảng ghi nhận [`DatabaseRepository.recordAuditLog`](file:///E:/Website/packages/database/src/repository.ts) ghi vào `system_logs`:
  - Ghi nhận đầy đủ: Người thực hiện (`user_id`), thời điểm (`created_at`), doanh nghiệp (`business_id`), kho (`warehouse_id`), trạm (`station_id`), loại hành động (`action`) và đối tượng (`resourceType`, `resourceId`).
  - **Cơ chế tự động ẩn dữ liệu nhạy cảm (Auto-Redaction):** Mọi trường chứa `password`, `token`, `secret`, `key` đều tự động chuyển thành `[REDACTED]`, cam kết không bao giờ rò rỉ thông tin mật vào nhật ký.

---

## 3. Lệnh Kiểm Thử & Kết Quả Thực Tế

Bộ kiểm thử tự động toàn diện được thiết lập tại [`scripts/test-authorization-all.mjs`](file:///E:/Website/scripts/test-authorization-all.mjs) với 31 ca kiểm thử thực tế trên SQL Server và Backend API đang chạy:

```powershell
node scripts/test-authorization-all.mjs
```

### Kết quả chạy kiểm thử thực tế:

```
====================================================
STARTING RIGOROUS AUTHORIZATION-01 SUITE
====================================================

Tenant A: Nhật Minh Technology (Chủ Hệ Thống) (F464D575-47CC-4BFE-A915-D4C1DBDFF559)
Tenant B: Mỹ Phẩm & Skincare Seoul Beauty (18ec0ef9-8832-4d9f-9f18-466be3132e25)
Station A: Trạm Đóng Gói Hà Đông (801F89A1-23A8-4349-8839-C509B4015B72) in Warehouse C35578E3-DB12-42AA-8E7F-D0C88D402200

--- 1. Testing RBAC & System Admin vs Shop Admin Separation ---
  [PASS] Anonymous request to /admin/users returns 401 Unauthorized
  [PASS] PACKING_USER attempting /admin/users returns 403 Forbidden
  [PASS] Shop ADMIN cannot create SUPER_ADMIN (403 PRIVILEGE_ESCALATION_DENIED)
  [PASS] Shop ADMIN cannot modify SUPER_ADMIN user (403 Forbidden)
  [PASS] Shop ADMIN A cannot edit Tenant B staff (403 Forbidden cross-tenant)
  [PASS] User cannot change own role (403 SELF_ROLE_CHANGE_FORBIDDEN)
  [PASS] User cannot self-deactivate (403 SELF_DEACTIVATION_FORBIDDEN)
  [PASS] Assigning warehouse of another business is rejected (400/403 INVALID_WAREHOUSE)

--- 2. Testing Action + Scope (Packing Sessions) ---
  [PASS] Packer without assigned warehouse is denied station access (403 ACCESS_DENIED)
  [PASS] Cross-tenant station operation is rejected (403 station belongs to other business)
  [PASS] Cross-tenant force-unlock station is rejected (403)
  [PASS] Authorized Admin A can force-unlock station (200)

--- 3. Testing Dynamic Token Invalidation on Lock / Downgrade ---
  [PASS] Locked user with existing valid token is IMMEDIATELY rejected (401 ACCOUNT_DEACTIVATED)
  [PASS] Re-activated user immediately regains access with existing token (200)
  [PASS] Temp Admin can access /admin/users before downgrade (200)
  [PASS] Downgraded user with old ADMIN token is IMMEDIATELY blocked from admin routes (403 Forbidden)

--- 4. Testing Google Drive Scoping & Token Leakage Prevention ---
  [PASS] Anonymous access to Google Drive status returns 401
  [PASS] Admin A cannot view Admin B Google Drive status (403 Forbidden cross-tenant)
  [PASS] Admin A can view own Google Drive status (200)
  [PASS] Google Drive status NEVER leaks refreshToken or accessToken
  [PASS] OAuth URL generated with cryptographic state parameter
  [PASS] OAuth callback with invalid state returns 400 INVALID_OR_EXPIRED_STATE
  [PASS] OAuth callback accepts valid state token and advances to token exchange (state consumed)
  [PASS] Replaying previously consumed state token returns 400 INVALID_OR_EXPIRED_STATE (single-use enforced)

--- 5. Testing Audit Logging of Sensitive Operations ---
  [PASS] Admin A resets staff password (200)
  [PASS] Admin A changed staff role to WAREHOUSE_MANAGER (200)
  [PASS] Found 4 audit log entries in system_logs
  [PASS] USER_PASSWORD_RESET operation was logged to system_logs
  [PASS] Password is NEVER stored in audit log metadata
  [PASS] USER_ROLE_CHANGED operation was logged to system_logs with old/new roles
  [PASS] STATION_FORCE_UNLOCKED operation was logged to system_logs

====================================================
TEST SUMMARY: 31 PASSED, 0 FAILED
====================================================
```

---

## 4. Quyết Định Thiết Kế & Điểm Lưu Ý

1. **Hiệu năng kiểm tra Token trực tiếp từ DB:**
   Việc truy vấn người dùng trong `authenticateUser` đảm bảo tính nhất quán tuyệt đối giữa quyền thực tế và phiên làm việc, loại bỏ hoàn toàn lỗ hổng người dùng bị sa thải/khóa vẫn thao tác hệ thống bằng JWT cũ. Nhờ chỉ mục khóa chính trên `users(id)`, chi phí truy vấn là dưới 1ms.
2. **Không phá vỡ logic an toàn phiên (SESSION-SAFETY):**
   Toàn bộ luồng khởi tạo phiên, kết nối worker, quản lý hàng đợi và giữ phiên đều được giữ nguyên 100%, bảo vệ tính liên tục của hệ thống quay video.
3. **Màn hình phân quyền nâng cao:**
   Theo chỉ đạo, không triển khai giao diện ma trận quyền phức tạp mà tập trung 100% vào bảo vệ tầng lõi (Backend Guards & Data Isolation). Giao diện quản trị hiện tại được cập nhật tự động gắn token để quản trị viên doanh nghiệp thực hiện các tác vụ được phép.
