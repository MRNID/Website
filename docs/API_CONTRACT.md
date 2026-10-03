# PACKING VIDEO PROOF - REST API & WORKER RPC CONTRACT

> **Document Version:** 2.2.0 (Post Codex R1 Review - Findings D01-01, D01-02, D01-05, D01-06, D01-08 Addressed)  
> **API Version:** v1  
> **Base URL:** `/api/v1`  
> **Content-Type:** `application/json`

---

## 1. Authentication, Scoping & Idempotency Envelope

### 1.1. Security Headers & Warehouse Scoping (D01-08)
All protected endpoints require:
```http
Authorization: Bearer <access_token>
```
**Resource Authorization Rule:** The backend strictly verifies that the user belongs to the same `warehouse_id` as the targeted `station_id` (or possesses `SUPER_ADMIN` authority). Cross-warehouse access attempts return `403 Forbidden` (`WAREHOUSE_ACCESS_DENIED`).

### 1.2. Idempotency Key Specification (D01-02)
Mutating requests (`POST /packing/start`, `POST /packing/stop`, `POST /packing/cancel`) must include:
```http
Idempotency-Key: <UUIDv4>
```
- **Scope:** `(business_id, warehouse_id, route_path, idempotency_key)`.
- **Matching Fingerprint (SHA-256 of request payload):** Returns the original cached response with identical status code.
- **Mismatched Fingerprint:** Returns `409 Conflict` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).

### 1.3. Standard Envelopes
**Success:**
```json
{
  "success": true,
  "data": {},
  "meta": { "timestamp": "2026-10-03T10:00:00Z", "requestId": "req_88f9a2b" }
}
```
**Error:**
```json
{
  "success": false,
  "error": { "code": "ACTIVE_SESSION_EXISTS", "message": "Station already has an active or unverified recording session." },
  "meta": { "timestamp": "2026-10-03T10:00:00Z", "requestId": "req_88f9a2b" }
}
```

---

## 2. Authentication Endpoints (D01-05)

### 2.1. `POST /api/v1/auth/login`
**Request:**
```json
{
  "username": "packer01",
  "password": "SecurePassword123!"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 28800,
    "user": {
      "id": "c62bcfca-c73c-4cf4-b529-f196328358ff",
      "businessId": "b1328325-1ec8-4171-aa3e-324c0d0c3c86",
      "warehouseId": "w8192831-2ec8-4171-aa3e-114c0d0c3c99",
      "username": "packer01",
      "fullName": "Nguyen Van A",
      "role": "PACKING_USER"
    }
  }
}
```

### 2.2. `POST /api/v1/auth/refresh`
**Request:** `{ "refreshToken": "eyJhbGciOi..." }` $\rightarrow$ **Response (200 OK):** New accessToken & refreshToken.

### 2.3. `GET /api/v1/auth/me`
Returns the currently authenticated user profile and permissions array.

---

## 3. Packing Station Operations (User Web)

### 3.1. `POST /api/v1/packing/validate-barcode`
**Request:**
```json
{
  "trackingCode": "SPXVN0458892182B",
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "platform": "SPX",
    "cleanedCode": "SPXVN0458892182B",
    "isDuplicate": false,
    "previousPackedAt": null
  }
}
```

### 3.2. `POST /api/v1/packing/start` (D01-01)
Initializes a packing session. Enforces `WAITING` status (does NOT return `RECORDING` until worker confirms first keyframe).
**Headers:** `Idempotency-Key: <UUID>`
**Request:**
```json
{
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
  "trackingCode": "SPXVN0458892182B",
  "orderCode": "ORD-20261003-8891",
  "platform": "SPX",
  "forceOverridePrevious": false
}
```
**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "operationId": "op_start_98124019a",
    "status": "WAITING",
    "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
    "trackingCode": "SPXVN0458892182B"
  }
}
```
*Note on Timeout (D01-01):* If Worker does not emit `FIRST_KEYFRAME` within 15 seconds, session moves to `INDETERMINATE_TIMEOUT`. Station remains locked until worker reconciliation or supervisor force-unlock.

### 3.3. `POST /api/v1/packing/stop`
Requests graceful stop. Transitions session to `PROCESSING` while finalization occurs.
**Headers:** `Idempotency-Key: <UUID>`
**Request:** `{ "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269" }`
**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "operationId": "op_stop_8812a",
    "status": "PROCESSING"
  }
}
```

