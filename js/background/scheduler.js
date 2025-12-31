/**
 * Job scheduler module for managing scheduled tab reloads
 */

import { getSetting } from '../shared/storage.js';
import { hasPermission } from '../shared/permissions.js';

const JOB_ALARM_PREFIX = 'reload-job:';
const MIN_ALARM_INTERVAL_MINUTES = 0.1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const hasAlarmsPermission = await hasPermission('alarms');
  if (!hasAlarmsPermission) {
    return;
  }

  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((alarm) => isJobAlarm(alarm.name))
      .map((alarm) => chrome.alarms.clear(alarm.name))
  );
};

/**
 * Schedule all enabled jobs
 */
export const scheduleAllJobs = async () => {
  const hasAlarmsPermission = await hasPermission('alarms');
  if (!hasAlarmsPermission) {
    return;
  }

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

/**
 * Initialize job scheduler
 */
export const initializeJobScheduler = async () => {
  await scheduleAllJobs();
};

/**
 * Set enabled state for all scheduled jobs
 * @param {boolean} enabled Whether jobs should be enabled
 */
export const setAllJobsEnabled = async (enabled) => {
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
export const toggleJobEnabled = async (jobId) => {
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

/**
 * Execute a scheduled job
 * @param {string} jobId The job ID to execute
 */
export const executeScheduledJob = async (jobId) => {
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

/**
 * Check if an alarm name is a job alarm
 * @param {string} name Alarm name
 * @returns {boolean}
 */
export { isJobAlarm };

/**
 * Extract job ID from alarm name
 * @param {string} alarmName Alarm name
 * @returns {string} Job ID
 */
export const getJobIdFromAlarm = (alarmName) => alarmName.slice(JOB_ALARM_PREFIX.length);
