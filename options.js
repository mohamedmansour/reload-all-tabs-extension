/**
 * Short form for getting elements by id.
 * @param {string} id The id.
 * @returns {HTMLElement} The element
 */
const $ = (id) => document.getElementById(id);

/**
 * Debounce utility function
 * @param {Function} func The function to debounce
 * @param {number} delay The delay in milliseconds
 * @returns {Function} The debounced function
 */
const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

/**
 * Flash a save message near an element using CSS Anchor Positioning
 * @param {HTMLElement} element The element to flash near
 * @returns {Function} Function to stop the flash
 */
const flashMessage = (() => {
  let currentAnchor = null;
  let hideTimeout = null;
  let cleanupTimeout = null;

  return (element) => {
    const info = $('info-message');
    
    // Clear any existing timeouts
    if (hideTimeout) clearTimeout(hideTimeout);
    if (cleanupTimeout) clearTimeout(cleanupTimeout);
    
    // Clean up previous anchor immediately if switching elements
    if (currentAnchor && currentAnchor !== element) {
      currentAnchor.style.removeProperty('anchor-name');
    }
    
    // Set the new anchor
    element.style.setProperty('anchor-name', '--save-anchor');
    currentAnchor = element;
    
    // Show the message
    info.dataset.visible = 'true';
    
    return () => {
      // Hide after 1 second
      hideTimeout = setTimeout(() => {
        info.dataset.visible = 'false';
        
        // Clean up anchor after fade-out animation completes (300ms)
        cleanupTimeout = setTimeout(() => {
          if (currentAnchor === element) {
            element.style.removeProperty('anchor-name');
            currentAnchor = null;
          }
        }, 300);
      }, 1000);
    };
  };
})();

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

const resetJobForm = () => {
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

const renderScheduledJobs = (jobs = []) => {
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

  const job = {
    id: crypto.randomUUID(),
    domain: domainValue,
    intervalMinutes,
    bypassCache: !!bypassCache?.checked,
    excludeActiveTab: !!excludeActive?.checked,
    excludeAudioTabs: !!excludeAudio?.checked,
    enabled: true
  };

  return job;
};

const saveScheduledJobs = async (jobs) => {
  scheduledJobsState = jobs;
  await chrome.storage.sync.set({ scheduledJobs: jobs });
};

const attachJobHandlers = () => {
  const { form } = getJobFormElements();

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const newJob = getNewJobPayload();

      if (!newJob) {
        alert('Please provide a valid domain and interval greater than 0.');
        return;
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

/**
 * Setup a checkbox with storage sync
 * @param {string} id Element ID
 * @param {boolean} storedValue Current stored value
 * @param {boolean} defaultValue Default value if not stored
 */
const setupCheckbox = async (id, storedValue, defaultValue = false) => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.checked = value;
  
  // Save default value to storage if not set
  if (storedValue === undefined && defaultValue !== false) {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }
  
  element.addEventListener('change', async (e) => {
    const stopFlashing = flashMessage(e.target);
    await chrome.storage.sync.set({ [id]: e.target.checked });
    stopFlashing();
  });
};

/**
 * Setup a dropdown with storage sync
 * @param {string} id Element ID
 * @param {string} storedValue Current stored value
 * @param {string} defaultValue Default value if not stored
 */
const setupDropdown = async (id, storedValue, defaultValue = '') => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.value = value;
  
  // Save default value to storage if not set
  if (storedValue === undefined && defaultValue !== '') {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }
  
  element.addEventListener('change', async (e) => {
    const stopFlashing = flashMessage(e.target);
    await chrome.storage.sync.set({ [id]: e.target.value });
    stopFlashing();
  });
};

/**
 * Setup a textarea with storage sync and debouncing
 * @param {string} id Element ID
 * @param {string} storedValue Current stored value
 * @param {string} defaultValue Default value if not stored
 */
const setupTextarea = async (id, storedValue, defaultValue = '') => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.value = value;
  
  // Save default value to storage if not set
  if (storedValue === undefined && defaultValue !== '') {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }
  
  const debouncedSave = debounce(async (value) => {
    const stopFlashing = flashMessage(element);
    await chrome.storage.sync.set({ [id]: value });
    stopFlashing();
  }, 300);
  
  element.addEventListener('input', (e) => {
    debouncedSave(e.target.value);
  });
};

/**
 * Opens the extensions page
 */
const onExtension = () => {
  chrome.tabs.create({ url: 'chrome://extensions/' });
  return false;
};

/**
 * Handles keyboard shortcut link click
 * @param {Event} e Click event
 */
const onKeyboardShortcut = async (e) => {
  const text = e.target.innerText;
  
  try {
    await navigator.clipboard.writeText(text);
    alert(`Copied the following link '${text}' to clipboard. You can change its defaults there. Due to Chrome security, you need to visit it manually.`);
  } catch (err) {
    console.error('Failed to copy text: ', err);
    alert(`Failed to copy to clipboard. Please manually navigate to: ${text}`);
  }
};

/**
 * Restore all options from storage
 */
const onRestore = async () => {
  const settingsToFetch = [
    'reloadWindow',
    'reloadAllWindows',
    'reloadPinnedOnly',
    'reloadUnpinnedOnly',
    'reloadAllLeft',
    'reloadAllRight',
    'reloadAllMatched',
    'reloadGroupedOnly',
    'bypassCache',
    'excludeActiveTab',
    'excludeAudioTabs',
    'scheduledJobs',
    'reloadDelay',
    'buttonDefaultAction',
    'version'
  ];

  const settings = await chrome.storage.sync.get(settingsToFetch);
  
  $('version').innerText = ` (v${settings.version ?? 'Unknown'})`;

  await setupCheckbox('reloadWindow', settings.reloadWindow, true);
  await setupCheckbox('reloadAllWindows', settings.reloadAllWindows);
  await setupCheckbox('reloadPinnedOnly', settings.reloadPinnedOnly);
  await setupCheckbox('reloadUnpinnedOnly', settings.reloadUnpinnedOnly);
  await setupCheckbox('reloadGroupedOnly', settings.reloadGroupedOnly);
  await setupCheckbox('reloadAllLeft', settings.reloadAllLeft);
  await setupCheckbox('reloadAllRight', settings.reloadAllRight);
  await setupCheckbox('bypassCache', settings.bypassCache);
  await setupCheckbox('excludeActiveTab', settings.excludeActiveTab);
  await setupCheckbox('excludeAudioTabs', settings.excludeAudioTabs);

  await setupDropdown('buttonDefaultAction', settings.buttonDefaultAction, 'window');
  await setupDropdown('reloadDelay', settings.reloadDelay, '0');
  await setupTextarea('reloadAllMatched', settings.reloadAllMatched);

  renderScheduledJobs(settings.scheduledJobs);

  const commands = await chrome.commands.getAll();
  $('keyboardShortcut').innerText = commands[0]?.shortcut || 'Not Set';
};

/**
 * Close the options window
 */
const onClose = () => {
  window.close();
};

/**
 * Initialize the options page
 */
const onLoad = () => {
  onRestore();

  document.body.dataset.ready = 'true';

  $('button-close').addEventListener('click', onClose);
  $('button-extension').addEventListener('click', onExtension);
  $('keyboardShortcutUpdate').addEventListener('click', onKeyboardShortcut);

  attachJobHandlers();
  resetJobForm();
};

// Initialize when DOM is ready
window.addEventListener('load', onLoad);
