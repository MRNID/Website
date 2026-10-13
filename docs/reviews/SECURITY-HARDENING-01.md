# Review packet: SECURITY-HARDENING-01

## Mục tiêu và phạm vi
- **Hành vi/quyết định cần đạt**:
  Xử lý triệt để 3 vấn đề bảo mật và tính toàn vẹn do Codex phát hiện theo `docs/AI_WORKFLOW.md`:
  1. **Upload mobile thiếu xác thực & phân tách phạm vi** (`apps/backend-api/src/routes/mobile.routes.ts`): Bắt buộc xác thực JWT phiên đăng nhập, trích xuất danh tính từ token (`user.sub`), kiểm tra trạm/kho thuộc đúng doanh nghiệp (`businessId`, `warehouseId`), kiểm tra `stationCode` và chặn triệt để path traversal ra ngoài thư mục lưu trữ video.
  2. **WebSocket trạm thiếu xác thực và phân tách doanh nghiệp** (`apps/backend-api/src/main.ts`, `apps/backend-api/src/websocket/station-gateway.ts`): Bắt buộc xác thực handshake WebSocket (`?token=...` hoặc headers), kiểm tra trạng thái hoạt động tài khoản trực tiếp từ database, phân tách luồng sự kiện theo doanh nghiệp/kho/trạm, chủ động ngắt kết nối WebSocket (mã 4001) ngay khi tài khoản bị khóa (`isActive: false`), thay đổi vai trò hoặc đổi kho.
  3. **Validator chấp nhận mã vận đơn không hợp lệ** (`packages/shared-utils/src/barcode-validator.ts`): Bỏ fallback tự động chấp nhận mọi chuỗi không rỗng và loại bỏ logic sinh mã giả; áp dụng chuẩn regex các hãng vận chuyển (SPX, TikTok, Lazada, GHTK, GHN, J&T, Viettel Post) và mã chuẩn `OTHER` (tối thiểu 6 ký tự, 6–32 ký tự alphanumeric/dash/underscore); sửa lỗi unit test với mã `'123'`.
