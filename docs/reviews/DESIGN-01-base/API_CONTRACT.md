# PACKING VIDEO PROOF - REST API & RPC CONTRACT

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
> **API Version:** v1  
> **Base URL:** `/api/v1`  
> **Content-Type:** `application/json`

---

## 1. Authentication & Security Headers

All protected endpoints require a standard Bearer token header:
```http
Authorization: Bearer <access_token>
```

### Standard Response Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-10-03T09:30:00.000Z",
    "requestId": "req_88f9a2b"
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "BARCODE_ACTIVE_RECORDING",
    "message": "Station is currently recording another order.",
    "details": {
      "activeTrackingCode": "SPXVN111111",
      "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269"
    }
  },
  "meta": {
    "timestamp": "2026-10-03T09:30:00.000Z",
    "requestId": "req_88f9a2b"
  }
}
```

---

## 2. Authentication Endpoints

### 2.1. `POST /api/v1/auth/login`
Authenticates user and returns JWT pair.

**Request Body:**
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
      "username": "packer01",
      "fullName": "Nguyen Van A",
      "role": "PACKING_USER",
      "warehouseId": "b1328325-1ec8-4171-aa3e-324c0d0c3c86"
    }
  }
}
```

### 2.2. `POST /api/v1/auth/refresh`
Exchanges refresh token for new access token.

---

## 3. Packing Station Operations (User Web)

### 3.1. `POST /api/v1/packing/validate-barcode`
Validates format and checks duplicate/active states before starting recording.

**Request Body:**
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

**Response (409 Conflict - Already Recorded Today):**
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

### 3.2. `POST /api/v1/packing/start`
Initializes packing session and triggers Video Worker FFmpeg recording.

**Request Body:**
```json
{
  "stationId": "e0bfa923-d34e-4b47-9cb8-db91efb054cc",
  "trackingCode": "SPXVN0458892182B",
  "orderCode": "ORD-20261003-8891",
  "platform": "SPX",
  "forceOverridePrevious": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "status": "RECORDING",
    "trackingCode": "SPXVN0458892182B",
    "startTime": "2026-10-03T09:30:12.450Z",
    "stationName": "PACK_STATION_01",
    "cameraName": "CAM_PACK_01"
  }
}
```

### 3.3. `POST /api/v1/packing/stop`
Stops FFmpeg recording, triggers SHA-256 calculation and video archival.

**Request Body:**
```json
{
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
    "status": "COMPLETED",
    "video": {
      "id": "19b5104d-e9c5-43ea-8b45-0d859fa23f79",
      "filename": "SPXVN0458892182B_PACK01_20261003_163012.mp4",
      "duration": 42.5,
      "fileSize": 10485760,
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "thumbnailUrl": "/api/v1/videos/19b5104d-e9c5-43ea-8b45-0d859fa23f79/thumbnail",
      "syncStatus": "PENDING"
    }
  }
}
```

### 3.4. `POST /api/v1/packing/cancel`
Aborts an in-progress recording session without producing a permanent proof.

---

## 4. Internal Video Worker RPC API

Communicated over local loopback (`http://127.0.0.1:4005`) between Backend and Worker:

### 4.1. `POST /worker/record/start`
**Payload:**
```json
{
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269",
  "camera": {
    "type": "RTSP",
    "url": "rtsp://admin:pass@192.168.1.100:554/ch0"
  },
  "outputFilePattern": "SPXVN0458892182B_PACK01_20261003_163012"
}
```

### 4.2. `POST /worker/record/stop`
**Payload:**
```json
{
  "sessionId": "43924f0c-939a-4c20-a6ce-5847fa55f269"
}
```

### 4.3. `GET /worker/health`
Returns worker telemetry:
```json
{
  "status": "ONLINE",
  "activeRecordings": 1,
  "ffmpegVersion": "6.0-full",
  "localDisk": {
    "freeBytes": 348234823680,
    "totalBytes": 512110190592,
    "tempDisk": "D:\\PackingVideoTemp"
  },
  "nasConnection": "CONNECTED"
}
```

---

## 5. Video Proof & Query Endpoints (Admin & CSKH)

### 5.1. `GET /api/v1/videos`
Search video records by metadata.

**Query Parameters:**
- `trackingCode` (string)
- `orderCode` (string)
- `startDate` (ISO string)
- `endDate` (ISO string)
- `stationId` (UUID)
- `userId` (UUID)
- `warehouseId` (UUID)
- `disputeStatus` (NORMAL | DISPUTE | RESOLVED)
- `page` (number, default: 1)
- `limit` (number, default: 20)

### 5.2. `GET /api/v1/videos/:id/stream`
Streams the video with full HTTP 206 Partial Content byte-range support for seamless seeking.

### 5.3. `POST /api/v1/videos/:id/verify-hash`
Re-computes file hash on demand and compares it with the immutable database record.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "videoId": "19b5104d-e9c5-43ea-8b45-0d859fa23f79",
    "dbHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "calculatedHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "isMatch": true,
    "verifiedAt": "2026-10-03T16:35:00Z"
  }
}
```

### 5.4. `PATCH /api/v1/videos/:id/dispute`
Flags a video as disputed and locks it against retention deletion.

**Request Body:**
```json
{
  "isLocked": true,
  "disputeStatus": "DISPUTE",
  "lockReason": "Customer reported missing item in parcel - Ticket #TK-9921"
}
```

---

## 6. Dashboard Telemetry Endpoints

### 6.1. `GET /api/v1/dashboard/stats`
Returns aggregated live metrics for the management console:
```json
{
  "success": true,
  "data": {
    "todayOrdersCount": 842,
    "todayVideosCount": 840,
    "todayStorageBytes": 9834823000,
    "cameras": {
      "online": 12,
      "offline": 0
    },
    "workers": {
      "online": 12,
      "offline": 0
    },
    "syncQueue": {
      "pending": 4,
      "syncing": 1,
      "failed": 0
    },
    "storageDisks": [
      {
        "type": "LOCAL_ARCHIVE",
        "path": "D:\\PackingVideo",
        "freePercentage": 68.2
      },
      {
        "type": "NAS_SHARE",
        "path": "\\\\SERVER\\PackingVideo",
        "freePercentage": 84.5
      }
    ]
  }
}
```
