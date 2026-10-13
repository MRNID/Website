import { CarrierPlatform } from '@packing-proof/shared-types';

export interface BarcodeMatchResult {
  isValid: boolean;
  platform: CarrierPlatform;
  cleanedCode: string;
}

const CARRIER_PATTERNS: Array<{ platform: CarrierPlatform; regex: RegExp }> = [
  { platform: 'SPX', regex: /^SPXVN[0-9A-Z]{8,20}$/i },
  { platform: 'TIKTOK', regex: /^TT[A-Z0-9]{8,25}$/i },
  { platform: 'LAZADA', regex: /^(LX|LEX)[A-Z0-9\-]{8,25}$/i },
  { platform: 'GHTK', regex: /^S[0-9]{7,12}(\.[A-Z0-9]+)*$/i },
  { platform: 'GHN', regex: /^G[A-Z0-9]{7,15}$/i },
  { platform: 'JT', regex: /^(84|66|88)[0-9]{10,12}$/ },
  { platform: 'VIETTEL_POST', regex: /^[0-9]{10,14}$/ },
  { platform: 'OTHER', regex: /^[A-Z0-9\-_]{6,32}$/i }
];

export function validateAndCleanBarcode(rawCode: string): BarcodeMatchResult {
  if (!rawCode || typeof rawCode !== 'string') {
    return {
      isValid: false,
      platform: 'OTHER',
      cleanedCode: ''
    };
  }

  const cleaned = rawCode.trim().toUpperCase();

  if (!cleaned || cleaned.length < 6) {
    return {
      isValid: false,
      platform: 'OTHER',
      cleanedCode: ''
    };
  }

  for (const item of CARRIER_PATTERNS) {
    if (item.regex.test(cleaned)) {
      return {
        isValid: true,
        platform: item.platform,
        cleanedCode: cleaned
      };
    }
  }

  return {
    isValid: false,
    platform: 'OTHER',
    cleanedCode: ''
  };
}
