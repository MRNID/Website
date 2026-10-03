# PACKING VIDEO PROOF - VIDEO PROCESSING & FFMPEG ENGINE SPECIFICATION

> **Document Version:** 2.2.0 (Post Codex R1 Review - Finding D01-04 Addressed)  
> **Topic:** Ingestion Muxer (`-f mp4`), Safe Finalization Remux & Crash Recovery Reality

---

## 1. Video Ingestion: Fragmented MP4 (`fMP4`) Specification

### 1.1. Ingestion Guarantees & Physical Limitations (D01-04)
- **Standard MP4 Vulnerability:** Standard MP4 stores container indexing (`moov` atom) at the end. An abrupt process kill or power cut leaves the file with unindexed media data, rendering it unplayable.
- **Fragmented MP4 Ingestion:** By forcing the MP4 muxer to write periodic movie fragments (`moof` + `mdat` atoms), video data flushed to disk prior to an interruption remains readable and seekable.
- **Physical Boundary Caveat:** In sudden power cuts, frames held in volatile OS page cache buffers (typically the last 1–2 seconds before loss of power) may be lost. The system guarantees that **all flushed fragments on disk are recoverable without container destruction**, but does not guarantee frames that never reached physical non-volatile storage.

---

## 2. Production FFmpeg Command Lines (D01-04)

### 2.1. Ingestion: RTSP IP Camera (Zero CPU Transcoding - Copy Mode)
```bash
ffmpeg -y \
  -rtsp_transport tcp \
  -i "rtsp://admin:Password123@192.168.1.100:554/Streaming/Channels/101" \
  -c:v copy \
  -an \
  -f mp4 \
  -movflags empty_moov+default_base_moof+frag_keyframe \
  "D:\PackingVideoTemp\session_43924f0c.fmp4"
```

### 2.2. Ingestion: USB Webcam (Windows DirectShow - Software x264 Encoding)
```bash
ffmpeg -y \
  -f dshow \
  -video_size 1920x1080 \
  -framerate 25 \
  -i video="Logitech Webcam C920" \
  -c:v libx264 \
  -preset veryfast \
  -crf 26 \
  -pix_fmt yuv420p \
  -an \
  -f mp4 \
  -movflags empty_moov+default_base_moof+frag_keyframe \
  "D:\PackingVideoTemp\session_43924f0c.fmp4"
```

### 2.3. Safe Finalization Remux & Non-Overwriting Pipeline (D01-04)
To ensure that retries or naming collisions **never overwrite** existing evidence:
1. **Remux to Temporary Staging File:**
   ```bash
   ffmpeg -y \
     -i "D:\PackingVideoTemp\session_43924f0c.fmp4" \
     -c copy \
     -f mp4 \
     -movflags +faststart \
     "D:\PackingVideoTemp\session_43924f0c_final.tmp.mp4"
   ```
2. **Integrity Check:** Worker verifies file size $> 0$ and probes `moov` atom placement.
3. **Collision-Proof Destination Naming:**
   File template: `{tracking_code}_{station}_{timestamp}_{sessionShortId}.mp4`  
   Example: `SPXVN123456_PACK01_20261003_163012_43924f0c.mp4`.
4. **Atomic Move (Strict No-Overwrite):**
   Worker invokes atomic rename on the local filesystem (`rename()`) without `REPLACE_EXISTING`. If the destination unexpectedly exists, Worker appends an incremental salt and alerts the audit log rather than overwriting.

---

## 3. Crash Recovery & Orphaned File Reconciliation (D01-04)

When the Video Worker service boots:
1. **Directory Sweep:** The Worker scans `D:\PackingVideoTemp` for unfinished files (`*.fmp4`).
2. **Integrity Probe:**
   - Execute `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 session_xxx.fmp4`.
   - If duration $> 0$: Worker remuxes the recovered fragment:
     ```bash
     ffmpeg -err_detect ignore_err -i session_xxx.fmp4 -c copy -f mp4 -movflags +faststart session_xxx_recovered.mp4
     ```
   - Calculate SHA-256 of the recovered video.
   - Report to Backend API via WSS `WORKER_CRASH_RECOVERED` with `is_partial = TRUE` and duration.
   - Backend marks session as `FAILED` with `has_partial_video = TRUE` so that forensic evidence is preserved.
3. **Dead File Cleanup:** Orphaned 0-byte files with no stream headers are deleted after 24 hours.
