# PACKING VIDEO PROOF - DETAILED PACKING & RECORDING LIFECYCLE

> **Document Version:** 2.2.0 (Post Codex R1 Review - Findings D01-01, D01-02, D01-03, D01-04, D01-07 Addressed)  
> **Topic:** Packing Station Operational Flows, Anti-Mistake Scenarios & Fail-Safe Recording Pipeline

---

## 1. End-to-End Operational Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Packer as Operator (Packer)
    participant UI as User Web (Station UI)
    participant API as Backend API
    participant DB as PostgreSQL
    participant Worker as Video Worker (Station PC)
    participant FFmpeg as FFmpeg Binary
    participant Disk as Local SSD (D:\)
    participant NAS as NAS / Windows Share

    Note over Packer,UI: Station Boot: Ready & Auto-focused on Barcode input
    Packer->>UI: Scans Barcode via USB Scanner (e.g. SPXVN123456 + [Enter])
    UI->>API: POST /api/v1/packing/validate-barcode
    API->>DB: Check active session / previous duplicate
    DB-->>API: Code Valid & Ready
    API-->>UI: Barcode OK (Platform: SPX)

    UI->>API: POST /api/v1/packing/start {stationId, trackingCode} [Idempotency-Key]
    API->>DB: Tx: INSERT packing_sessions (status: WAITING, worker_epoch) & packing_commands (status: PENDING)
    API->>Worker: WSS: COMMAND_DISPATCH {START_RECORD, commandId, workerEpoch, sessionId, camera}
    Worker->>Worker: Append commandId to Local SQLite Command Journal
    Worker-->>API: WSS: COMMAND_ACK {commandId, status: RECEIVED}
    API-->>UI: 202 Accepted {sessionId, status: WAITING, operationId}
    UI->>UI: UI shows "Connecting Camera..." (Yellow indicator)

    Worker->>FFmpeg: Spawn fMP4 capture: ffmpeg -i rtsp://... -f mp4 -movflags empty_moov+default_base_moof+frag_keyframe D:\Temp\session_abc.fmp4
    FFmpeg-->>Worker: Emits first keyframe / PTS timestamp
    Worker->>API: WSS: RECORDING_MILESTONE {FIRST_KEYFRAME, sessionId, pid: 4120}
    API->>DB: UPDATE packing_sessions SET status = 'RECORDING', start_time = NOW()
    API->>UI: WSS Broadcast: SESSION_STATE_CHANGED {status: RECORDING}
    UI->>UI: UI turns RED, giant Timer starts (00:00), Play audio chime

    Note over Packer: Packer places goods in box, demonstrates integrity, seals box
    
    alt Next Barcode Scanned OR Operator Clicks Stop
        Packer->>UI: Scans Next Barcode (SPXVN999999) OR Presses [F2] / Clicks [STOP]
        UI->>API: POST /api/v1/packing/stop {sessionId} [Idempotency-Key]
        API->>DB: UPDATE packing_sessions SET status = 'PROCESSING'
        API->>Worker: WSS: COMMAND_DISPATCH {STOP_RECORD, sessionId}
        Worker->>Worker: Append to Local Command Journal
        API-->>UI: 202 Accepted {sessionId, status: PROCESSING}
        UI->>UI: UI shows "Processing Video Proof..." (Blue indicator)

        Worker->>FFmpeg: Send 'q' to stdin / SIGINT
        FFmpeg-->>Worker: Process cleanly exited (code 0)
        
        Note over Worker,Disk: Post-Processing & Cryptographic Proof
        Worker->>FFmpeg: Remux to Faststart Temp: ffmpeg -i session_abc.fmp4 -c copy -f mp4 -movflags +faststart session_abc_final.tmp.mp4
        Worker->>Disk: Read session_abc_final.tmp.mp4
        Worker->>Worker: Stream Calculate SHA-256 Checksum
        Worker->>FFmpeg: Extract Thumbnail: ffmpeg -ss 00:00:01 -i session_abc_final.tmp.mp4 -vframes 1 thumbnail.jpg
        Worker->>Disk: Atomic Rename (Strict No-Overwrite): D:\PackingVideoTemp\... -> D:\PackingVideo\2026\10\03\{filename_sessionShortId}.mp4
        Worker->>Worker: Append FINALIZE_SUCCESS to Outbound Event Journal
        Worker->>API: WSS: FINALIZE_SUCCESS {eventId, sequenceNumber, duration, sha256, fileSize, localPath}
        API->>DB: Tx: INSERT worker_events_inbox, INSERT videos, UPDATE packing_sessions (status: COMPLETED)
        API-->>Worker: WSS: EVENT_ACK {eventId}
        API->>UI: WSS Broadcast: SESSION_STATE_CHANGED {status: COMPLETED}
        UI->>UI: Play success chime. Screen returns to READY for next scan.
        
        Note over Worker,NAS: Verified Background NAS Mirroring (D01-07)
        Worker->>Worker: Enqueue to persistent SQLite NAS sync queue
        Worker->>NAS: Copy file to \\SERVER\PackingVideo\2026\10\03\...mp4.tmp
        Worker->>Worker: Stream read NAS .tmp and compute remote SHA-256
        alt Remote SHA-256 Matches Local SHA-256 Exactly
            Worker->>NAS: Rename remote .tmp -> final .mp4
            Worker->>API: WSS: SYNC_STATUS_CHANGED {eventId, videoId, syncStatus: SYNCED}
            API->>DB: UPDATE videos SET sync_status = 'SYNCED', nas_path = '...'
            API-->>Worker: WSS: EVENT_ACK {eventId}
        else Remote Hash Mismatch OR NAS Offline
            Worker->>API: WSS: SYNC_STATUS_CHANGED {eventId, videoId, syncStatus: PENDING, error: 'Checksum mismatch or host unreachable'}
            API->>DB: UPDATE videos SET sync_status = 'PENDING', sync_error = '...'
            Note over Worker: File kept in local persistent queue. Retried with exponential backoff.
        end
    end
