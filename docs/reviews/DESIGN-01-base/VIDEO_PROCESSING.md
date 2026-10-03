# PACKING VIDEO PROOF - VIDEO PROCESSING & FFMPEG ENGINE SPECIFICATION

> **Design draft:** Read [BASELINE.md](BASELINE.md) first. Examples below require alignment with its open contracts and acceptance gates before implementation; they are not validated production configurations.

> **Document Version:** 1.0.0  
> **Topic:** Camera Connectivity, FFmpeg Parameters, Container Optimization & Fail-Safe Finalization

---

## 1. Supported Video Sources

### 1.1. RTSP IP Cameras (H.264 / H.265)
- Standard industrial surveillance cameras (Hikvision, Dahua, Imou, Ezviz, Uniview).
- Connection transport: **TCP** (`-rtsp_transport tcp`) to prevent packet drop/corruption over warehouse WiFi/LAN.
- Video stream pass-through: When camera already outputs H.264, FFmpeg operates in direct copy mode (`-c:v copy`), using near-zero CPU.

### 1.2. USB Webcams (Windows DirectShow)
- Plug-and-play USB cameras (Logitech C920/C922/Brio, Rapoo, etc.).
- Input format: `-f dshow -i video="Camera Name"`.
- Hardware-accelerated or CPU encoding: H.264 via `libx264`, `h264_qsv` (Intel QuickSync), or `h264_nvenc` (NVIDIA).

---

## 2. Recommended FFmpeg Command Lines

### 2.1. RTSP IP Camera (Zero CPU Transcoding - Copy Mode)
```bash
ffmpeg -y \
  -rtsp_transport tcp \
  -i "rtsp://admin:Password123@192.168.1.100:554/Streaming/Channels/101" \
  -c:v copy \
  -an \
  -movflags +faststart \
  "D:\PackingVideoTemp\session_43924f0c.tmp.mp4"
```

### 2.2. USB Webcam (Windows DirectShow - Software x264 Encoding)
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
  -movflags +faststart \
  "D:\PackingVideoTemp\session_43924f0c.tmp.mp4"
```

### 2.3. Extracting High-Definition Thumbnail (Proof Snapshot)
```bash
ffmpeg -y \
  -ss 00:00:01 \
  -i "D:\PackingVideo\2026\10\03\SPXVN123456_PACK01_20261003_163012.mp4" \
  -vframes 1 \
  -q:v 2 \
  "D:\PackingVideo\2026\10\03\SPXVN123456_PACK01_20261003_163012.jpg"
```

---

## 3. Graceful Termination & Container Integrity

### 3.1. The MP4 Atom Problem
Standard MP4 files store their index header (the `moov` atom) at the end of the file. If FFmpeg is killed violently (e.g. `taskkill /F` or `SIGKILL`), the `moov` atom is never written, resulting in an unplayable corrupted video.

### 3.2. Solution Architecture
1. **Interactive Standard Input Command:** The Worker sends the character `q\n` into FFmpeg's `stdin` pipe.
2. **Signal Fallback:** If FFmpeg does not exit within 3 seconds, send `SIGINT` (Ctrl+C emulation).
3. **Emergency Index Repair Tool:** If an unclean shutdown occurred (e.g. power outage), on worker startup it scans `D:\PackingVideoTemp` and runs `untrunc` or `ffmpeg -err_detect ignore_err -i corrupt.tmp.mp4 -c copy fixed.mp4` to recover the proof.

---

## 4. Cryptographic Proof & SHA-256 Pipeline

The raw recorded file must be proven untampered:
1. Immediately upon FFmpeg process closure, the Worker reads the finalized MP4 via a streaming Node.js `crypto.createHash('sha256')`.
2. Hash is calculated in under 100ms for a typical 10–20MB file.
3. The SHA-256 string is transmitted to the Backend API and recorded in the immutable database row.
4. Any future dispute inquiry can re-run hash verification via `POST /api/v1/videos/:id/verify-hash`.
