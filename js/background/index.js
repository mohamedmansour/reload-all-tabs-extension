/**
 * Background service worker entry point
 */

import { getSetting } from '../shared/storage.js';
import { hasPermission } from '../shared/permissions.js';
import { reload } from './reload.js';
import { updateContextMenu, onMenuClicked } from './context-menu.js';
import {
  scheduleAllJobs,
  initializeJobScheduler,
  isJobAlarm,
  getJobIdFromAlarm,
  executeScheduledJob
} from './scheduler.js';

// Track which permission listeners have been registered to avoid duplicates
const registeredPermissionListeners = {
  tabGroups: false,
  alarms: false
};

/**
 * Initialize tabGroups feature (listeners)
 */
const initializeTabGroups = () => {
  if (registeredPermissionListeners.tabGroups) {
    return;
  }
  registeredPermissionListeners.tabGroups = true;

  chrome.tabGroups.onCreated.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onRemoved.addListener(async () => await updateContextMenu());
  chrome.tabGroups.onUpdated.addListener(async () => await updateContextMenu());
};

/**
 * Initialize alarms feature (listeners)
 */
const initializeAlarms = () => {
  if (registeredPermissionListeners.alarms) {
    return;
  }
  registeredPermissionListeners.alarms = true;

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!isJobAlarm(alarm.name)) {
      return;
    }

    const jobId = getJobIdFromAlarm(alarm.name);
    await executeScheduledJob(jobId);
  });
};

/**
 * Handle newly granted permissions
 * @param {chrome.permissions.Permissions} permissions The granted permissions
 */
const onPermissionsAdded = async (permissions) => {
  if (permissions.permissions?.includes('tabGroups')) {
    initializeTabGroups();
    await updateContextMenu();
  }

  if (permissions.permissions?.includes('alarms')) {
    initializeAlarms();
    await scheduleAllJobs();
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
 * When the extension first installed
 */
const onInstall = () => {
  chrome.runtime.openOptionsPage();
};

/**
 * Initializes the reload extension
 */
const init = async () => {
  chrome.action.onClicked.addListener(async () => await reload());
  chrome.storage.onChanged.addListener(async (changes) => await onStorageChanged(changes));
  chrome.commands.onCommand.addListener(async () => await reload());
  chrome.contextMenus.onClicked.addListener((info, tab) => onMenuClicked(info, tab));
  chrome.permissions.onAdded.addListener(onPermissionsAdded);

  // Initialize tabGroups listeners if we already have permission
  const hasTabGroupsPermission = await hasPermission('tabGroups');
  if (hasTabGroupsPermission) {
    initializeTabGroups();
  }

  // Initialize alarms listeners if we already have permission
  const hasAlarmsPermission = await hasPermission('alarms');
  if (hasAlarmsPermission) {
    initializeAlarms();
  }

  await updateContextMenu();
  await initializeJobScheduler();

  // Version Check
  const currVersion = chrome.runtime.getManifest().version;
  const { version } = await getSetting(['version']);

  if (currVersion !== version) {
    if (!version) {
      onInstall();
    }

    await chrome.storage.sync.set({ version: currVersion });
  }
};

// Initialize the extension
try {
  init();
} catch (e) {
  console.error('Failed to initialize extension:', e);
}
