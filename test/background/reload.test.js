/**
 * Unit tests for js/background/reload.js
 * Tests tab reload strategies
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the module (it will use our mock)
const {
  reloadWindow,
  reloadAllWindows,
  reload,
  reloadGroupedTabs
} = await import('../../js/background/reload.js');

describe('reloadWindow', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should reload all tabs in a window', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1' },
      { id: 2, url: 'https://example.com/2' }
    ];

    await reloadWindow({ id: 1 });

    assert.equal(reloadSpy.mock.callCount(), 2);
  });

  it('should skip active tab when excludeActiveTab is enabled', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', active: true },
      { id: 2, url: 'https://example.com/2', active: false }
    ];
    chromeMock._setStorage('excludeActiveTab', true);

    await reloadWindow({ id: 1 });

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should skip audible tabs when excludeAudioTabs is enabled', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', audible: true },
      { id: 2, url: 'https://example.com/2', audible: false }
    ];
    chromeMock._setStorage('excludeAudioTabs', true);

    await reloadWindow({ id: 1 });

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should only reload pinned tabs when reloadPinnedOnly is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', pinned: true },
      { id: 2, url: 'https://example.com/2', pinned: false }
    ];

    await reloadWindow({ id: 1 }, { reloadPinnedOnly: true });

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
  });

  it('should only reload unpinned tabs when reloadUnpinnedOnly is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', pinned: true },
      { id: 2, url: 'https://example.com/2', pinned: false }
    ];

    await reloadWindow({ id: 1 }, { reloadUnpinnedOnly: true });

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should reload tabs to the left of active tab when reloadAllLeft is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    // Tabs are returned in order by index
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', active: false },
      { id: 2, url: 'https://example.com/2', active: false },
      { id: 3, url: 'https://example.com/3', active: true },
      { id: 4, url: 'https://example.com/4', active: false }
    ];

    await reloadWindow({ id: 1 }, { reloadAllLeft: true });

    assert.equal(reloadSpy.mock.callCount(), 2);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
    assert.equal(reloadSpy.mock.calls[1].arguments[0], 2);
  });

  it('should reload tabs to the right of active tab when reloadAllRight is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    // Tabs are returned in order by index
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1', active: false },
      { id: 2, url: 'https://example.com/2', active: true },
      { id: 3, url: 'https://example.com/3', active: false },
      { id: 4, url: 'https://example.com/4', active: false }
    ];

    await reloadWindow({ id: 1 }, { reloadAllRight: true });

    assert.equal(reloadSpy.mock.callCount(), 2);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 3);
    assert.equal(reloadSpy.mock.calls[1].arguments[0], 4);
  });

  it('should only reload matched tabs when reloadAllMatched is set', async () => {
    chromeMock._addPermission('tabs');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://other.com/page' },
      { id: 3, url: 'https://example.com/another' }
    ];
    chromeMock._setStorage('reloadAllMatched', 'example.com');

    await reloadWindow({ id: 1 }, { reloadAllMatched: true });

    assert.equal(reloadSpy.mock.callCount(), 2);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
    assert.equal(reloadSpy.mock.calls[1].arguments[0], 3);
  });

  it('should skip matched tabs when reloadSkipMatched is set', async () => {
    chromeMock._addPermission('tabs');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://other.com/page' },
      { id: 3, url: 'https://example.com/another' }
    ];
    chromeMock._setStorage('reloadSkipMatched', 'example.com');

    await reloadWindow({ id: 1 }, { reloadSkipMatched: true });

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should use bypassCache setting when reloading', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1' }
    ];
    chromeMock._setStorage('bypassCache', true);

    await reloadWindow({ id: 1 });

    assert.equal(reloadSpy.mock.calls[0].arguments[1].bypassCache, true);
  });

  it('should apply reloadDelay between tabs', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1' },
      { id: 2, url: 'https://example.com/2' }
    ];
    chromeMock._setStorage('reloadDelay', 10);

    const start = Date.now();
    await reloadWindow({ id: 1 });
    const elapsed = Date.now() - start;

    // Should have waited at least 10ms between the two tabs
    assert.ok(elapsed >= 10, `Expected at least 10ms delay, got ${elapsed}ms`);
  });
});

describe('reloadAllWindows', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should reload all tabs in all windows', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }, { id: 2 }];
    chromeMock.tabs.query = async ({ windowId }) => {
      if (windowId === 1) return [{ id: 1, url: 'https://a.com' }];
      if (windowId === 2) return [{ id: 2, url: 'https://b.com' }];
      return [];
    };

    await reloadAllWindows();

    assert.equal(reloadSpy.mock.callCount(), 2);
  });
});

describe('reloadGroupedTabs', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should not reload if tabGroups permission is missing', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;

    await reloadGroupedTabs(1, 100);

    assert.equal(reloadSpy.mock.callCount(), 0);
  });

  it('should reload tabs in a specific group', async () => {
    chromeMock._addPermission('tabGroups');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/1' },
      { id: 2, url: 'https://example.com/2' }
    ];

    await reloadGroupedTabs(1, 100);

    assert.equal(reloadSpy.mock.callCount(), 2);
  });
});

describe('reload', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should reload current window by default', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    let getCurrent = null;
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://example.com' }];
    chromeMock.windows.getCurrent = (callback) => {
      callback({ id: 1 });
    };

    await reload();

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(reloadSpy.mock.callCount(), 1);
  });

  it('should reload all windows when buttonDefaultAction is allWindows', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }, { id: 2 }];
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://example.com' }];
    chromeMock._setStorage('buttonDefaultAction', 'allWindows');

    await reload();

    // Wait for async reload operations
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 2);
  });

  it('should reload only pinned when buttonDefaultAction is pinned', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com', pinned: true },
      { id: 2, url: 'https://other.com', pinned: false }
    ];
    chromeMock.windows.getCurrent = (callback) => {
      callback({ id: 1 });
    };
    chromeMock._setStorage('buttonDefaultAction', 'pinned');

    await reload();

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
  });

  it('should reload only unpinned when buttonDefaultAction is unpinned', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com', pinned: true },
      { id: 2, url: 'https://other.com', pinned: false }
    ];
    chromeMock.windows.getCurrent = (callback) => {
      callback({ id: 1 });
    };
    chromeMock._setStorage('buttonDefaultAction', 'unpinned');

    await reload();

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });
});
