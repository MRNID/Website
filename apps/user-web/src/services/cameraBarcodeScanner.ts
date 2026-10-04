import { BrowserMultiFormatReader } from '@zxing/browser';

export interface DetectedBarcodeResult {
  rawValue: string;
  cleanedCode: string;
  carrier?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class CameraBarcodeScanner {
  private zxingReader: BrowserMultiFormatReader;
  private nativeDetector: any = null;
  private isScanning = false;
  private lastScannedCode: string | null = null;
  private lastScannedTime = 0;
  private cooldownMs = 3500; // Prevent spamming same barcode

  constructor() {
    this.zxingReader = new BrowserMultiFormatReader();
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        this.nativeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'itf', 'data_matrix', 'upc_a', 'upc_e']
        });
      } catch (e) {
        console.warn('Native BarcodeDetector initialization fallback to ZXing:', e);
      }
    }
  }

  /**
   * Scan single frame from Image or Canvas element
   */
  async scanFrame(
    element: HTMLImageElement | HTMLCanvasElement
  ): Promise<DetectedBarcodeResult | null> {
    if (this.isScanning) return null;
    this.isScanning = true;

    try {
      let rawText: string | null = null;
      let boundingBox: any = undefined;

      // 1. Try Hardware-Accelerated Native BarcodeDetector (Chrome/Chromium)
      if (this.nativeDetector) {
        try {
          const results = await this.nativeDetector.detect(element);
          if (results && results.length > 0) {
            const first = results[0];
            rawText = first.rawValue;
            if (first.boundingBox) {
              boundingBox = {
                x: first.boundingBox.x,
                y: first.boundingBox.y,
                width: first.boundingBox.width,
                height: first.boundingBox.height
              };
            }
          }
        } catch {
          // Fall through to ZXing
        }
      }

      // 2. Fallback to ZXing BrowserMultiFormatReader
      if (!rawText) {
        try {
          let result: any = null;
          if (element instanceof HTMLImageElement) {
            result = await this.zxingReader.decodeFromImageElement(element);
          } else if (element instanceof HTMLCanvasElement) {
            result = await this.zxingReader.decodeFromCanvas(element);
          }
          if (result) {
            rawText = result.getText();
          }
        } catch {
          // No barcode found in this frame - normal
        }
      }

      if (!rawText) return null;

      const cleaned = rawText.trim().toUpperCase();
      if (cleaned.length < 5 || cleaned.length > 45) return null;

      // Detect carrier pattern
      let carrier = 'OTHER';
      if (/^SPXVN/i.test(cleaned)) carrier = 'SPX';
      else if (/^TT/i.test(cleaned)) carrier = 'TIKTOK';
      else if (/^(LX|LEX)/i.test(cleaned)) carrier = 'LAZADA';
      else if (/^S[0-9]/i.test(cleaned)) carrier = 'GHTK';
      else if (/^G[A-Z0-9]/i.test(cleaned)) carrier = 'GHN';
      else if (/^(84|66|88)[0-9]/i.test(cleaned)) carrier = 'JT';

      // Enforce cooldown for same barcode
      const now = Date.now();
      if (this.lastScannedCode === cleaned && now - this.lastScannedTime < this.cooldownMs) {
        return null;
      }

      this.lastScannedCode = cleaned;
      this.lastScannedTime = now;

      return {
        rawValue: rawText.trim(),
        cleanedCode: cleaned,
        carrier,
        boundingBox
      };
    } finally {
      this.isScanning = false;
    }
  }

  resetCooldown() {
    this.lastScannedCode = null;
    this.lastScannedTime = 0;
  }
}

export const cameraBarcodeScanner = new CameraBarcodeScanner();
