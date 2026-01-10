/**
 * Unit tests for js/shared/storage.js
 * Tests storage utilities using parameterized test cases
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the module (it will use our mock)
const { getSetting } = await import('../../js/shared/storage.js');

// ============================================================================
// Test Case Definitions
// ============================================================================

/**
 * Boolean settings that default to false and require strict true check
 */
const BOOLEAN_FALSE_DEFAULT_SETTINGS = [
  'reloadAllWindows',
  'reloadPinnedOnly',
  'reloadUnpinnedOnly',
  'reloadGroupedOnly',
  'reloadAllRight',
  'reloadAllLeft',
  'bypassCache',
  'excludeActiveTab',
  'excludeAudioTabs',
];

/**
 * String/raw settings that return undefined when not set
 */
const RAW_SETTINGS = ['reloadAllMatched', 'reloadSkipMatched', 'skipMatchedTabs', 'version'];

/**
 * Special case settings with unique behavior
 */
const SPECIAL_SETTINGS_CASES = [
  // buttonDefaultAction - defaults to 'window'
  { key: 'buttonDefaultAction', stored: undefined, expected: 'window', name: 'default' },
  { key: 'buttonDefaultAction', stored: 'allWindows', expected: 'allWindows', name: 'stored value' },
  { key: 'buttonDefaultAction', stored: 'pinned', expected: 'pinned', name: 'custom value' },

  // reloadWindow - defaults to true (unique boolean)
  { key: 'reloadWindow', stored: undefined, expected: true, name: 'default (true)' },
  { key: 'reloadWindow', stored: true, expected: true, name: 'stored true' },
  { key: 'reloadWindow', stored: false, expected: false, name: 'stored false' },
  { key: 'reloadWindow', stored: 'true', expected: false, name: 'string truthy (strict check)' },

  // reloadDelay - parses as integer, defaults to 0
  { key: 'reloadDelay', stored: undefined, expected: 0, name: 'default' },
  { key: 'reloadDelay', stored: '500', expected: 500, name: 'string to int' },
  { key: 'reloadDelay', stored: 1000, expected: 1000, name: 'integer value' },

  // scheduledJobs - defaults to empty array
  { key: 'scheduledJobs', stored: undefined, expected: [], name: 'default empty array', deep: true },
  { key: 'scheduledJobs', stored: [{ id: '1' }], expected: [{ id: '1' }], name: 'stored array', deep: true },
  { key: 'scheduledJobs', stored: 'invalid', expected: [], name: 'non-array returns empty', deep: true },
  { key: 'scheduledJobs', stored: null, expected: [], name: 'null returns empty', deep: true },
];

// ============================================================================
// Parameterized Test Execution
// ============================================================================

describe('getSetting', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  // Special case settings
  describe('special settings', () => {
    for (const { key, stored, expected, name, deep } of SPECIAL_SETTINGS_CASES) {
      it(`${key}: ${name}`, async () => {
        if (stored !== undefined) {
          chromeMock._setStorage(key, stored);
        }
        const result = await getSetting([key]);
        if (deep) {
          assert.deepEqual(result[key], expected);
        } else {
          assert.equal(result[key], expected);
        }
      });
    }
  });

  // Boolean settings defaulting to false
  describe('boolean settings (default false)', () => {
    for (const setting of BOOLEAN_FALSE_DEFAULT_SETTINGS) {
      it(`${setting}: returns false when not set`, async () => {
        const result = await getSetting([setting]);
        assert.equal(result[setting], false);
      });

      it(`${setting}: returns true when set to true`, async () => {
        chromeMock._setStorage(setting, true);
        const result = await getSetting([setting]);
        assert.equal(result[setting], true);
      });

      it(`${setting}: returns false when set to false`, async () => {
        chromeMock._setStorage(setting, false);
        const result = await getSetting([setting]);
        assert.equal(result[setting], false);
      });

      it(`${setting}: returns false for truthy non-boolean`, async () => {
        chromeMock._setStorage(setting, 1);
        const result = await getSetting([setting]);
        assert.equal(result[setting], false);
      });
    }
  });

  // Raw/string settings
  describe('raw settings (undefined default)', () => {
    for (const setting of RAW_SETTINGS) {
      it(`${setting}: returns undefined when not set`, async () => {
        const result = await getSetting([setting]);
        assert.equal(result[setting], undefined);
      });

      it(`${setting}: returns stored value`, async () => {
        chromeMock._setStorage(setting, 'test-value');
        const result = await getSetting([setting]);
        assert.equal(result[setting], 'test-value');
      });
    }
  });

  // Multiple keys fetch
  describe('multiple keys', () => {
    it('fetches multiple settings at once', async () => {
      chromeMock._setStorage('bypassCache', true);
      chromeMock._setStorage('reloadDelay', 100);

      const result = await getSetting(['bypassCache', 'reloadDelay', 'reloadWindow']);

      assert.equal(result.bypassCache, true);
      assert.equal(result.reloadDelay, 100);
      assert.equal(result.reloadWindow, true); // default
    });

    it('handles mix of set and unset values', async () => {
      chromeMock._setStorage('bypassCache', true);

      const result = await getSetting(['bypassCache', 'excludeActiveTab']);

      assert.equal(result.bypassCache, true);
      assert.equal(result.excludeActiveTab, false); // default
    });
  });

  // Unknown keys
  describe('unknown keys', () => {
    it('returns undefined for unknown keys', async () => {
      const result = await getSetting(['unknownKey']);
      assert.equal(result.unknownKey, undefined);
    });
  });
});
