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
        results[key] = values[key] === undefined ? true : values[key] === true;
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
      case 'scheduledJobs':
        results[key] = Array.isArray(values[key]) ? values[key] : [];
        break;
      default:
        results[key] = undefined;
        break;
    }
  }

  return results;
};

const JOB_ALARM_PREFIX = 'reload-job:';
const MIN_ALARM_INTERVAL_MINUTES = 0.1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mutex to prevent concurrent context menu updates.
let isUpdatingContextMenu = false;
let pendingContextMenuUpdate = false;

const isJobAlarm = (name) => typeof name === 'string' && name.startsWith(JOB_ALARM_PREFIX);

const getJobAlarmName = (jobId) => `${JOB_ALARM_PREFIX}${jobId}`;

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesJobPattern = (url, pattern) => {
  if (!pattern || !url) {
    return false;
  }

  const normalizedPattern = pattern.trim().toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.includes('*')) {
    const regex = new RegExp(`^${normalizedPattern.split('*').map(escapeForRegex).join('.*')}$`);
    return regex.test(normalizedUrl);
  }

  return normalizedUrl.includes(normalizedPattern);
};

const clearJobAlarms = async () => {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => isJobAlarm(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );
};

const scheduleAllJobs = async () => {
  await clearJobAlarms();

  const { scheduledJobs } = await getSetting(['scheduledJobs']);

  if (!Array.isArray(scheduledJobs)) {
    return;
  }

  for (const job of scheduledJobs) {
    if (!job?.id || !job?.domain) {
      continue;
    }

    if (job.enabled === false) {
      continue;
    }

    const interval = Number(job.intervalMinutes ?? job.interval ?? 0);

    if (!Number.isFinite(interval) || interval < MIN_ALARM_INTERVAL_MINUTES) {
      continue;
    }

    const periodInMinutes = Math.max(interval, MIN_ALARM_INTERVAL_MINUTES);
    const delayInMinutes = Number(job.startAfterMinutes ?? periodInMinutes);
    const alarmName = getJobAlarmName(job.id);

    chrome.alarms.create(alarmName, {
      periodInMinutes,
      delayInMinutes: Math.max(delayInMinutes, MIN_ALARM_INTERVAL_MINUTES)
    });
  }
};

const initializeJobScheduler = async () => {
  await scheduleAllJobs();
};

/**
 * Set enabled state for all scheduled jobs
 * @param {boolean} enabled Whether jobs should be enabled
 */
const setAllJobsEnabled = async (enabled) => {
  const { scheduledJobs } = await getSetting(['scheduledJobs']);

  if (!Array.isArray(scheduledJobs) || scheduledJobs.length === 0) {
    return;
  }

  const updatedJobs = scheduledJobs.map((job) => ({
    ...job,
    enabled
  }));

  await chrome.storage.sync.set({ scheduledJobs: updatedJobs });
};

/**
 * Toggle enabled state for a single scheduled job
 * @param {string} jobId The job ID to toggle
 */
const toggleJobEnabled = async (jobId) => {
  const { scheduledJobs } = await getSetting(['scheduledJobs']);

  if (!Array.isArray(scheduledJobs)) {
    return;
  }

  const updatedJobs = scheduledJobs.map((job) => {
    if (job.id === jobId) {
      return { ...job, enabled: job.enabled === false };
    }
    return job;
  });

  await chrome.storage.sync.set({ scheduledJobs: updatedJobs });
};

