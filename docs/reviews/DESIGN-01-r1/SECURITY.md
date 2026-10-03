# PACKING VIDEO PROOF - SECURITY & AUDIT SPECIFICATION

> **Document Version:** 2.0.0 (Updated to Baseline Alignment)  
> **Topic:** Resource-Scoped Authorization, Worker Authentication, Cryptographic Integrity & Anti-Tampering

---

## 1. Resource-Scoped Access Control

### 1.1. Warehouse Boundary Enforcement
A primary rule of the system is that **client-provided IDs (URL parameters, localStorage) are never trusted as authorization proof**.
- When an operator submits a request targeting a `stationId`, the backend resolves `station.warehouse_id` from the database.
- The backend verifies that `user.warehouse_id === station.warehouse_id` (unless user possesses `SUPER_ADMIN` global authority).
- Cross-warehouse access attempts return `403 Forbidden` (`WAREHOUSE_ACCESS_DENIED`) and trigger an audit entry in `system_logs`.

### 1.2. Worker Identity & Agent Authentication
- Video Worker daemons authenticate over WebSocket using an out-of-band provisioned `X-Worker-Token`.
- The backend stores worker tokens hashed with Argon2/SHA-256 in the `workers` table.
- A worker token is bound strictly to a single `station_id`. A worker cannot issue commands or register video records for other stations.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | SUPER_ADMIN | ADMIN | WAREHOUSE_MANAGER | PACKING_USER | CUSTOMER_SERVICE | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Settings** | Full | View | No | No | No | No |
| **User & Role Admin** | Full | Warehouse | No | No | No | No |
| **Station & Camera Config**| Full | Full | View | No | No | No |
| **Packing Operations** | Yes | Yes | Yes | **Full** | No | No |
| **Video Proof Search** | Full | Full | Full | Own Station | **Full** | View |
| **Video Download** | Yes | Yes | Yes | No | **Yes** | No |
| **Lock / Dispute Toggle** | Yes | Yes | Yes | No | **Yes** | No |
| **Audit Logs View** | Full | Full | View | No | No | View |

---

## 3. Cryptographic Storage & Anti-Tampering Pipeline

1. **Immutable Raw Video Proof:**
   The original recorded video is strictly immutable. No watermarking, trimming, or compression is applied to the original proof file. Any derivative video generated for external carrier dispute submissions is created as a separate child artifact.
2. **Instant SHA-256 Stream Sealing:**
   Immediately upon FFmpeg process closure, the local Video Worker computes the SHA-256 digest of the finalized MP4 container. The hash is sent to the Backend API and persisted in the `videos` table.
3. **On-Demand Forensic Verification (`verify-hash`):**
   Administrators and auditors can trigger real-time verification (`POST /api/v1/videos/:id/verify-hash`). The server computes the live disk hash and matches it against the immutable DB record to detect bit-rot, truncation, or unauthorized tampering.
4. **Retention Race Condition Prevention:**
   The retention cleanup cron uses `SELECT ... FOR UPDATE SKIP LOCKED` on database rows. Videos marked `is_locked = TRUE` or `dispute_status = 'DISPUTE'` are completely excluded from purge queues.
