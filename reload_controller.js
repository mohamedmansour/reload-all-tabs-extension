/**
 * Get settings from storage with proper defaults
 * @param {string[]} keys Settings keys to fetch
 * @returns {Promise<Object>} Settings object
 */
const getSetting = async (keys) => {
  const values = await chrome.storage.sync.get(keys);
  const results = {};
  
  for (const key of keys) {
    switch (key) {
      case 'version':
        results[key] = values[key];
        break;
      case 'buttonDefaultAction':
        results[key] = values[key] ?? 'window';
        break;
      case 'reloadWindow':
        results[key] = values[key] === 'undefined' ? true : values[key] === true;
        break;
      case 'reloadAllMatched':
        results[key] = values[key];
        break;
      case 'reloadDelay':
        results[key] = parseInt(values[key] ?? '0', 10);
        break;
      case 'reloadAllWindows':
      case 'reloadPinnedOnly':
      case 'reloadUnpinnedOnly':
      case 'reloadGroupedOnly':
      case 'reloadAllRight':
      case 'reloadAllLeft':
      case 'bypassCache':
      case 'excludeActiveTab':
      case 'excludeAudioTabs':
        results[key] = values[key] === true;
        break;
      default:
        results[key] = undefined;
        break;
    }
  }
  
  return results;
};

/**
 * Initializes the reload extension.
 */
const init = async () => {
  chrome.action.onClicked.addListener(async () => await reload());
  chrome.storage.onChanged.addListener(async (changes) => await onStorageChanged(changes));
  chrome.commands.onCommand.addListener(async () => await reload());
  
  // Listen for tab group changes
  chrome.tabGroups.onCreated.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onRemoved.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onUpdated.addListener(async () => await updateContextMenu());

  await updateContextMenu();

  // Version Check.
  const currVersion = chrome.runtime.getManifest().version;
  const { version } = await getSetting(['version']);

  if (currVersion !== version) {
    // Check if we just installed this extension.
    if (!version) {
      onInstall();
    }

    // Update the version incase we want to do something in future.
    await chrome.storage.sync.set({ version: currVersion });
  }
};

/**
 * Handle storage changes
 * @param {Object} changes Storage changes object
 */
const onStorageChanged = async (changes) => {
  for (const key in changes) {
    if (key.startsWith('reload') || key === 'bypassCache') {
      await updateContextMenu();
      break;
    }
  }
};

/**
 * Handle context menu clicks
 * @param {Object} info Click info
 */
const onMenuClicked = (info) => {
  const { parentMenuItemId, menuItemId } = info;
  const itemId = parentMenuItemId || menuItemId;
  
  const menuActions = {
    reloadWindow: () => chrome.windows.getCurrent((win) => reloadWindow(win)),
    reloadAllWindows: () => reloadAllWindows(),
    reloadPinnedOnly: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true })),
    reloadUnpinnedOnly: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true })),
    reloadAllLeft: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllLeft: true })),
    reloadAllRight: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllRight: true })),
    reloadAllMatched: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllMatched: true })),
    reloadGroupedOnly: () => chrome.windows.getCurrent((win) => reloadGroupedTabs(win.id, +menuItemId))
  };
  
  menuActions[itemId]?.();
};

/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */
const reload = async () => {
  const { buttonDefaultAction } = await getSetting(['buttonDefaultAction']);
  
  const actions = {
    allWindows: () => reloadAllWindows(),
    pinned: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true })),
    unpinned: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true })),
    default: () => chrome.windows.getCurrent((win) => reloadWindow(win))
  };
  
  (actions[buttonDefaultAction] || actions.default)();
};

/**
 * Update context menu based on user settings
 */
const updateContextMenu = async () => {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.onClicked.addListener((info) => onMenuClicked(info));

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
    chrome.contextMenus.create({
      id: 'reloadGroupedOnly',
      type: 'normal',
      title: `Reload all tab groups${attributions}`,
      contexts: ['all']
    });
    
    const { id: windowId } = await chrome.windows.getCurrent();
    const tabGroups = await chrome.tabGroups.query({ windowId });
    
    // Color emoji mapping for tab groups
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
};

/**
 * When the extension first installed.
 */
const onInstall = () => {
  chrome.runtime.openOptionsPage();
};

/**
 * Reload all |tabs| one by one.
 * @param {Object} win Window to reload.
 * @param {Object} options Reload options
 */
const reloadWindow = async (win, options = {}) => {
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

  // Check if tabs with audio should be excluded
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

  if (options.reloadAllMatched) {
    const { reloadAllMatched: urlString } = await getSetting(['reloadAllMatched']);
    const isUrlMatched = urlString
      .split(',')
      .map(url => url.trim())
      .some(url => tab.url.startsWith(url));
    
    if (!isUrlMatched) {
      issueReload = false;
    }
  }

  if (issueReload) {
    const { bypassCache } = await getSetting(['bypassCache']);
    console.log(`Reloading ${tab.url}, cache bypassed: ${bypassCache}`);
    await chrome.tabs.reload(tab.id, { bypassCache });
  }
};

/**
 * Reload grouped tabs.
 * @param {number} windowId Window ID
 * @param {number} groupId Tab group ID to reload
 */
const reloadGroupedTabs = async (windowId, groupId) => {
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
 * Reload all tabs in all windows one by one.
 */
const reloadAllWindows = async () => {
  const windows = await chrome.windows.getAll({});
  
  for (const win of windows) {
    await reloadWindow(win);
  }
};

// Initialize the extension
try {
  init();
} catch (e) {
  console.error('Failed to initialize extension:', e);
}
