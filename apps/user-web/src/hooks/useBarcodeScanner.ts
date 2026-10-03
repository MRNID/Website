import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 4,
  maxIntervalMs = 50
}: UseBarcodeScannerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when user is in a dialog input unless it's explicitly allowed
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const candidate = bufferRef.current.trim();
        bufferRef.current = '';

        if (candidate.length >= minChars) {
          e.preventDefault();
          onScan(candidate);
        }
        return;
      }

      // If key is printable
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (interval > maxIntervalMs) {
          // If slow typing and focus is in a normal text input, reset buffer
          if (isInput && !target.hasAttribute('data-barcode-catcher')) {
            bufferRef.current = '';
            return;
          }
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minChars, maxIntervalMs, onScan]);
}