### 3.4. `POST /api/v1/packing/cancel` (D01-05)
Aborts an in-progress session.
**Headers:** `Idempotency-Key: <UUID>`
**Request:**
```json
{
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
  "reason": "Damaged goods packaging detected"
}
```
**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "operationId": "op_cancel_112a",
    "status": "CANCELLING"
  }
}
```
*Note:* Station remains locked in `CANCELLING` until Worker responds with `CANCEL_ACK`, confirming FFmpeg has terminated.

### 3.5. `GET /api/v1/packing/sessions/:id` (D01-05)
Retrieves terminal or active session state, including partial proof metadata.
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "trackingCode": "SPXVN0458892182B",
    "status": "COMPLETED",
    "hasPartialVideo": false,
    "startTime": "2026-10-03T10:00:12Z",
    "endTime": "2026-10-03T10:00:54Z",
    "video": {
      "id": "19b5104d-e9c5-43ea-8b45-0d859fa23f79",
      "filename": "SPXVN0458892182B_PACK01_20261003_163012_43924f0c.mp4",
      "duration": 42.5,
      "fileSize": 10485760,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "syncStatus": "SYNCED",
      "isLocked": false
    }
  }
}
```

### 3.6. `GET /api/v1/packing/stations/:id/active` (D01-05)
Station recovery endpoint for UI reconnects.

### 3.7. `POST /api/v1/stations/:id/force-unlock` (D01-01)
Supervisor emergency endpoint to release a station locked in `INDETERMINATE_TIMEOUT`.
**Request:** `{ "reason": "Physical power cycle verified on station PC" }` $\rightarrow$ Requires role `WAREHOUSE_MANAGER` or higher.

---

## 4. Worker WebSocket Protocol (`/ws/worker`) (D01-01, D01-02)

### 4.1. Worker $\rightarrow$ Backend Message Schemas
1. **`WORKER_HELLO`:** Handshake sending `workerEpoch` (UUID).
2. **`WORKER_HEARTBEAT`:** Telemetry sent every 10s.
3. **`COMMAND_ACK`:** Confirms receipt and local journal persistence of command.
4. **`RECORDING_MILESTONE`:** `{ "event": "FIRST_KEYFRAME", "sessionId": "...", "pid": 4120 }`.
5. **`FINALIZE_SUCCESS`:** `{ "sessionId": "...", "duration": 42.5, "fileSize": 10485760, "sha256": "...", "localPath": "..." }`.
6. **`FINALIZE_FAILED`:** `{ "sessionId": "...", "error": "Disk write failure", "hasPartial": true }`.
7. **`CANCEL_ACK`:** `{ "sessionId": "...", "pidTerminated": 4120 }`.
8. **`SYNC_STATUS_CHANGED`:** `{ "videoId": "...", "syncStatus": "SYNCED" | "FAILED", "remoteSha256Verified": true }`.
9. **`WORKER_CRASH_RECOVERED`:** `{ "orphanTempFile": "...", "recoveredFile": "...", "duration": 28.0, "sha256": "..." }`.

### 4.2. Backend $\rightarrow$ Worker Message Schemas
1. **`COMMAND_DISPATCH`:** `{ "commandId": "...", "command": "START_RECORD" | "STOP_RECORD" | "CANCEL_RECORD", "workerEpoch": "...", "sessionId": "...", "payload": {} }`.
2. **`EVENT_ACK`:** `{ "eventId": "..." }` (acknowledges receipt so worker removes event from outbound queue).

---

## 5. Video Proof Search & Streaming (D01-05, D01-06)

### 5.1. `GET /api/v1/videos` (D01-05)
**Query Parameters:** `trackingCode`, `orderCode`, `startDate`, `endDate`, `stationId`, `userId`, `disputeStatus`, `page`, `limit`.

### 5.2. `GET /api/v1/videos/:id/stream` (D01-06)
Streams video using HTTP 206 Partial Content byte ranges.
- **`sync_status === 'SYNCED'`:** Streams directly from NAS SMB mount.
- **`sync_status !== 'SYNCED'`:** Backend proxies stream from Worker via authenticated data channel or serves cached preview. If station is offline, returns `503 VIDEO_TEMPORARILY_OFFLINE_ON_STATION`.

### 5.3. `PATCH /api/v1/videos/:id/dispute` (D01-03, D01-05)
**Request:** `{ "isLocked": true, "disputeStatus": "DISPUTE", "lockReason": "Customer claim: missing parcel contents" }`
**Responses:**
- `200 OK`: Updated video proof lock state.
- `409 Conflict` (`VIDEO_PURGE_IN_PROGRESS_OR_COMPLETED`): Returned if video has already entered `PENDING_PURGE` or `PURGED`.