```

---

## 2. Chi Tiết Các Luồng Nghiệp Vụ Chính

---

### Luồng 1: Bắt đầu phiên quay đóng gói (Start Recording Flow) (D01-01, D01-02)

- **Đầu vào (Inputs):**
  - `stationId`: UUID của trạm đóng gói.
  - `trackingCode`: Mã vận đơn đã chuẩn hóa.
  - `orderCode`: Mã đơn hàng nội bộ.
  - `platform`: `SPX`, `TIKTOK`, `LAZADA`, `GHN`, `GHTK`, `VIETTEL_POST`, `JT`, `OTHER`.
  - `Idempotency-Key`: UUIDv4.
  - `forceOverridePrevious`: Boolean.
- **Điều kiện tiên quyết (Prerequisites):**
  - Operator đã đăng nhập; `user.warehouse_id === station.warehouse_id`.
  - Station đang ở trạng thái `ONLINE`.
  - Không có phiên nào trên trạm hoặc camera ở trạng thái `WAITING`, `RECORDING`, `PROCESSING`, `CANCELLING`, hoặc `INDETERMINATE_TIMEOUT` (bảo vệ bởi `uq_active_station_session`).
  - Dung lượng trống ổ SSD `D:\PackingVideoTemp` $\ge 2$ GB.
- **Kết quả mong đợi (Expected Results):**
  - Database tạo `packing_sessions` (`status = 'WAITING'`) và `packing_commands` (`status = 'PENDING'`) trong cùng 1 transaction.
  - Backend trả về `202 Accepted` với payload `{sessionId, operationId, status: "WAITING"}`.
  - Video Worker ghi command vào Local Command Journal (SQLite), phản hồi `COMMAND_ACK`, khởi chạy FFmpeg `fMP4`.
  - Khi nhận keyframe đầu tiên, Worker gửi `RECORDING_MILESTONE`, Backend chuyển sang `RECORDING`. Màn hình trạm chuyển ĐỎ, Timer bắt đầu chạy.
- **Nhánh lỗi & Khắc phục Timeout (D01-01):**
  - *Lỗi Timeout 15s:* Nếu sau 15 giây không nhận được `RECORDING_MILESTONE`, Backend chuyển trạng thái sang `INDETERMINATE_TIMEOUT`.
  - **Trạm KHÔNG được tự động giải phóng:** Station tiếp tục bị khóa để ngăn công nhân bấm quay đè khi FFmpeg có thể đang chạy ngầm. Trạm chỉ mở lại khi:
    1. Worker kết nối lại và gửi báo cáo trạng thái xác nhận tiến trình đã tắt.
    2. Hoặc Trưởng kho thực hiện lệnh `POST /api/v1/stations/:id/force-unlock` sau khi kiểm tra thực tế.
- **Tiêu chí kiểm thử (Acceptance Criteria):**
  - [TC-START-01] Gửi 2 request Start đồng thời $\rightarrow$ Đúng 1 request nhận `202 Accepted`, request thứ hai nhận `409 Conflict`.
  - [TC-START-02] Mất mạng ngay sau khi gửi lệnh Start $\rightarrow$ Sau 15s session chuyển `INDETERMINATE_TIMEOUT`, mọi yêu cầu Start mới trên trạm đó đều bị chặn cho đến khi đối chiếu trạng thái.

---

### Luồng 2: Dừng quay & Hoàn tất đóng gói (Stop & Finalize Flow) (D01-02, D01-04)

- **Đầu vào:** `sessionId`, `Idempotency-Key`.
- **Điều kiện:** Phiên đang ở `RECORDING`.
- **Kết quả mong đợi:**
  - Backend cập nhật session sang `PROCESSING`, trả `202 Accepted`.
  - Worker gửi `q` vào FFmpeg. Sau khi tiến trình thoát, remux tệp `.fmp4` sang `session_{id}_final.tmp.mp4` (`-c copy -f mp4 -movflags +faststart`).
  - Worker tính SHA-256 trực tiếp từ file final.
  - Worker trích xuất thumbnail JPEG tại 00:00:01.
  - Atomic rename sang `D:\PackingVideo\YYYY\MM\DD\{tracking}_{station}_{timestamp}_{sessionShortId}.mp4` (tuyệt đối không ghi đè file có sẵn).
  - Worker ghi `FINALIZE_SUCCESS` vào Outbound Journal, gửi về Backend.
  - Backend cập nhật `videos` và `packing_sessions` (`status = 'COMPLETED'`).
- **Tiêu chí kiểm thử:**
  - [TC-STOP-01] Tên file video tạo ra chứa mã session short ID, không bao giờ bị ghi đè dù có 2 lần finalize cùng mã vận đơn.

---

### Luồng 4: Đồng bộ NAS & Xác minh toàn vẹn (Verified NAS Mirroring) (D01-07)

- **Đầu vào:** Video cục bộ đã finalized, `sync_status = 'PENDING'`.
- **Kết quả mong đợi:**
  - Worker copy video sang tệp tạm trên NAS: `\\SERVER\PackingVideo\YYYY\MM\DD\{filename}.mp4.tmp`.
  - Worker stream đọc tệp trên NAS và tính mã băm SHA-256 từ xa.
  - **Chỉ khi `nas_sha256 === local_sha256`:** Worker mới đổi tên tệp trên NAS thành `{filename}.mp4` và gửi `SYNC_STATUS_CHANGED` (`syncStatus: 'SYNCED'`).
  - Nếu mã băm không khớp hoặc mất kết nối: Tệp tạm trên NAS bị xóa, trạng thái giữ là `PENDING`, hàng đợi SQLite lưu job để retry với backoff. Bản local tuyệt đối không bị xóa.
- **Tiêu chí kiểm thử:**
  - [TC-NAS-HASH-01] Giả lập truyền file hỏng (thay đổi 1 byte giữa chừng) $\rightarrow$ Worker phát hiện hash không khớp, từ chối công bố `SYNCED`, báo lỗi `CHECKSUM_MISMATCH`, giữ nguyên file local an toàn.

---

### Luồng 6: Quản lý tranh chấp khiếu nại & Quét dọn Retention (D01-03)

- **Đầu vào:** Daily Retention Cron hoặc CSKH gọi `PATCH /videos/:id/dispute`.
- **Quy trình Hai Pha (Two-Phase Intent):**
  1. *Pha 1 (Ý định DB):* Cron mở transaction với `FOR UPDATE SKIP LOCKED`, chọn các video quá hạn, `is_locked = FALSE`, `dispute_status = 'NORMAL'`, `sync_status = 'SYNCED'`. Cập nhật `purge_status = 'PENDING_PURGE'`, commit.
  2. *Pha 2 (Xóa tệp vật lý):* Daemon xóa file trên Local SSD và NAS.
  3. *Pha 3 (Hoàn tất):* Cập nhật `purge_status = 'PURGED'`, `purged_at = NOW()`.
- **Bảo vệ Tranh chấp CSKH:**
  - Nếu CSKH bấm Khóa tranh chấp khi video đang ở `PENDING_PURGE` hoặc `PURGED`: Hệ thống trả về `409 Conflict` (`VIDEO_ALREADY_PURGED_OR_PURGE_IN_PROGRESS`), không bao giờ báo thành công giả tạo cho video đã bị xóa.
- **Tiêu chí kiểm thử:**
  - [TC-RET-01] Chạy đồng thời yêu cầu Dispute Lock của CSKH và Retention Purge $\rightarrow$ Nếu Cron chọn video trước thì CSKH nhận `409`, nếu CSKH khóa trước thì Cron bỏ qua không xóa.
