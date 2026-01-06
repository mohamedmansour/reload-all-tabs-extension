/**
 * Tab reload strategies module
 */

import { getSetting } from '../shared/storage.js';
import { hasPermission } from '../shared/permissions.js';
import { matchesAnyPattern } from '../shared/matching.js';

/**
 * Reload all tabs in a window based on options
 * @param {Object} win Window to reload
 * @param {Object} options Reload options
 */
export const reloadWindow = async (win, options = {}) => {
  const tabs = await chrome.tabs.query({ windowId: win.id });
  const strategy = {};
  const { reloadDelay } = await getSetting(['reloadDelay']);

  for (const tab of tabs) {
    await reloadStrategy(tab, strategy, options);
    if (reloadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, reloadDelay));
    }
  }
};

/**
 * Determine if a tab should be reloaded based on options
 * @param {Object} tab Tab to check
 * @param {Object} strategy Strategy state
 * @param {Object} options Reload options
 */
const reloadStrategy = async (tab, strategy, options = {}) => {
  let issueReload = true;

  if (tab.active) {
    const { excludeActiveTab } = await getSetting(['excludeActiveTab']);
    if (excludeActiveTab) {
      issueReload = false;
    }
  }

  if (tab.audible) {
    const { excludeAudioTabs } = await getSetting(['excludeAudioTabs']);
    if (excludeAudioTabs) {
      issueReload = false;
    }
  }

  if (options.reloadPinnedOnly && !tab.pinned) {
    issueReload = false;
  }

  if (options.reloadUnpinnedOnly && tab.pinned) {
    issueReload = false;
  }

  if (options.reloadAllLeft) {
    if (tab.active) {
      strategy.stop = true;
    }
    if (strategy.stop) {
      issueReload = false;
    }
  }

  if (options.reloadAllRight) {
    if (!strategy.reset) {
      if (!tab.active) {
        strategy.stop = true;
      } else {
        strategy.reset = true;
      }
    }
    if (strategy.stop) {
      issueReload = false;
      if (strategy.reset) {
        strategy.stop = false;
      }
    }
  }

  if (options.reloadAllMatched || options.reloadSkipMatched) {
    const hasTabsPermission = await hasPermission('tabs');
    if (hasTabsPermission) {
      const settingKey = options.reloadAllMatched ? 'reloadAllMatched' : 'reloadSkipMatched';
      const { [settingKey]: patternList } = await getSetting([settingKey]);
      const isUrlMatched = matchesAnyPattern(tab.url, patternList);

      // reloadAllMatched: only reload if matched; reloadSkipMatched: skip if matched.
      if (options.reloadAllMatched ? !isUrlMatched : isUrlMatched) {
        issueReload = false;
      }
    }
  }

  if (issueReload) {
    const { bypassCache } = await getSetting(['bypassCache']);
    console.log(`Reloading ${tab.url || tab.id}, cache bypassed: ${bypassCache}`);
    await chrome.tabs.reload(tab.id, { bypassCache });
  }
};

/**
 * Reload grouped tabs
 * @param {number} windowId Window ID
 * @param {number} groupId Tab group ID to reload
 */
export const reloadGroupedTabs = async (windowId, groupId) => {
  const hasTabGroupsPermission = await hasPermission('tabGroups');
  if (!hasTabGroupsPermission) {
    return;
  }

  const tabs = await chrome.tabs.query({ windowId, groupId });
  const { reloadDelay } = await getSetting(['reloadDelay']);
  const strategy = {};

  for (const tab of tabs) {
    await reloadStrategy(tab, strategy, {});
    if (reloadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, reloadDelay));
    }
  }
};

/**
 * Reload all tabs in all windows
 */
export const reloadAllWindows = async () => {
  const windows = await chrome.windows.getAll({});

  for (const win of windows) {
    await reloadWindow(win);
  }
};

/**
 * Main reload routine based on user settings
 */
export const reload = async () => {
  const { buttonDefaultAction } = await getSetting(['buttonDefaultAction']);

  const actions = {
    allWindows: () => reloadAllWindows(),
    pinned: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true })),
    unpinned: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true })),
    default: () => chrome.windows.getCurrent((win) => reloadWindow(win))
  };

  (actions[buttonDefaultAction] || actions.default)();
};
