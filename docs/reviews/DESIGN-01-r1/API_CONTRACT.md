# PACKING VIDEO PROOF - REST API & WORKER RPC CONTRACT

> **Document Version:** 2.0.0 (Updated to Baseline Alignment)  
> **API Version:** v1  
> **Base URL:** `/api/v1`  
> **Content-Type:** `application/json`

---

## 1. Authentication, Resource Scoping & Idempotency

### 1.1. Security Headers & Scoping
All protected endpoints require:
```http
Authorization: Bearer <access_token>
```
**Resource Authorization Rule:** The backend strictly verifies that the user belongs to the same `warehouse_id` as the targeted `station_id`. Attempting to access or operate a station outside the user's assigned warehouse returns `403 Forbidden` (`WAREHOUSE_ACCESS_DENIED`), regardless of the client-side URL or localStorage.

### 1.2. Idempotency Key Specification
Mutating requests (`POST /packing/start`, `POST /packing/stop`, `POST /packing/cancel`) must include:
```http
Idempotency-Key: <UUIDv4>
```
- **Identical Request Replay:** Returns the original cached response with identical status code.
- **Key Reused with Mismatched Payload:** Returns `409 Conflict`:
  ```json
  {
    "success": false,
    "error": {
      "code": "IDEMPOTENCY_PAYLOAD_MISMATCH",
      "message": "The idempotency key was previously used with a different request payload."
    }
  }
  ```

---

## 2. Packing Operations (User Web)

### 2.1. `POST /api/v1/packing/validate-barcode`
Validates barcode format, detects duplicates within the configured warehouse timeframe, and verifies station readiness.

**Request:**
```json
{
  "trackingCode": "SPXVN0458892182B",
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc"
}
```

**Response (200 OK - Valid & Ready):**
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

**Response (409 Conflict - Already Packed):**
```json
{
  "success": false,
  "error": {
    "code": "BARCODE_PREVIOUSLY_PACKED",
    "message": "Tracking code was already packed earlier today.",
    "details": {
      "previousSessionId": "2c94318c-c90a-4710-b9a3-5c24d9c72714",
      "packedAt": "2026-10-03T08:15:30Z",
      "operator": "Tran Van B"
    }
  }
}
```

---

### 2.2. `POST /api/v1/packing/start`
Asynchronously initializes a packing session. Enforces the strict rule that the session begins in `WAITING` and does NOT return `RECORDING` until the worker confirms active video ingestion.

**Headers:**
```http
Idempotency-Key: 7b9a5c81-89d4-4a2e-b6a1-0e1d8a4392bc
```

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

**Response (202 Accepted - Session Queued & Worker Dispatched):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "operationId": "op_98124019a",
    "status": "WAITING",
    "trackingCode": "SPXVN0458892182B",
    "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
    "message": "Recording command dispatched to station worker. Awaiting stream confirmation."
  }
}
```

*Note:* When the worker confirms the first keyframe, it emits a WebSocket event `SESSION_STATE_CHANGED` (`status: "RECORDING"`). If the worker does not respond within 15 seconds, the session transitions to `FAILED` with error `CAMERA_INIT_TIMEOUT`.

---

### 2.3. `POST /api/v1/packing/stop`
Requests graceful stop of active recording. Transitions session to `PROCESSING` while finalization, SHA-256 calculation, and local archival take place.

**Headers:**
```http
Idempotency-Key: 3b1a9c82-12d4-4a2e-b6a1-1e1d8a4392dd
```

**Request:**
```json
{
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269"
}
```

**Response (202 Accepted - Finalization In Progress):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "operationId": "op_final_9912a",
    "status": "PROCESSING",
    "message": "Stop command acknowledged. FFmpeg is finalizing container and calculating SHA-256."
  }
}
```

---

### 2.4. `GET /api/v1/packing/stations/:id/active`
Reconnection snapshot endpoint. When the User Web tab refreshes or reconnects after network blip, it queries this endpoint to reconstruct exact station state.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
    "stationStatus": "BUSY",
    "activeSession": {
      "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
      "trackingCode": "SPXVN0458892182B",
      "status": "RECORDING",
      "startTime": "2026-10-03T09:30:12.450Z",
      "elapsedSeconds": 34
    },
    "worker": {
      "status": "ONLINE",
      "lastHeartbeat": "2026-10-03T09:30:40.000Z"
    }
  }
}
```

---

## 3. Worker WebSocket Communication Protocol (`/ws/worker`)

Video Workers connect outbound to the Backend WebSocket Gateway over `wss://<server-ip>:4000/ws/worker`.

### 3.1. Connection Handshake
Worker sends header: `X-Worker-Token: <station-secret-token>` and initial payload:
```json
{
  "type": "WORKER_HELLO",
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
  "version": "1.0.0",
  "os": "Windows 11 Pro",
  "hostname": "PACK-PC-01"
}
```

### 3.2. Heartbeat Ping (Every 10 Seconds)
```json
{
  "type": "WORKER_HEARTBEAT",
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
  "timestamp": "2026-10-03T09:31:00Z",
  "telemetry": {
    "freeDiskBytes": 348234823680,
    "activePid": 4120,
    "ffmpegHealth": "OK",
    "nasReachable": true
  }
}
```

### 3.3. Command Dispatch (Backend $\rightarrow$ Worker)
```json
{
  "type": "COMMAND_DISPATCH",
  "commandId": "cmd_4819a2b",
  "command": "START_RECORD",
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
  "camera": {
    "type": "RTSP",
    "url": "rtsp://admin:secret@192.168.1.100:554/Streaming/Channels/101"
  },
  "filePattern": "SPXVN0458892182B_PACK01_20261003_163012"
}
```

### 3.4. Stream Milestone (Worker $\rightarrow$ Backend)
```json
{
  "type": "RECORDING_MILESTONE",
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
  "event": "FIRST_KEYFRAME_RECEIVED",
  "pid": 4120
}
```

### 3.5. Finalize Success (Worker $\rightarrow$ Backend)
```json
{
  "type": "FINALIZE_SUCCESS",
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
  "video": {
    "filename": "SPXVN0458892182B_PACK01_20261003_163012.mp4",
    "localPath": "D:\\PackingVideo\\2026\\10\\03\\SPXVN0458892182B_PACK01_20261003_163012.mp4",
    "duration": 42.5,
    "fileSize": 10485760,
    "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "thumbnailPath": "D:\\PackingVideo\\2026\\10\\03\\SPXVN0458892182B_PACK01_20261003_163012.jpg"
  }
}
```

---

## 4. Video Query & Remote Range Streaming

### 4.1. `GET /api/v1/videos/:id/stream`
Streams video content with HTTP 206 Partial Content byte-range support.

**Headers Supported:**
```http
Range: bytes=0-1048575
```

**Location Resolution:**
1. If `videos.sync_status === 'SYNCED'`: Backend API reads file from NAS path `\\SERVER\PackingVideo\...`.
2. If `videos.sync_status !== 'SYNCED'` (file remains on Station PC): Backend API transparently reverse-proxies the stream request to the station worker's internal stream endpoint (`http://<station-ip>:4005/worker/video/:id/stream`), authenticated with a short-lived HMAC token.

### 4.2. `POST /api/v1/videos/:id/verify-hash`
Recalculates cryptographic SHA-256 directly from physical disk and compares against original database record.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "videoId": "19b5104d-e9c5-43ea-8b45-0d859fa23f79",
    "dbHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "diskHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "isMatch": true,
    "verifiedAt": "2026-10-03T16:35:00Z"
  }
}
```
