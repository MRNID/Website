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
  private cooldownMs = 1200; // 1.2s cooldown to allow consecutive scanning of same SKU

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

  private offscreenCanvas: HTMLCanvasElement | null = null;

  private getOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    this.offscreenCanvas.width = w;
    this.offscreenCanvas.height = h;
    return this.offscreenCanvas;
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
          // Fall through to enhanced canvas
        }
      }

      // 2. Preprocessed ROI Canvas Pass (High-Contrast Grayscale of Center 65% area)
      if (!rawText && typeof document !== 'undefined') {
        try {
          const srcW = (element as any).naturalWidth || element.width;
          const srcH = (element as any).naturalHeight || element.height;
          if (srcW > 0 && srcH > 0) {
            const cropW = Math.round(srcW * 0.65);
            const cropH = Math.round(srcH * 0.65);
            const cropX = Math.round((srcW - cropW) / 2);
            const cropY = Math.round((srcH - cropH) / 2);

            const canvas = this.getOffscreenCanvas(cropW, cropH);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(element, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const imgData = ctx.getImageData(0, 0, cropW, cropH);
              const d = imgData.data;
              for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                const val = gray < 130 ? 0 : 255;
                d[i] = val;
                d[i + 1] = val;
                d[i + 2] = val;
              }
              ctx.putImageData(imgData, 0, 0);

              if (this.nativeDetector) {
                try {
                  const enResults = await this.nativeDetector.detect(canvas);
                  if (enResults && enResults.length > 0) {
                    rawText = enResults[0].rawValue;
                  }
                } catch {}
              }

              if (!rawText) {
                try {
                  const zxRes = await this.zxingReader.decodeFromCanvas(canvas);
                  if (zxRes) rawText = zxRes.getText();
                } catch {}
              }
            }
          }
        } catch {}
      }

      // 3. Fallback to Full Frame ZXing
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
