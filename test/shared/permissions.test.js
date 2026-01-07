/**
 * Unit tests for js/shared/permissions.js
 * Tests permission utilities using parameterized test cases
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the module (it will use our mock)
const { hasPermission, hasPermissions, requestPermissions, PERMISSION_REQUIREMENTS } =
  await import('../../js/shared/permissions.js');

// ============================================================================
// Test Case Definitions
// ============================================================================

/** Permission requirements mapping tests */
const PERMISSION_REQUIREMENT_CASES = [
  { setting: 'reloadGroupedOnly', permissions: ['tabGroups'] },
  { setting: 'reloadAllMatched', permissions: ['tabs'] },
  { setting: 'reloadSkipMatched', permissions: ['tabs'] },
];

/** hasPermission test cases */
const HAS_PERMISSION_CASES = [
  { name: 'granted permission', permission: 'tabs', setup: (m) => m._addPermission('tabs'), expected: true },
  { name: 'non-granted permission', permission: 'tabs', setup: () => { }, expected: false },
  { name: 'default permission (storage)', permission: 'storage', setup: () => { }, expected: true },
  { name: 'default permission (contextMenus)', permission: 'contextMenus', setup: () => { }, expected: true },
];

/** hasPermissions test cases */
const HAS_PERMISSIONS_CASES = [
  {
    name: 'all permissions granted',
    permissions: ['tabs', 'alarms'],
    setup: (m) => { m._addPermission('tabs'); m._addPermission('alarms'); },
    expected: true,
  },
  {
    name: 'some permissions not granted',
    permissions: ['tabs', 'alarms'],
    setup: (m) => m._addPermission('tabs'),
    expected: false,
  },
  {
    name: 'no permissions granted',
    permissions: ['tabs', 'alarms'],
    setup: () => { },
    expected: false,
  },
  {
    name: 'empty permission list',
    permissions: [],
    setup: () => { },
    expected: true,
  },
];

// ============================================================================
// Parameterized Test Execution
// ============================================================================

describe('PERMISSION_REQUIREMENTS', () => {
  for (const { setting, permissions } of PERMISSION_REQUIREMENT_CASES) {
    it(`${setting} requires ${JSON.stringify(permissions)}`, () => {
      assert.deepEqual(PERMISSION_REQUIREMENTS[setting], permissions);
    });
  }
});

describe('hasPermission', () => {
  for (const { name, permission, setup, expected } of HAS_PERMISSION_CASES) {
    it(`should return ${expected} for ${name}`, async () => {
      resetChromeMock(chromeMock);
      setup(chromeMock);
      const result = await hasPermission(permission);
      assert.equal(result, expected);
    });
  }
});

describe('hasPermissions', () => {
  for (const { name, permissions, setup, expected } of HAS_PERMISSIONS_CASES) {
    it(`should return ${expected} when ${name}`, async () => {
      resetChromeMock(chromeMock);
      setup(chromeMock);
      const result = await hasPermissions(permissions);
      assert.equal(result, expected);
    });
  }
});

describe('requestPermissions', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should request and grant permissions', async () => {
    const result = await requestPermissions(['tabs']);
    assert.equal(result, true);

    // Verify permission was added
    const hasIt = await hasPermission('tabs');
    assert.equal(hasIt, true);
  });

  it('should request multiple permissions', async () => {
    const result = await requestPermissions(['tabs', 'alarms']);
    assert.equal(result, true);

    const hasTabs = await hasPermission('tabs');
    const hasAlarms = await hasPermission('alarms');
    assert.equal(hasTabs, true);
    assert.equal(hasAlarms, true);
  });
});
