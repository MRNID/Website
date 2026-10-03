# PACKING VIDEO PROOF - VIDEO PROCESSING & FFMPEG ENGINE SPECIFICATION

> **Document Version:** 2.0.0 (Updated to Baseline Alignment)  
> **Topic:** Camera Connectivity, FFmpeg Parameters, Fragmented MP4 Container Optimization & Crash Recovery

---

## 1. Video Ingestion: Fragmented MP4 (fMP4) Architecture

### 1.1. Why Standard MP4 is Dangerous in Warehouses
Standard MP4 files store the file index (`moov` atom) at the very end of the file. If power cuts, FFmpeg is abruptly killed, or the PC shuts down mid-recording, the `moov` atom is never written. The recorded video file becomes **100% corrupted and unplayable**.

### 1.2. The Solution: Ingestion as Fragmented MP4 (`fMP4`)
During active recording, FFmpeg writes in fragments (`moof` + `mdat` pairs) every keyframe.
- Even if the PC loses power abruptly at second 42, **all 42 seconds of video are preserved on disk** and immediately playable!
- Upon normal completion, the Worker performs a near-instantaneous copy-remux to standard faststart MP4 for universal web browser playback.

```
[ Camera Stream ] 
       │
       ▼
[ FFmpeg Ingestion ] ──> D:\PackingVideoTemp\session_{id}.fmp4  (Crash-proof Fragmented MP4)
       │
       ▼ (Normal Stop: 'q' or SIGINT)
[ Remux to Faststart ] ──> D:\PackingVideo\YYYY\MM\DD\{filename}.mp4 (-c copy -movflags +faststart)
       │
       ▼
[ SHA-256 Checksum + Thumbnail Extraction ]
```

---

## 2. Production FFmpeg Command Lines

### 2.1. Ingestion: RTSP IP Camera (Zero CPU Transcoding - Copy Mode)
```bash
ffmpeg -y \
  -rtsp_transport tcp \
  -i "rtsp://admin:Password123@192.168.1.100:554/Streaming/Channels/101" \
  -c:v copy \
  -an \
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
  -movflags empty_moov+default_base_moof+frag_keyframe \
  "D:\PackingVideoTemp\session_43924f0c.fmp4"
```

### 2.3. Finalization Remux (Sub-second execution: -c copy)
```bash
ffmpeg -y \
  -i "D:\PackingVideoTemp\session_43924f0c.fmp4" \
  -c copy \
  -movflags +faststart \
  "D:\PackingVideo\2026\10\03\SPXVN123456_PACK01_20261003_163012.mp4"
```

### 2.4. Thumbnail Extraction
```bash
ffmpeg -y \
  -ss 00:00:01 \
  -i "D:\PackingVideo\2026\10\03\SPXVN123456_PACK01_20261003_163012.mp4" \
  -vframes 1 \
  -q:v 2 \
  "D:\PackingVideo\2026\10\03\SPXVN123456_PACK01_20261003_163012.jpg"
```

---

## 3. Crash Recovery & Orphaned File Reconciliation

When the Video Worker service boots (e.g. after PC reboot or unexpected termination):
1. **Directory Sweep:** The Worker scans `D:\PackingVideoTemp` for unfinished files (`*.fmp4`, `*.tmp.mp4`).
2. **Integrity Probe:** For each file:
   - Run `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 file.fmp4`.
   - If duration > 0: Worker remuxes the recovered fragment:
     ```bash
     ffmpeg -err_detect ignore_err -i file.fmp4 -c copy -movflags +faststart recovered.mp4
     ```
   - Calculate SHA-256 of the recovered video.
   - Report to Backend API via WSS `WORKER_CRASH_RECOVERED` with the recovered file path, duration, and SHA-256.
   - Backend marks the interrupted session as `FAILED_WITH_PARTIAL_PROOF` so forensic evidence is never lost.
3. **Dead File Cleanup:** Orphaned 0-byte files with no stream headers are deleted after 24 hours.
