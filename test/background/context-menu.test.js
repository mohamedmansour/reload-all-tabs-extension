/**
 * Unit tests for js/background/context-menu.js
 * Tests context menu management
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the module (it will use our mock)
const {
  updateContextMenu,
  onMenuClicked
} = await import('../../js/background/context-menu.js');

describe('updateContextMenu', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should remove all existing menu items before creating new ones', async () => {
    const removeAllSpy = mock.fn(() => Promise.resolve());
    chromeMock.contextMenus.removeAll = removeAllSpy;

    await updateContextMenu();

    assert.equal(removeAllSpy.mock.callCount(), 1);
  });

  it('should not create menu items for disabled settings', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('scheduledJobs', []); // Ensure no scheduled jobs
    chromeMock._setStorage('reloadWindow', false); // Disable reloadWindow (defaults to true)

    // All reload options disabled by default

    await updateContextMenu();

    // No menu items should be created (no reload options, no scheduled jobs)
    const reloadItems = createSpy.mock.calls.filter(
      call => call.arguments[0].id?.startsWith('reload')
    );
    assert.equal(reloadItems.length, 0);
  });

  it('should create reloadWindow menu item when enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadWindow', true);

    await updateContextMenu();

    const reloadWindowItem = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadWindow'
    );
    assert.ok(reloadWindowItem, 'reloadWindow menu item should be created');
  });

  it('should create reloadAllWindows menu item when enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadAllWindows', true);

    await updateContextMenu();

    const item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadAllWindows'
    );
    assert.ok(item, 'reloadAllWindows menu item should be created');
  });

  it('should create reloadPinnedOnly menu item when enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadPinnedOnly', true);

    await updateContextMenu();

    const item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadPinnedOnly'
    );
    assert.ok(item, 'reloadPinnedOnly menu item should be created');
  });

  it('should create reloadAllMatched menu item when enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadAllMatched', 'example.com');

    await updateContextMenu();

    const item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadAllMatched'
    );
    assert.ok(item, 'reloadAllMatched menu item should be created');
  });

  it('should create reloadSkipMatched menu item when enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadSkipMatched', 'example.com');

    await updateContextMenu();

    const item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadSkipMatched'
    );
    assert.ok(item, 'reloadSkipMatched menu item should be created');
  });

  it('should include "(cache bypassed)" in title when bypassCache is enabled', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadWindow', true);
    chromeMock._setStorage('bypassCache', true);

    await updateContextMenu();

    const item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadWindow'
    );
    assert.ok(item.arguments[0].title.includes('(cache bypassed)'));
  });

  it('should create tab groups submenu when reloadGroupedOnly is enabled and tabGroups permission is granted', async () => {
    chromeMock._addPermission('tabGroups');
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('reloadGroupedOnly', true);
    chromeMock.windows.getCurrent = async () => ({ id: 1 });
    chromeMock.tabGroups.query = async () => [
      { id: 100, color: 'blue', title: 'Work' },
      { id: 101, color: 'red', title: 'Personal' }
    ];

    await updateContextMenu();

    const parentItem = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'reloadGroupedOnly'
    );
    assert.ok(parentItem, 'reloadGroupedOnly parent menu should be created');

    const childItems = createSpy.mock.calls.filter(
      call => call.arguments[0].parentId === 'reloadGroupedOnly'
    );
    assert.equal(childItems.length, 2);
  });

  it('should create scheduled jobs menu when jobs exist', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', enabled: true },
      { id: '2', domain: 'other.com', enabled: false }
    ]);

    await updateContextMenu();

    const scheduledJobsItem = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'scheduledJobs'
    );
    assert.ok(scheduledJobsItem, 'scheduledJobs menu should be created');
    assert.ok(scheduledJobsItem.arguments[0].title.includes('1/2 active'));
  });

  it('should create start/stop all jobs menu items', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', enabled: true }
    ]);

    await updateContextMenu();

    const startAll = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'jobsStartAll'
    );
    const stopAll = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'jobsStopAll'
    );
    assert.ok(startAll, 'Start all jobs menu item should be created');
    assert.ok(stopAll, 'Stop all jobs menu item should be created');
  });

  it('should create checkbox menu items for each job', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com', enabled: true },
      { id: 'job2', domain: 'other.com', enabled: false }
    ]);

    await updateContextMenu();

    const job1Item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'jobToggle:job1'
    );
    const job2Item = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'jobToggle:job2'
    );

    assert.ok(job1Item, 'Job 1 toggle should be created');
    assert.equal(job1Item.arguments[0].type, 'checkbox');
    assert.equal(job1Item.arguments[0].checked, true);

    assert.ok(job2Item, 'Job 2 toggle should be created');
    assert.equal(job2Item.arguments[0].checked, false);
  });

  it('should truncate long domain names in job menu items', async () => {
    const createSpy = mock.fn();
    chromeMock.contextMenus.create = createSpy;
    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'this-is-a-very-long-domain-name-that-should-be-truncated.example.com', enabled: true }
    ]);

    await updateContextMenu();

    const jobItem = createSpy.mock.calls.find(
      call => call.arguments[0].id === 'jobToggle:job1'
    );

    assert.ok(jobItem.arguments[0].title.includes('...'));
    assert.ok(jobItem.arguments[0].title.length <= 50); // Reasonable length
  });
});

describe('onMenuClicked', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should toggle job when jobToggle menu item is clicked', async () => {
    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com', enabled: true }
    ]);

    await onMenuClicked({ menuItemId: 'jobToggle:job1' }, { windowId: 1 });

    const jobs = chromeMock._storage.get('scheduledJobs');
    assert.equal(jobs[0].enabled, false);
  });

  it('should reload window when reloadWindow is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://example.com' }];

    await onMenuClicked({ menuItemId: 'reloadWindow' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
  });

  it('should reload all windows when reloadAllWindows is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }, { id: 2 }];
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://example.com' }];

    await onMenuClicked({ menuItemId: 'reloadAllWindows' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 2);
  });

  it('should reload pinned tabs when reloadPinnedOnly is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com', pinned: true },
      { id: 2, url: 'https://other.com', pinned: false }
    ];

    await onMenuClicked({ menuItemId: 'reloadPinnedOnly' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
  });

  it('should reload unpinned tabs when reloadUnpinnedOnly is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com', pinned: true },
      { id: 2, url: 'https://other.com', pinned: false }
    ];

    await onMenuClicked({ menuItemId: 'reloadUnpinnedOnly' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should reload left tabs when reloadAllLeft is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://a.com', active: false },
      { id: 2, url: 'https://b.com', active: true },
      { id: 3, url: 'https://c.com', active: false }
    ];

    await onMenuClicked({ menuItemId: 'reloadAllLeft' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
  });

  it('should reload right tabs when reloadAllRight is clicked', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://a.com', active: false },
      { id: 2, url: 'https://b.com', active: true },
      { id: 3, url: 'https://c.com', active: false }
    ];

    await onMenuClicked({ menuItemId: 'reloadAllRight' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 3);
  });

  it('should reload matched tabs when reloadAllMatched is clicked', async () => {
    chromeMock._addPermission('tabs');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://other.com/page' }
    ];
    chromeMock._setStorage('reloadAllMatched', 'example.com');

    await onMenuClicked({ menuItemId: 'reloadAllMatched' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
  });

  it('should skip matched tabs when reloadSkipMatched is clicked', async () => {
    chromeMock._addPermission('tabs');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://other.com/page' }
    ];
    chromeMock._setStorage('reloadSkipMatched', 'example.com');

    await onMenuClicked({ menuItemId: 'reloadSkipMatched' }, { windowId: 1 });

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should reload tab group when submenu item is clicked', async () => {
    chromeMock._addPermission('tabGroups');
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://other.com' }
    ];

    await onMenuClicked(
      { menuItemId: '100', parentMenuItemId: 'reloadGroupedOnly' },
      { windowId: 1 }
    );

    // Wait for async reload operation
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(reloadSpy.mock.callCount(), 2);
  });

  it('should start all jobs when jobsStartAll is clicked', async () => {
    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'a.com', enabled: false },
      { id: 'job2', domain: 'b.com', enabled: false }
    ]);

    await onMenuClicked({ menuItemId: 'jobsStartAll' }, { windowId: 1 });

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 50));

    const jobs = chromeMock._storage.get('scheduledJobs');
    assert.equal(jobs[0].enabled, true);
    assert.equal(jobs[1].enabled, true);
  });

  it('should stop all jobs when jobsStopAll is clicked', async () => {
    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'a.com', enabled: true },
      { id: 'job2', domain: 'b.com', enabled: true }
    ]);

    await onMenuClicked({ menuItemId: 'jobsStopAll' }, { windowId: 1 });

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 50));

    const jobs = chromeMock._storage.get('scheduledJobs');
    assert.equal(jobs[0].enabled, false);
    assert.equal(jobs[1].enabled, false);
  });

  it('should open options page when jobsManage is clicked', async () => {
    const openOptionsSpy = mock.fn();
    chromeMock.runtime.openOptionsPage = openOptionsSpy;

    await onMenuClicked({ menuItemId: 'jobsManage' }, { windowId: 1 });

    assert.equal(openOptionsSpy.mock.callCount(), 1);
  });
});