- **Tiêu chí nghiệm thu**:
  - Truy cập ẩn danh vào Mobile Upload hoặc WebSocket trạm bị từ chối 401 Unauthorized.
  - Truy cập chéo doanh nghiệp (tài khoản thuộc Shop B gọi trạm/sự kiện của Shop A) bị từ chối 403 Forbidden / Access Denied.
  - Mã trạm chứa ký tự path traversal (`../`, `..\`) bị chặn 400 Bad Request.
  - Mã vận đơn không hợp lệ (`'123'`, ký tự đặc biệt, chuỗi rỗng) bị từ chối 400 INVALID_BARCODE_FORMAT.
  - Đóng tài khoản / thu hồi quyền lập tức đá phiên WebSocket trạm (code 4001).
  - Toàn bộ monorepo build thành công (`pnpm -r build`), 100% test bảo mật và unit test vượt qua.
- **Loại**: Sửa finding / Security Hardening / API Integration
- **Rủi ro và lý do**:
  - Nguy cơ lộ dữ liệu đơn hàng và video quay đóng gói giữa các shop thương mại điện tử nếu WebSocket không phân tách tenant.
  - Nguy cơ ghi đè hoặc can thiệp hệ thống tệp nếu upload cho phép path traversal qua `stationCode`.
  - Nguy cơ sai lệch đối soát khi nhận mã vận đơn rác hoặc mã giả định dạng.

---

## Mốc review
- **Base Commit**: `6c9f9f5bf273076a62769fd9e1cf88ab69604b2d`
- **Head**: Working Tree (đã tích hợp các sửa đổi)
- **Nhánh**: `master`
- **Tệp chưa commit/untracked trong phạm vi**:
  - `apps/backend-api/src/routes/mobile.routes.ts` (Sửa đổi & gia cố auth/path traversal)
  - `apps/backend-api/src/websocket/station-gateway.ts` (Nâng cấp xác thực, multi-tenant isolation, revoke socket)
  - `apps/backend-api/src/main.ts` (Bổ sung upgrade guard cho `/ws/station` kiểm tra token & station scope)
  - `apps/backend-api/src/routes/user.routes.ts` (Kích hoạt `StationGateway.revokeUser` khi lock/đổi quyền user)
  - `apps/user-web/src/hooks/useStationWebSocket.ts` (Gửi token qua query param & xử lý mã đóng 4001)
  - `apps/user-web/src/hooks/useMobileStationSync.ts` (Hook đồng bộ trạm động, khóa mid-flight, state machine)
  - `apps/user-web/src/components/MobilePackingWorkbench.tsx` (Bỏ hardcode PACK01, khóa nút khi chưa có trạm, đồng bộ trạm tải chậm)
  - `packages/shared-utils/src/station-sync.ts` (Hàm pure `computeNextStationCode` đồng bộ trạm không fallback PACK01)
  - `packages/shared-utils/src/station-sync.test.ts` (Unit test 5 kịch bản lifecycle trạm mobile)
  - `packages/shared-utils/src/barcode-validator.ts` (Bỏ fallback lỏng lẻo, siết chặt regex & độ dài >= 6)
  - `packages/shared-utils/src/barcode-validator.test.ts` (Thêm test case kiểm thử mã không hợp lệ)
  - `scripts/test-security-hardening.mjs` (Bộ test tự động kiểm thử 36 tình huống bảo mật & mobile lifecycle)
  - `docs/reviews/SECURITY-HARDENING-01.md` (Tài liệu review packet này)
- **Hợp đồng/đặc tả áp dụng**:
  - `docs/AI_WORKFLOW.md`
  - `docs/REVIEW_PACKET_TEMPLATE.md`

---

## Thay đổi và ảnh hưởng

| Tệp/module | Thay đổi | Caller/consumer/dữ liệu bị ảnh hưởng |
| --- | --- | --- |
| `packages/shared-utils/src/station-sync.ts` | Triển khai pure function `computeNextStationCode(currentActive, stationCodeProp, stationsProp, isLocked)`: tuyệt đối không hardcode `'PACK01'`, khởi đầu rỗng khi danh sách chưa tải; tự động chuyển sang trạm đầu tiên hợp lệ khi danh sách trạm tải xong (kể cả trạm khác PACK01 như PACK02); giữ nguyên lựa chọn của user nếu trạm vẫn hợp lệ; khóa chuyển trạm khi `isLocked = true`. | Phục vụ logic đồng bộ trạm trên mobile client và bộ test tự động. |
| `packages/shared-utils/src/station-sync.test.ts` | 5 unit tests độc lập chạy qua `node --test` kiểm tra: render đầu không sinh `'PACK01'`, tải bất đồng bộ trạm `'PACK02'` tự chuyển sang `'PACK02'`, giữ lựa chọn user, khóa chuyển trạm khi đang quay/upload, fallback an toàn khi trạm bị xóa. | Tích hợp vào lệnh `pnpm test`. |
| `apps/user-web/src/hooks/useMobileStationSync.ts` | Hook đồng bộ trạm `useMobileStationSync`: bọc `computeNextStationCode` với React state/effect; cung cấp `isValidStation` và `statusMessage`; chặn `setActiveStationCode` khi đang quay hoặc upload. | Được sử dụng trực tiếp bởi `MobilePackingWorkbench.tsx`. |
| `apps/user-web/src/components/MobilePackingWorkbench.tsx` | Bỏ hoàn toàn fallback `'PACK01'` cứng; tích hợp hook `useMobileStationSync`; vô hiệu hóa nút Bắt đầu đóng đơn và nút Native Camera (`disabled={!isValidStation}`) khi trạm chưa sẵn sàng; hiển thị `statusMessage` trên watermark ribbon; khóa dropdown trạm khi đang quay hoặc upload. | Giao diện đóng gói Mobile. Đảm bảo an toàn không upload sai trạm hoặc dính 403 khi kho chỉ có trạm khác PACK01. |
| `packages/shared-utils/src/barcode-validator.ts` | Bỏ demo fallback tạo mã `TEST_...` và chấp nhận chuỗi ngắn; yêu cầu độ dài tối thiểu 6 ký tự, kiểm tra các regex carrier (SPX, TikTok, Lazada, GHTK, GHN, J&T, Viettel Post) và chuẩn `OTHER` regex `^[A-Z0-9\-_]{6,32}$`. | User Web barcode scan, Backend API mobile upload, Packing route. Đảm bảo mã bậy hoặc mã < 6 ký tự lập tức bị từ chối. |
| `packages/shared-utils/src/barcode-validator.test.ts` | Sửa unit test: kiểm tra mã `'123'` bị từ chối (`isValid: false`); bổ sung test mã rỗng, khoảng trắng, ký tự đặc biệt, và mã hợp lệ SPX, TikTok, GHTK, OTHER. | Chạy qua `node --test packages/shared-utils/dist/barcode-validator.test.js`. |
| `apps/backend-api/src/routes/mobile.routes.ts` | Thêm preHandlers `[authenticateUser, requireRoles(...)]`. Lấy `userId = request.user.sub`. Xác thực trạm qua `resolveAndVerifyStationByCode` đảm bảo trạm thuộc doanh nghiệp & kho của user. Kiểm tra `validateAndCleanBarcode`. Chặn path traversal trên thư mục trạm và tệp đích bằng `path.relative(resolvedBase, target)`. Gán đúng `stationId` vào `createMobilePackingSessionTx`. | App Mobile / Web Mobile upload video đóng gói. Ngăn chặn triệt để upload ẩn danh, upload chéo shop, mã vận đơn giả mạo, ghi đè file ngoài thư mục archive. |
| `apps/backend-api/src/websocket/station-gateway.ts` | Thiết kế lại `StationGateway`: Lưu trữ metadata phiên kết nối (`userId`, `role`, `businessId`, `warehouseId`, `subscribedStationId`). Hàm `broadcast` lọc danh sách client theo phạm vi doanh nghiệp/kho/trạm. Hàm `revokeUser(userId)` ngắt kết nối với mã 4001. Thêm chu kỳ kiểm tra ngầm định kỳ 15s (`revalidateAllClients`) đối soát trực tiếp database để phát hiện tài khoản bị khóa giữa chừng. | WebSocket trạm `/ws/station`. Tránh rò rỉ sự kiện đóng gói giữa các doanh nghiệp. |
| `apps/backend-api/src/main.ts` | Gia cố HTTP upgrade handler `/ws/station`: Bắt buộc token JWT hợp lệ, đối soát tài khoản sống trong database (`findUserById`), xác thực quyền truy cập trạm bằng `resolveAndVerifyStationAccess` hoặc `resolveAndVerifyStationByCode` nếu client truyền `stationId`/`stationCode`. Từ chối 401 nếu thiếu/sai token, từ chối 403 nếu cố tình đăng ký trạm ngoài doanh nghiệp. | User Web desktop và các client trạm kết nối WebSocket. |
| `apps/backend-api/src/routes/user.routes.ts` | Tích hợp gọi `StationGateway.revokeUser(id)` khi Admin khóa tài khoản (PATCH status `isActive: false`) hoặc cập nhật user (PUT user với role mới, warehouse mới, password mới hoặc deactivate). | Ngay khi Admin thao tác khóa nhân viên, phiên WebSocket của nhân viên đó lập tức bị ngắt. |
| `apps/user-web/src/hooks/useStationWebSocket.ts` | Truyền `&token=${token}` lấy từ `localStorage.getItem('token')` trong URL WebSocket. Bổ sung bắt sự kiện đóng kết nối với mã `4001` (thu hồi quyền) để tự động điều hướng về màn hình đăng nhập. | Giao diện User Web khi kết nối vào WebSocket server. |
| `apps/user-web/src/App.tsx` | Truyền `stationCode={currentStation?.code}` và `stations={stations}` sang `MobilePackingWorkbench`. | Giao diện User Web khi chuyển sang chế độ Mobile. |
| `apps/backend-api/src/websocket/worker-gateway.ts` | Cập nhật handler `SYNC_STATUS_CHANGED`: resolve station scope của worker và gọi `StationGateway.broadcast` với đầy đủ `{ businessId, warehouseId, stationId }`. | Video Worker daemon khi hoàn tất đồng bộ video lên NAS/Drive. Ngăn chặn phát tán trạng thái video sang các tenant khác. |
| `scripts/test-security-hardening.mjs` | Kịch bản kiểm thử bảo mật chuyên sâu gồm 36 test case tự động bao phủ toàn diện các vấn đề ban đầu, 3 finding Codex R1 (SH-R1-01, SH-R1-02, SH-R1-03) và finding Codex R2 (SH-R1-01 tiếp tục về mobile async station load với PACK02). | Kiểm chứng tự động tích hợp CI/CD và review độc lập. |

---

## Bằng chứng kiểm tra

| Lệnh hoặc kịch bản | Môi trường + mốc code | Kết quả thực tế | Chi tiết / Bằng chứng |
| --- | --- | --- | --- |
| `npx pnpm --filter @packing-proof/shared-utils build` & `npx pnpm test` | Node v24.15.0, Windows | **PASS** (15 pass, 0 fail) | 15 unit tests cho Barcode Validator, Filename Hash utils và Mobile Station Synchronization lifecycle đều vượt qua 100%. |
| `npx pnpm -r build` | Node v24.15.0, Windows | **PASS** (7 of 8 packages built) | Tất cả packages (`shared-types`, `shared-utils`, `database`, `backend-api`, `user-web`, `video-worker`, `admin-web`) biên dịch TypeScript & Vite thành công, 0 lỗi cú pháp. |
| `node scripts/test-authorization-all.mjs` | Node v24.15.0, Windows, Port 4000 | **PASS** (31 pass, 0 fail) | Bộ test RBAC, Action + Scope, Invalidation token, Google Drive token leak prevention, và Audit logging đều đạt 100%. |
| `node scripts/test-security-hardening.mjs` | Node v24.15.0, Windows, Port 4000 | **PASS** (36 pass, 0 fail) | Chi tiết 36/36 kiểm thử bảo mật (bao gồm test case mới cho SH-R1-01 lifecycle & upload PACK02) xem bên dưới. |

### Kết quả chi tiết kịch bản `scripts/test-security-hardening.mjs` (36/36 PASS):
```text
===============================================================
  SECURITY HARDENING VERIFICATION TEST SUITE (CODEX REVIEW)   
===============================================================

[Config] Station A: PACK01 (Business: Nhật Minh Technology (Chủ Hệ Thống), ID: F464D575-47CC-4BFE-A915-D4C1DBDFF559)
[Config] User A: packer01 (Business: F464D575-47CC-4BFE-A915-D4C1DBDFF559)
[Config] User B: packer_genz01 (Business: dc587f70-9c97-4149-a938-f56e76570689)
[Config] Station B: PACK_TENANT_B (Business: dc587f70-9c97-4149-a938-f56e76570689)

--- SECTION 1: MOBILE UPLOAD SECURITY ---
  [PASS] 1.1 Anonymous upload rejected with HTTP 401 UNAUTHORIZED (got 401)
  [PASS] 1.2 Forged JWT upload rejected with HTTP 401 UNAUTHORIZED (got 401: TOKEN_EXPIRED_OR_INVALID)
  [PASS] 1.3 Cross-tenant upload rejected with HTTP 403 ACCESS_DENIED (got 403: Trạm đóng gói thuộc doanh nghiệp khác. Truy cập bị từ chối)
  [PASS] 1.4 Path traversal in stationCode strictly blocked (sanitized / rejected)
  [PASS] 1.5 Invalid tracking barcodes ('123', short, symbols) rejected with 400 INVALID_BARCODE_FORMAT
  [PASS] 1.6 Authorized mobile upload with valid barcode succeeded (Session: 6a969a5d-9c9d-4b52-8c97-0d7be551924d)
  [PASS] 1.6b Database session user_id matches authenticated user (15F0FC23-A0EF-41B8-A185-FA2E7AD5F042 === 15F0FC23-A0EF-41B8-A185-FA2E7AD5F042)
  [PASS] 1.6c Database session station_id matches verified station (801F89A1-23A8-4349-8839-C509B4015B72 === 801F89A1-23A8-4349-8839-C509B4015B72)
  [PASS] 1.7a [SH-R1-01] Initial mobile mount with empty stations list starts empty (got "", not "PACK01")
  [PASS] 1.7b [SH-R1-01] Asynchronous station load dynamically transitions activeStationCode to "PACK02"
  [PASS] 1.7c [SH-R1-01] User selection "MOBILE01" preserved when stations list refreshes
  [PASS] 1.7d [SH-R1-01] Station change strictly locked during active recording / uploading (kept "PACK02")
  [PASS] 1.8a [SH-R1-01] Authorized mobile upload to station "PACK02" succeeded (Session: a736dd5c-eb93-4198-867b-0c82323bd2fd)
  [PASS] 1.8b [SH-R1-01] Database session station_id matches PACK02 (D1E2F3A4-B5C6-4D7E-8F9A-0B1C2D3E4F5A === D1E2F3A4-B5C6-4D7E-8F9A-0B1C2D3E4F5A)

--- SECTION 2: WEBSOCKET AUTHENTICATION & MULTI-TENANT ISOLATION ---
  [PASS] 2.1 Anonymous WebSocket connection rejected with HTTP 401 (got 401)
  [PASS] 2.2 Forged JWT WebSocket connection rejected with HTTP 401 (got 401)
  [PASS] 2.3 Cross-tenant WebSocket connection rejected with HTTP 403 (got 403)
  [PASS] 2.4 Authorized WebSocket handshake succeeds for PACK01
  [PASS] 2.5a Authorized WebSocket handshake succeeds for Station B (PACK_TENANT_B)
  [PASS] 2.5b Client A (Station A) received the SESSION_STATE_CHANGED broadcast event
  [PASS] 2.5c Client B (Station B / Tenant B) did NOT receive the event (Tenant isolated)
  [PASS] 2.6a Admin API locked user packer01
  [PASS] 2.6b Active WebSocket session terminated immediately with code 4001 upon lock (got code 4001, reason: "Tài khoản đã bị khóa bởi quản trị viên")
  [Config] Restored user packer01 to active status.

--- SECTION 3: BARCODE VALIDATOR STRICTNESS ---
  [PASS] 3.1 Short code '123' is rejected (isValid: false)
  [PASS] 3.2 Empty string is rejected (isValid: false)
  [PASS] 3.3 Custom alphanumeric code >= 6 chars is valid OTHER
  [PASS] 3.4 Shopee Express (SPX) format correctly identified
  [PASS] 3.5 Barcode with illegal spaces rejected

--- SECTION 4: CODEX R1 VERIFICATION (SH-R1-01, SH-R1-02, SH-R1-03) ---
  [PASS] 4.1 [SH-R1-01] Mobile upload missing Authorization header rejected with 401 UNAUTHORIZED
  [PASS] 4.2 [SH-R1-01] Mobile upload with Bearer token & dynamic stationCode (PACK01) succeeds with 200 OK
  [PASS] 4.3a [SH-R1-02] Broadcast missing scope is dropped immediately (0 messages delivered across all tenants)
  [PASS] 4.3b [SH-R1-02] Broadcast missing businessId is dropped immediately (0 messages delivered across all tenants)
  [PASS] 4.3c [SH-R1-02] Client of Tenant A received SYNC_STATUS_CHANGED event
  [PASS] 4.3d [SH-R1-02] Client of Tenant B did NOT receive Tenant A's SYNC_STATUS_CHANGED (Isolated)
  [PASS] 4.4a [SH-R1-03] Operational user with warehouseId: null rejected at WebSocket handshake with HTTP 403 Forbidden
  [PASS] 4.4b [SH-R1-03] Operational client with warehouseId: null strictly blocked from receiving warehouse events

===============================================================
TEST RESULTS: 36 PASSED, 0 FAILED
===============================================================
```

### Kịch bản lỗi và biên đã thử:
1. Đăng nhập nặc danh và token giả mạo: Bị từ chối ngay ở HTTP handshake hoặc Fastify preHandler.
2. Cross-tenant access: User của Tenant B không thể gọi API upload của trạm thuộc Tenant A, không thể subscribe WebSocket trạm thuộc Tenant A, và không thể nhận bất kỳ sự kiện nào phát ra từ Tenant A.
3. Path traversal attack: Chuỗi `../../secret`, `..\windows\system32`, `PACK01/../../` bị chặn hoàn toàn qua kiểm tra chuẩn hóa đường dẫn `path.relative(resolvedBase, target)`.
4. Barcode edge cases: Chuỗi rỗng `""`, chuỗi ngắn `"123"`, khoảng trắng `"   "`, ký tự có space `"TEST CODE"`, ký tự đặc biệt `"SPX!@#$%"` đều bị từ chối với mã lỗi `INVALID_BARCODE_FORMAT`.
5. Đóng quyền tức thời: Khi tài khoản bị đổi trạng thái `isActive: false` qua Admin API, socket đang mở bị đóng ngay lập tức với mã 4001 mà không cần chờ JWT hết hạn.
6. **Kiểm tra phát hiện Codex R1**:
   - `SH-R1-01`: Client Mobile upload gửi kèm `Authorization: Bearer <token>`, trích xuất mã trạm động và trạm hợp lệ của kho thay vì `'MOBILE01'` cứng.
   - `SH-R1-02`: Broadcast thiếu scope hoặc thiếu `scope.businessId` bị hủy (drop) ngay lập tức, không còn phát tán sang các doanh nghiệp khác; `SYNC_STATUS_CHANGED` từ `WorkerGateway` được cấp đầy đủ `{ businessId, warehouseId, stationId }`.
   - `SH-R1-03`: Nhân viên vận hành (`PACKING_USER`, `WAREHOUSE_MANAGER`) chưa được phân bổ kho (`warehouseId: null`) bị từ chối kết nối WebSocket ngay tại handshake (HTTP 403 Forbidden); bộ lọc broadcast trong gateway chặn tuyệt đối việc nhận sự kiện kho của nhân viên chưa gán kho.
7. **Kiểm tra phát hiện Codex R2 (SH-R1-01 tiếp tục)**:
   - Khi component Mobile mount lần đầu (`stations = []`, `stationCode = undefined`), state `activeStationCode` khởi đầu là `''` (rỗng), tuyệt đối không gán `PACK01` cứng.
   - Nút "Bắt đầu đóng đơn" và "Quay bằng camera iPhone (Native)" bị vô hiệu hóa (`disabled={!isValidStation}`) kèm dòng chữ báo trạng thái `"ĐANG TẢI TRẠM ĐÓNG GÓI..."` hoặc `"CHƯA CÓ TRẠM ĐƯỢC CHỌN"`.
   - Khi `initApp()` tải bất đồng bộ xong danh sách trạm từ máy chủ trả về trạm khác `PACK01` (ví dụ `PACK02`), hook `useMobileStationSync` và pure function `computeNextStationCode` lập tức kích hoạt transition sang `PACK02`.
   - Lựa chọn thủ công của người dùng được giữ nguyên nếu trạm đó vẫn còn hợp lệ trong danh sách mới.
   - Khi đang quay (`isRecording = true`) hoặc đang tải video lên máy chủ (`isUploading = true`), cơ chế khóa `isLocked` ngăn chặn triệt để việc đổi trạm giữa chừng (cả từ dropdown lẫn từ prop server đẩy lại).
   - Test thực tế `PACK02`: Upload multipart gửi `stationCode: 'PACK02'` thành công (HTTP 200) và bản ghi database `packing_sessions.station_id` khớp chính xác với ID của trạm `PACK02`.

### Giới hạn CHƯA XÁC MINH (Tuân thủ nghiêm ngặt quy định AI_WORKFLOW.md):
- **Phần cứng camera vật lý & luồng RTSP thực tế**: Được mô phỏng thông qua upload multipart HTTP và WebSocket mock frames. Chưa kiểm chứng trên ống kính camera IP / USB vật lý tại trạm đóng gói.
- **Mất kết nối mạng vật lý (rút dây mạng LAN / mất Internet cục bộ)**: Chưa kiểm nghiệm hành vi kết nối lại của webcam ngoài đời thực khi mất mạng đột ngột giữa chừng.
- **Sập nguồn phần cứng máy tính trạm và phục hồi sự cố crash recovery đột ngột**: Chưa kiểm chứng tắt nguồn đột ngột máy tính chạy worker trên môi trường thực tế.

---

## Vòng sửa Codex R1 (SH-R1-01 đến SH-R1-03)

| Finding ID / Mô tả | Cách xử lý | Mốc sửa / Tệp | Bằng chứng kiểm tra |
| --- | --- | --- | --- |
| **SH-R1-01** (P1): Client mobile không gửi token cho API vừa bắt buộc xác thực & hardcode `MOBILE01` | 1. Bổ sung `headers: { 'Authorization': `Bearer ${token}` }` khi gọi `/api/v1/mobile/upload` và `/businesses/${bizId}/google-drive`.<br>2. Bổ sung props `stationCode` và `stations` vào `MobilePackingWorkbench`, cho phép hiển thị và chọn trạm của kho thay cho mã `MOBILE01` cứng.<br>3. Truyền `stationCode={currentStation?.code}` và `stations={stations}` từ `App.tsx`.<br>4. Xử lý lỗi 401 (báo phiên hết hạn) và 403 (báo quyền trạm). | `apps/user-web/src/components/MobilePackingWorkbench.tsx`<br>`apps/user-web/src/App.tsx` | `scripts/test-security-hardening.mjs` test 4.1 & 4.2 (PASS). Monorepo build PASS. |
| **SH-R1-02** (P1): Broadcast thiếu scope vẫn gửi đến mọi doanh nghiệp | 1. Trong `StationGateway.broadcast`: Bắt buộc kiểm tra `if (!scope \|\| !scope.businessId) return;` — hủy ngay lập tức các sự kiện thiếu scope doanh nghiệp.<br>2. Trong `StationGateway.broadcastSessionState`: Bổ sung kiểm tra `if (!businessId) return;` hủy gửi nếu không thể resolve được phạm vi trạm.<br>3. Trong `WorkerGateway:149`: Cập nhật sự kiện `SYNC_STATUS_CHANGED` resolve `stScope = await StationGateway.resolveStationScope(worker.stationId)` và truyền đầy đủ `{ businessId, warehouseId, stationId }`. | `apps/backend-api/src/websocket/station-gateway.ts`<br>`apps/backend-api/src/websocket/worker-gateway.ts` | `scripts/test-security-hardening.mjs` test 4.3a - 4.3d (Unscoped & Partial scope dropped; SYNC_STATUS_CHANGED isolated 100% giữa Tenant A và Tenant B). |
| **SH-R1-03** (P1): Nhân viên chưa gán kho có thể nhận sự kiện của các kho trong doanh nghiệp | 1. Trong `apps/backend-api/src/main.ts`: Kiểm tra tại handshake WebSocket upgrade: nếu vai trò là `PACKING_USER` hoặc `WAREHOUSE_MANAGER` mà `!userWhId` thì trả về HTTP 403 Forbidden ngay lập tức.<br>2. Trong `StationGateway.broadcast`: Cập nhật điều kiện lọc kho: nếu client là `PACKING_USER` hoặc `WAREHOUSE_MANAGER` mà `!client.warehouseId` thì bỏ qua (continue) không gửi bất kỳ sự kiện kho nào. | `apps/backend-api/src/main.ts`<br>`apps/backend-api/src/websocket/station-gateway.ts` | `scripts/test-security-hardening.mjs` test 4.4a & 4.4b (Handshake từ chối HTTP 403; In-memory broadcast loại bỏ hoàn toàn client null warehouse). |

---

## Vòng sửa Codex R2 (SH-R1-01 tiếp tục)

| Finding ID / Mô tả | Cách xử lý | Mốc sửa / Tệp | Bằng chứng kiểm tra |
| --- | --- | --- | --- |
| **SH-R1-01 (tiếp)** (P2): Mobile giữ `PACK01` sau khi tải xong danh sách trạm | 1. Xây dựng pure state machine `computeNextStationCode`: không dùng mã fallback cứng `PACK01`, khởi đầu rỗng `''` khi danh sách trạm chưa về.<br>2. Tách hook tái sử dụng `useMobileStationSync` với `useEffect` tự động đồng bộ khi `stations` hoặc `stationCode` cập nhật bất đồng bộ sau mount.<br>3. Khóa nút quay/upload khi chưa có trạm hợp lệ (`!isValidStation`).<br>4. Khóa đổi trạm giữa chừng khi đang quay (`isRecording`) hoặc đang tải (`isUploading`).<br>5. Watermark ribbon hiển thị trạng thái trạm động (`statusMessage`). | `packages/shared-utils/src/station-sync.ts`<br>`packages/shared-utils/src/station-sync.test.ts`<br>`apps/user-web/src/hooks/useMobileStationSync.ts`<br>`apps/user-web/src/components/MobilePackingWorkbench.tsx` | 1. `pnpm test`: 15/15 PASS (bao gồm 5 unit tests chuyên biệt cho lifecycle trạm mobile).<br>2. `scripts/test-security-hardening.mjs`: Test 1.7a - 1.7d kiểm chứng chu trình chuyển đổi trạm không dính `PACK01`, tự cập nhật sang `PACK02`, giữ lựa chọn user và khóa khi recording.<br>3. Test 1.8a - 1.8b: Upload thực tế mobile với trạm `PACK02` (khác `PACK01`), xác nhận session DB lưu đúng `station_id` của `PACK02`.<br>4. `pnpm -r build`: 7/7 projects build PASS. |

---

## Bàn giao tiếp
- **Trạng thái Codex Review**: Đã hoàn thành triệt để phần sửa còn lại của SH-R1-01 theo báo cáo Codex R2. Mã nguồn, unit test và integration test đều đã được bổ sung và chạy đạt 100%. Sẵn sàng cho Codex review vòng R3. **Chưa tự đánh dấu Codex đã duyệt**.
- **Tác vụ tiếp theo**:
  - Chuyển giao mốc sửa cho Codex review R3.
  - Chuẩn bị thử nghiệm camera và phần cứng khi có thiết bị thực tế.