const executeScheduledJob = async (jobId) => {
  const { scheduledJobs } = await getSetting(['scheduledJobs']);

  const job = scheduledJobs?.find?.((item) => item?.id === jobId);

  if (!job) {
    await chrome.alarms.clear(getJobAlarmName(jobId));
    return;
  }

  const allTabs = await chrome.tabs.query({});
  const matchedTabs = allTabs.filter((tab) => matchesJobPattern(tab.url ?? '', job.domain));

  if (matchedTabs.length === 0) {
    return;
  }

  const baseSettings = await getSetting(['bypassCache', 'excludeActiveTab', 'excludeAudioTabs', 'reloadDelay']);

  const bypassCache = job.bypassCache ?? baseSettings.bypassCache ?? false;
  const excludeActiveTab = job.excludeActiveTab ?? baseSettings.excludeActiveTab ?? false;
  const excludeAudioTabs = job.excludeAudioTabs ?? baseSettings.excludeAudioTabs ?? false;
  const baseDelay = Number.parseInt(baseSettings.reloadDelay ?? '0', 10) || 0;
  const delay = Number(job.delay ?? baseDelay) || 0;

  for (const tab of matchedTabs) {
    if (excludeActiveTab && tab.active) {
      continue;
    }

    if (excludeAudioTabs && tab.audible) {
      continue;
    }

    try {
      await chrome.tabs.reload(tab.id, { bypassCache: !!bypassCache });
    } catch (error) {
      console.warn('Failed to reload tab for job', jobId, tab.id, error);
    }

    if (delay > 0) {
      await sleep(delay);
    }
  }
};

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!isJobAlarm(alarm.name)) {
    return;
  }

  const jobId = alarm.name.slice(JOB_ALARM_PREFIX.length);
  await executeScheduledJob(jobId);
});

/**
 * Initializes the reload extension.
 */
const init = async () => {
  chrome.action.onClicked.addListener(async () => await reload());
  chrome.storage.onChanged.addListener(async (changes) => await onStorageChanged(changes));
  chrome.commands.onCommand.addListener(async () => await reload());
  chrome.contextMenus.onClicked.addListener((info) => onMenuClicked(info));

  // Listen for tab group changes
  chrome.tabGroups.onCreated.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onRemoved.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onUpdated.addListener(async () => await updateContextMenu());

  await updateContextMenu();
  await initializeJobScheduler();

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
  let shouldUpdateContext = false;
  let shouldRescheduleJobs = false;

  for (const key in changes) {
    if (!Object.prototype.hasOwnProperty.call(changes, key)) {
      continue;
    }

    if (key.startsWith('reload') || key === 'bypassCache') {
      shouldUpdateContext = true;
    }

    if (key === 'scheduledJobs') {
      shouldUpdateContext = true;
      shouldRescheduleJobs = true;
    }
  }

  if (shouldUpdateContext) {
    await updateContextMenu();
  }

  if (shouldRescheduleJobs) {
    await scheduleAllJobs();
  }
};

/**
 * Handle context menu clicks
 * @param {Object} info Click info
 */
const onMenuClicked = async (info) => {
  const { parentMenuItemId, menuItemId } = info;

  // Handle individual job toggle
  if (menuItemId.startsWith('jobToggle:')) {
    const jobId = menuItemId.slice('jobToggle:'.length);
    await toggleJobEnabled(jobId);
    return;
  }

  const menuActions = {
    reloadWindow: () => chrome.windows.getCurrent((win) => reloadWindow(win)),
    reloadAllWindows: () => reloadAllWindows(),
    reloadPinnedOnly: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true })),
    reloadUnpinnedOnly: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true })),
    reloadAllLeft: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllLeft: true })),
    reloadAllRight: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllRight: true })),
    reloadAllMatched: () => chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllMatched: true })),
    reloadGroupedOnly: () => chrome.windows.getCurrent((win) => reloadGroupedTabs(win.id, +menuItemId)),
    jobsStartAll: async () => await setAllJobsEnabled(true),
    jobsStopAll: async () => await setAllJobsEnabled(false),
    jobsManage: () => chrome.runtime.openOptionsPage()
  };

  let itemId = menuItemId;

  // Special handling for grouped tabs since the submenu ID is the group ID.
  if (parentMenuItemId === 'reloadGroupedOnly') {
    itemId = parentMenuItemId;
  }

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
  // Prevent concurrent updates - queue if already updating.
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
      chrome.contextMenus.create({
        id: 'reloadGroupedOnly',
        type: 'normal',
        title: `Reload tab groups${attributions}`,
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

      // Add individual job toggles.
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

    // If another update was requested while we were updating, run it now
    if (pendingContextMenuUpdate) {
      pendingContextMenuUpdate = false;
      await updateContextMenu();
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
