import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { computeNextStationCode } from './station-sync.js';

describe('Mobile Station Synchronization (SH-R1-01)', () => {
  test('initial render with empty stations returns empty string without falling back to PACK01', () => {
    const result = computeNextStationCode('', undefined, [], false);
    assert.equal(result, '');
    assert.notEqual(result, 'PACK01');
  });

  test('async station load with PACK02 defaults to PACK02 on mobile render', () => {
    // Initial mount: empty
    let active = computeNextStationCode('', undefined, [], false);
    assert.equal(active, '');

    // Asynchronously stations arrive from server
    const asyncStations = [
      { id: 'st-02', code: 'PACK02', name: 'Trạm Đóng Gói 02' },
      { id: 'st-03', code: 'PACK03', name: 'Trạm Đóng Gói 03' }
    ];

    active = computeNextStationCode(active, undefined, asyncStations, false);
    assert.equal(active, 'PACK02');
  });

  test('preserves user manual selection if valid in updated stations list', () => {
    const stations = [
      { id: 'st-01', code: 'PACK01' },
      { id: 'st-02', code: 'PACK02' },
      { id: 'st-mob', code: 'MOBILE01' }
    ];

    // User chose MOBILE01
    const userSelected = 'MOBILE01';
    const next = computeNextStationCode(userSelected, undefined, stations, false);
    assert.equal(next, 'MOBILE01');
  });

  test('locks station switching during active recording or uploading', () => {
    const isLocked = true; // recording or uploading
    const stations = [
      { id: 'st-02', code: 'PACK02' },
      { id: 'st-03', code: 'PACK03' }
    ];

    // Attempting to change or prop arriving while locked
    const next = computeNextStationCode('PACK02', 'PACK03', stations, isLocked);
    assert.equal(next, 'PACK02', 'Station must remain locked to PACK02 while recording/uploading');
  });

  test('falls back cleanly to first allowed station if selected station was revoked/removed', () => {
    const oldSelection = 'PACK_OLD_DELETED';
    const currentStations = [
      { id: 'st-02', code: 'PACK02' },
      { id: 'st-03', code: 'PACK03' }
    ];

    const next = computeNextStationCode(oldSelection, undefined, currentStations, false);
    assert.equal(next, 'PACK02');
  });
});
