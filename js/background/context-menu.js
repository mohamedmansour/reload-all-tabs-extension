/**
 * Context menu management module
 */

import { getSetting } from '../shared/storage.js';
import { hasPermission } from '../shared/permissions.js';
import { reloadWindow, reloadAllWindows, reloadGroupedTabs } from './reload.js';
import { setAllJobsEnabled, toggleJobEnabled } from './scheduler.js';

// Mutex to prevent concurrent context menu updates
let isUpdatingContextMenu = false;
let pendingContextMenuUpdate = false;

/**
 * Update context menu based on user settings
 */
export const updateContextMenu = async () => {
  if (isUpdatingContextMenu) {
    pendingContextMenuUpdate = true;
    return;
  }

  isUpdatingContextMenu = true;

  try {
    await chrome.contextMenus.removeAll();

    const setting = await getSetting([
      'bypassCache',
      'reloadWindow',
      'reloadAllWindows',
      'reloadPinnedOnly',
      'reloadUnpinnedOnly',
      'reloadAllLeft',
      'reloadAllRight',
      'reloadAllMatched',
      'reloadGroupedOnly'
    ]);

    const attributions = setting.bypassCache ? ' (cache bypassed)' : '';

    const menuItems = [
      { id: 'reloadWindow', enabled: setting.reloadWindow, title: `Reload this window${attributions}` },
      { id: 'reloadAllWindows', enabled: setting.reloadAllWindows, title: `Reload all windows${attributions}` },
      { id: 'reloadPinnedOnly', enabled: setting.reloadPinnedOnly, title: `Reload pinned tabs${attributions}` },
      { id: 'reloadUnpinnedOnly', enabled: setting.reloadUnpinnedOnly, title: `Reload unpinned tabs${attributions}` },
      { id: 'reloadAllLeft', enabled: setting.reloadAllLeft, title: `Reload all tabs to the left${attributions}` },
      { id: 'reloadAllRight', enabled: setting.reloadAllRight, title: `Reload all tabs to the right${attributions}` },
      { id: 'reloadAllMatched', enabled: setting.reloadAllMatched, title: `Reload all tabs with matched urls${attributions}` }
    ];

    for (const item of menuItems) {
      if (item.enabled) {
        chrome.contextMenus.create({
          id: item.id,
          type: 'normal',
          title: item.title,
          contexts: ['all']
        });
      }
    }

    if (setting.reloadGroupedOnly) {
      const hasTabGroupsPermission = await hasPermission('tabGroups');
      if (hasTabGroupsPermission) {
        const currentTab = await chrome.windows.getCurrent();
        // Bug in chromium where last opened window overrides the getcurrent only in tab group picker.
        if (currentTab.focused) {
          const windowId = currentTab.id;
          const tabGroups = await chrome.tabGroups.query({ windowId });
          console.info('Found tab groups for context menu:', tabGroups.length, windowId, currentTab);
          if (tabGroups.length > 0) {
            chrome.contextMenus.create({
              id: 'reloadGroupedOnly',
              type: 'normal',
              title: `Reload tab groups${attributions}`,
              contexts: ['all']
            });

            const colorEmojis = {
              grey: '⬛',
              blue: '🟦',
              red: '🟥',
              yellow: '🟨',
              green: '🟩',
              pink: '⬜',
              purple: '🟪',
              cyan: '🟦',
              orange: '🟧'
            };

            for (const tabGroup of tabGroups) {
              const colorEmoji = colorEmojis[tabGroup.color] || '⬛';
              const groupTitle = tabGroup.title || 'Unnamed';

              chrome.contextMenus.create({
                id: `${tabGroup.id}`,
                parentId: 'reloadGroupedOnly',
                type: 'normal',
                title: `${colorEmoji} ${groupTitle}`,
                contexts: ['all']
              });
            }
          }
        }
      }
    }

    // Add Scheduled Jobs menu
    const { scheduledJobs } = await getSetting(['scheduledJobs']);

    if (Array.isArray(scheduledJobs) && scheduledJobs.length > 0) {
      const activeCount = scheduledJobs.filter((job) => job.enabled !== false).length;
      const totalCount = scheduledJobs.length;

      chrome.contextMenus.create({
        id: 'scheduledJobsSeparator',
        type: 'separator',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'scheduledJobs',
        type: 'normal',
        title: `Scheduled jobs (${activeCount}/${totalCount} active)`,
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'jobsStartAll',
        parentId: 'scheduledJobs',
        type: 'normal',
        title: '▶ Start all jobs',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'jobsStopAll',
        parentId: 'scheduledJobs',
        type: 'normal',
        title: '⏸ Stop all jobs',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'jobsSeparator1',
        parentId: 'scheduledJobs',
        type: 'separator',
        contexts: ['all']
      });

      for (const job of scheduledJobs) {
        const isEnabled = job.enabled !== false;
        const domain = job.domain.length > 30 ? `${job.domain.slice(0, 27)}...` : job.domain;
        const jobTitle = `${domain} (${isEnabled ? 'Active' : 'Paused'})`;
        chrome.contextMenus.create({
          id: `jobToggle:${job.id}`,
          parentId: 'scheduledJobs',
          type: 'checkbox',
          title: jobTitle,
          checked: isEnabled,
          contexts: ['all']
        });
      }

      chrome.contextMenus.create({
        id: 'jobsSeparator2',
        parentId: 'scheduledJobs',
        type: 'separator',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'jobsManage',
        parentId: 'scheduledJobs',
        type: 'normal',
        title: '⚙ Manage jobs',
        contexts: ['all']
      });
    }
  } finally {
    isUpdatingContextMenu = false;

    if (pendingContextMenuUpdate) {
      pendingContextMenuUpdate = false;
      await updateContextMenu();
    }
  }
};

/**
 * Handle context menu clicks
 * @param {Object} info Click info
 * @param {chrome.tabs.Tab} tab The tab where the context menu was clicked
 */
export const onMenuClicked = async (info, tab) => {
  const { parentMenuItemId, menuItemId } = info;
  const windowId = tab?.windowId;

  if (menuItemId.startsWith('jobToggle:')) {
    const jobId = menuItemId.slice('jobToggle:'.length);
    await toggleJobEnabled(jobId);
    return;
  }

  const menuActions = {
    reloadWindow: () => reloadWindow({ id: windowId }),
    reloadAllWindows: () => reloadAllWindows(),
    reloadPinnedOnly: () => reloadWindow({ id: windowId }, { reloadPinnedOnly: true }),
    reloadUnpinnedOnly: () => reloadWindow({ id: windowId }, { reloadUnpinnedOnly: true }),
    reloadAllLeft: () => reloadWindow({ id: windowId }, { reloadAllLeft: true }),
    reloadAllRight: () => reloadWindow({ id: windowId }, { reloadAllRight: true }),
    reloadAllMatched: () => reloadWindow({ id: windowId }, { reloadAllMatched: true }),
    reloadGroupedOnly: () => reloadGroupedTabs(windowId, +menuItemId),
    jobsStartAll: async () => await setAllJobsEnabled(true),
    jobsStopAll: async () => await setAllJobsEnabled(false),
    jobsManage: () => chrome.runtime.openOptionsPage()
  };

  let itemId = menuItemId;

  if (parentMenuItemId === 'reloadGroupedOnly') {
    itemId = parentMenuItemId;
  }

  menuActions[itemId]?.();
};
