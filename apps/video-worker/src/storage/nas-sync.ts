import * as fs from 'node:fs';
import * as path from 'node:path';
import { workerConfig } from '../config.js';
import { calculateFileSha256 } from '@packing-proof/shared-utils';

export interface NasSyncResult {
  success: boolean;
  nasPath?: string;
  error?: string;
}

export class NasSyncService {
  static async syncFileToNas(params: {
    localPath: string;
    filename: string;
    expectedSha256: string;
  }): Promise<NasSyncResult> {
    try {
      if (!fs.existsSync(workerConfig.nasDir)) {
        return {
          success: false,
          error: `NAS share path is unreachable or not mounted: ${workerConfig.nasDir}`
        };
      }

      // Mirror relative subfolder structure (YYYY/MM/DD)
      const relative = path.relative(workerConfig.archiveDir, params.localPath);
      const targetNasDir = path.dirname(path.join(workerConfig.nasDir, relative));
      if (!fs.existsSync(targetNasDir)) {
        fs.mkdirSync(targetNasDir, { recursive: true });
      }

      const nasTmpPath = path.join(targetNasDir, `${params.filename}.tmp`);
      const nasFinalPath = path.join(targetNasDir, params.filename);

      // 1. Copy to temporary path on NAS
      fs.copyFileSync(params.localPath, nasTmpPath);

      // 2. Stream read NAS copy and verify SHA-256 (Finding D01-07)
      const remoteSha256 = await calculateFileSha256(nasTmpPath);
      if (remoteSha256.toLowerCase() !== params.expectedSha256.toLowerCase()) {
        try { fs.unlinkSync(nasTmpPath); } catch {}
        return {
          success: false,
          error: `Remote NAS SHA-256 mismatch! Expected: ${params.expectedSha256}, Got: ${remoteSha256}`
        };
      }

      // 3. Rename to final destination
      fs.renameSync(nasTmpPath, nasFinalPath);

      return {
        success: true,
        nasPath: nasFinalPath
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown NAS copy error'
      };
    }
  }
}
