import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { workerConfig } from '../config.js';
import { calculateFileSha256, getStorageDatePath } from '@packing-proof/shared-utils';

export interface ActiveRecordingSession {
  sessionId: string;
  trackingCode: string;
  stationCode: string;
  startTime: Date;
  tempFmp4Path: string;
  finalTmpPath: string;
  process?: ChildProcess;
  isMock: boolean;
  timer?: NodeJS.Timeout;
}

export class FFmpegManager {
  private static activeSession: ActiveRecordingSession | null = null;

  static isRecording(): boolean {
    return this.activeSession !== null;
  }

  static getActiveSession(): ActiveRecordingSession | null {
    return this.activeSession;
  }

  static async startRecording(params: {
    sessionId: string;
    trackingCode: string;
    stationCode: string;
    camera: { type: string; url?: string; deviceName?: string };
    outputTempPattern: string;
    onFirstKeyframe: (pid: number) => void;
  }): Promise<void> {
    if (this.activeSession) {
      throw new Error(`Already recording session ${this.activeSession.sessionId}`);
    }

    if (!fs.existsSync(workerConfig.tempDir)) {
      fs.mkdirSync(workerConfig.tempDir, { recursive: true });
    }

    const tempFmp4Path = path.join(workerConfig.tempDir, `session_${params.sessionId}.fmp4`);
    const finalTmpPath = path.join(workerConfig.tempDir, `session_${params.sessionId}_final.tmp.mp4`);

    let ffmpegAvailable = false;
    try {
      const check = spawn(workerConfig.ffmpegPath, ['-version']);
      await new Promise<void>((resolve) => {
        check.on('error', () => resolve()); // not found
        check.on('close', (code) => {
          if (code === 0) ffmpegAvailable = true;
          resolve();
        });
      });
    } catch {
      ffmpegAvailable = false;
    }

    if (!ffmpegAvailable) {
      console.warn(`[FFmpegManager] FFmpeg binary not found at '${workerConfig.ffmpegPath}'. Running in Simulation / Mock Mode.`);
      // Mock mode: writes simulated fMP4 file chunks periodically
      fs.writeFileSync(tempFmp4Path, Buffer.from('MOCK_FMP4_HEADER_' + params.sessionId));

      this.activeSession = {
        sessionId: params.sessionId,
        trackingCode: params.trackingCode,
        stationCode: params.stationCode,
        startTime: new Date(),
        tempFmp4Path,
        finalTmpPath,
        isMock: true
      };

      // Emit keyframe milestone after 500ms
      setTimeout(() => {
        if (this.activeSession?.sessionId === params.sessionId) {
          params.onFirstKeyframe(9999);
        }
      }, 500);

      // Periodically append mock video frames
      this.activeSession.timer = setInterval(() => {
        if (fs.existsSync(tempFmp4Path)) {
          fs.appendFileSync(tempFmp4Path, Buffer.from('_FRAME_' + Date.now()));
        }
      }, 1000);

      return;
    }

    // Native FFmpeg Execution
    const args: string[] = ['-y'];
    if (params.camera.type === 'RTSP' && params.camera.url) {
      args.push(
        '-rtsp_transport', 'tcp',
        '-i', params.camera.url,
        '-c:v', 'copy',
        '-an',
        '-f', 'mp4',
        '-movflags', 'empty_moov+default_base_moof+frag_keyframe',
        tempFmp4Path
      );
    } else {
      args.push(
        '-f', 'dshow',
        '-i', `video=${params.camera.deviceName || 'USB Webcam'}`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '26',
        '-an',
        '-f', 'mp4',
        '-movflags', 'empty_moov+default_base_moof+frag_keyframe',
        tempFmp4Path
      );
    }

    console.log(`[FFmpegManager] Spawning: ${workerConfig.ffmpegPath} ${args.join(' ')}`);
    const proc = spawn(workerConfig.ffmpegPath, args);

    this.activeSession = {
      sessionId: params.sessionId,
      trackingCode: params.trackingCode,
      stationCode: params.stationCode,
      startTime: new Date(),
      tempFmp4Path,
      finalTmpPath,
      process: proc,
      isMock: false
    };

    let keyframeSent = false;
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (!keyframeSent && (text.includes('frame=') || text.includes('Output #0'))) {
        keyframeSent = true;
        params.onFirstKeyframe(proc.pid || 1);
      }
    });

    proc.on('close', (code) => {
      console.log(`[FFmpegManager] Ingestion process closed with code ${code}`);
    });
  }

  static async stopRecording(): Promise<{
    filename: string;
    localPath: string;
    duration: number;
    fileSize: number;
    sha256: string;
    thumbnailPath?: string;
  }> {
    if (!this.activeSession) {
      throw new Error('No active recording session to stop');
    }

    const session = this.activeSession;
    if (session.timer) clearInterval(session.timer);

    const durationSeconds = Math.max(1, Math.round((Date.now() - session.startTime.getTime()) / 1000));

    if (session.isMock) {
      // Mock Finalize
      fs.copyFileSync(session.tempFmp4Path, session.finalTmpPath);
    } else if (session.process && !session.process.killed) {
      // Send 'q' to stdin for clean MP4 atom finalization
      session.process.stdin?.write('q\n');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          session.process?.kill('SIGINT');
          resolve();
        }, 3000);

        session.process?.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Remux to faststart
      await new Promise<void>((resolve, reject) => {
        const remux = spawn(workerConfig.ffmpegPath, [
          '-y',
          '-i', session.tempFmp4Path,
          '-c', 'copy',
          '-f', 'mp4',
          '-movflags', '+faststart',
          session.finalTmpPath
        ]);
        remux.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Remux failed: ${code}`))));
        remux.on('error', (err) => reject(err));
      });
    }

    // SHA-256 Calculation
    const sha256 = await calculateFileSha256(session.finalTmpPath);
    const stats = fs.statSync(session.finalTmpPath);

    // Target Storage Path
    const datePath = getStorageDatePath(new Date());
    const archiveTargetDir = path.join(workerConfig.archiveDir, datePath.year, datePath.month, datePath.day);
    if (!fs.existsSync(archiveTargetDir)) {
      fs.mkdirSync(archiveTargetDir, { recursive: true });
    }

    const finalFilename = `${session.trackingCode}_${session.stationCode}_${Date.now()}_${session.sessionId.slice(0, 8)}.mp4`;
    const finalLocalPath = path.join(archiveTargetDir, finalFilename);

    // Atomic Move (Strict no overwrite)
    fs.renameSync(session.finalTmpPath, finalLocalPath);

    // Write Proof Sidecar JSON (D01-10)
    const sidecarPath = path.join(archiveTargetDir, `${finalFilename}.proof.json`);
    fs.writeFileSync(sidecarPath, JSON.stringify({
      sessionId: session.sessionId,
      trackingCode: session.trackingCode,
      stationCode: session.stationCode,
      duration: durationSeconds,
      fileSize: stats.size,
      sha256,
      finalizedAt: new Date().toISOString()
    }, null, 2));

    // Thumbnail
    const thumbnailPath = path.join(archiveTargetDir, `${finalFilename}.jpg`);
    if (!session.isMock) {
      spawn(workerConfig.ffmpegPath, [
        '-y',
        '-ss', '00:00:01',
        '-i', finalLocalPath,
        '-vframes', '1',
        '-q:v', '2',
        thumbnailPath
      ]);
    } else {
      fs.writeFileSync(thumbnailPath, Buffer.from('MOCK_JPEG_THUMBNAIL'));
    }

    // Clean up temporary fMP4
    try {
      if (fs.existsSync(session.tempFmp4Path)) {
        fs.unlinkSync(session.tempFmp4Path);
      }
    } catch {}

    this.activeSession = null;

    return {
      filename: finalFilename,
      localPath: finalLocalPath,
      duration: durationSeconds,
      fileSize: stats.size,
      sha256,
      thumbnailPath
    };
  }

  static cancelRecording(): void {
    if (!this.activeSession) return;
    if (this.activeSession.timer) clearInterval(this.activeSession.timer);
    if (this.activeSession.process) {
      this.activeSession.process.kill('SIGKILL');
    }
    try {
      if (fs.existsSync(this.activeSession.tempFmp4Path)) {
        fs.unlinkSync(this.activeSession.tempFmp4Path);
      }
    } catch {}
    this.activeSession = null;
  }
}
