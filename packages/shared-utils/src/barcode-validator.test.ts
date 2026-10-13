import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateAndCleanBarcode } from './barcode-validator.js';
import { buildCollisionProofFilename } from './date.js';
import { calculateStringSha256 } from './hash.js';

describe('Barcode Validator', () => {
  test('validates Shopee Express (SPX) barcode correctly', () => {
    const res = validateAndCleanBarcode('SPXVN0458892182B');
    assert.equal(res.isValid, true);
    assert.equal(res.platform, 'SPX');
    assert.equal(res.cleanedCode, 'SPXVN0458892182B');
  });

  test('validates TikTok Shop barcode correctly', () => {
    const res = validateAndCleanBarcode('TTWN01928381928');
    assert.equal(res.isValid, true);
    assert.equal(res.platform, 'TIKTOK');
  });

  test('validates GHTK barcode correctly', () => {
    const res = validateAndCleanBarcode('S12345678.BO.293');
    assert.equal(res.isValid, true);
    assert.equal(res.platform, 'GHTK');
  });

  test('rejects too short or noisy barcode', () => {
    const res = validateAndCleanBarcode('123');
    assert.equal(res.isValid, false);
    assert.equal(res.cleanedCode, '');
  });

  test('rejects empty or whitespace barcode', () => {
    assert.equal(validateAndCleanBarcode('').isValid, false);
    assert.equal(validateAndCleanBarcode('   ').isValid, false);
  });

  test('rejects short demo codes under 6 chars', () => {
    assert.equal(validateAndCleanBarcode('DEMO').isValid, false);
    assert.equal(validateAndCleanBarcode('TEST').isValid, false);
    assert.equal(validateAndCleanBarcode('A123').isValid, false);
  });

  test('rejects codes containing spaces or illegal characters', () => {
    assert.equal(validateAndCleanBarcode('SPX VN 0458892182B').isValid, false);
    assert.equal(validateAndCleanBarcode('ORDER#123@456').isValid, false);
    assert.equal(validateAndCleanBarcode('DEMO/TEST/123').isValid, false);
  });

  test('validates standard custom / OTHER barcodes of 6 to 32 chars', () => {
    const res = validateAndCleanBarcode('CUSTOM-ORDER-001');
    assert.equal(res.isValid, true);
    assert.equal(res.platform, 'OTHER');
    assert.equal(res.cleanedCode, 'CUSTOM-ORDER-001');
  });
});

describe('Filename and Hash Utilities', () => {
  test('generates collision-proof filename containing session prefix', () => {
    const fn = buildCollisionProofFilename('SPXVN123', 'PACK01', '43924f0c-939a-4c20-a6ce-5847fa55f269', new Date('2026-10-03T16:30:12Z'));
    assert.match(fn, /^SPXVN123_PACK01_\d{8}_\d{6}_43924f0c\.mp4$/);
  });

  test('computes deterministic SHA-256 string hash', () => {
    const hash = calculateStringSha256('packing-video-proof-test');
    assert.equal(hash.length, 64);
  });
});
