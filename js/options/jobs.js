/**
 * Scheduled jobs UI management
 */

import { $ } from './dom.js';
import { hasPermission, requestPermissions } from '../shared/permissions.js';

const DEFAULT_JOB_INTERVAL_MINUTES = 5;

let scheduledJobsState = [];

const getJobFormElements = () => ({
  form: $('job-form'),
  domain: $('job-domain'),
  interval: $('job-interval'),
  bypassCache: $('job-bypassCache'),
  excludeActive: $('job-excludeActive'),
  excludeAudio: $('job-excludeAudio'),
  submit: $('job-submit')
});

/**
 * Reset the job form to defaults
 */
export const resetJobForm = () => {
  const { domain, interval, bypassCache, excludeActive, excludeAudio } = getJobFormElements();
  if (!domain) {
    return;
  }

  domain.value = '';
  interval.value = DEFAULT_JOB_INTERVAL_MINUTES;
  if (bypassCache) bypassCache.checked = false;
  if (excludeActive) excludeActive.checked = false;
  if (excludeAudio) excludeAudio.checked = false;
};

/**
 * Render the scheduled jobs table
 * @param {Array} jobs Jobs array
 */
export const renderScheduledJobs = (jobs = []) => {
  scheduledJobsState = Array.isArray(jobs) ? jobs : [];

  const tableBody = $('jobs-table-body');
  const emptyState = $('jobs-empty');

  if (!tableBody) {
    return;
  }

  tableBody.textContent = '';

  if (scheduledJobsState.length === 0) {
    if (emptyState) {
      emptyState.hidden = false;
    }
    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  for (const job of scheduledJobsState) {
    const row = document.createElement('tr');
    row.dataset.jobId = job.id;

    const domainCell = document.createElement('td');
    domainCell.textContent = job.domain;
    row.appendChild(domainCell);

    const intervalCell = document.createElement('td');
    intervalCell.textContent = `${Number(job.intervalMinutes ?? job.interval ?? DEFAULT_JOB_INTERVAL_MINUTES)} min`;
    row.appendChild(intervalCell);

    const optionsCell = document.createElement('td');
    const enabledOptions = [];
    if (job.bypassCache) enabledOptions.push('Bypass cache');
    if (job.excludeActiveTab) enabledOptions.push('Skip active');
    if (job.excludeAudioTabs) enabledOptions.push('Skip audio');
    optionsCell.textContent = enabledOptions.join(', ') || '—';
    row.appendChild(optionsCell);

    const statusCell = document.createElement('td');
    const isEnabled = job.enabled !== false;
    const statusBadge = document.createElement('span');
    statusBadge.className = `job-status ${isEnabled ? 'job-status-active' : 'job-status-paused'}`;
    statusBadge.textContent = isEnabled ? 'Active' : 'Paused';
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'job-actions-cell';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = `job-toggle ${isEnabled ? 'job-pause' : 'job-play'}`;
    toggleButton.dataset.jobId = job.id;
    toggleButton.title = isEnabled ? 'Pause job' : 'Start job';
    toggleButton.textContent = isEnabled ? '⏸' : '▶';
    actionsCell.appendChild(toggleButton);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'job-remove';
    removeButton.dataset.jobId = job.id;
    removeButton.title = 'Remove job';
    removeButton.textContent = '🗑';
    actionsCell.appendChild(removeButton);
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  }
};

const getNewJobPayload = () => {
  const { domain, interval, bypassCache, excludeActive, excludeAudio } = getJobFormElements();
  if (!domain || !interval) {
    return null;
  }

  const domainValue = domain.value.trim();
  if (!domainValue) {
    return null;
  }

  const intervalMinutes = Number(interval.value || DEFAULT_JOB_INTERVAL_MINUTES);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    domain: domainValue,
    intervalMinutes,
    bypassCache: !!bypassCache?.checked,
    excludeActiveTab: !!excludeActive?.checked,
    excludeAudioTabs: !!excludeAudio?.checked,
    enabled: true
  };
};

const saveScheduledJobs = async (jobs) => {
  scheduledJobsState = jobs;
  await chrome.storage.sync.set({ scheduledJobs: jobs });
};

/**
 * Attach event handlers for job management
 */
export const attachJobHandlers = () => {
  const { form } = getJobFormElements();

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const newJob = getNewJobPayload();

      if (!newJob) {
        alert('Please provide a valid domain and interval greater than 0.');
        return;
      }

      const hasAlarmsPermission = await hasPermission('alarms');
      if (!hasAlarmsPermission) {
        const granted = await requestPermissions(['alarms', 'tabs']);
        if (!granted) {
          alert('The alarms permission is required to schedule automatic tab reloads.');
          return;
        }
      }

      const updatedJobs = [...scheduledJobsState, newJob];
      await saveScheduledJobs(updatedJobs);
      renderScheduledJobs(updatedJobs);
      resetJobForm();
    });
  }

  const tableBody = $('jobs-table-body');

  if (tableBody) {
    tableBody.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const jobId = target.dataset.jobId;
      if (!jobId) {
        return;
      }

      if (target.matches('button.job-toggle')) {
        const updatedJobs = scheduledJobsState.map((job) => {
          if (job.id === jobId) {
            return { ...job, enabled: job.enabled === false };
          }
          return job;
        });
        await saveScheduledJobs(updatedJobs);
        renderScheduledJobs(updatedJobs);
        return;
      }

      if (target.matches('button.job-remove')) {
        const updatedJobs = scheduledJobsState.filter((job) => job.id !== jobId);
        await saveScheduledJobs(updatedJobs);
        renderScheduledJobs(updatedJobs);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.scheduledJobs) {
      return;
    }

    const { newValue } = changes.scheduledJobs;
    renderScheduledJobs(Array.isArray(newValue) ? newValue : []);
  });
};
