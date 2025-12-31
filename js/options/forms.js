/**
 * Form setup utilities for options page
 */

import { $, debounce, flashMessage } from './dom.js';
import { hasPermissions, requestPermissions, PERMISSION_REQUIREMENTS } from '../shared/permissions.js';

/**
 * Check and request required permissions for a setting
 * @param {string} id Setting ID
 * @param {*} newValue The new value being set
 * @returns {Promise<boolean>} Whether to proceed with saving (true) or abort (false)
 */
export const ensurePermissions = async (id, newValue) => {
  const requiredPermissions = PERMISSION_REQUIREMENTS[id];
  if (!requiredPermissions) {
    return true;
  }

  const needsPermission = typeof newValue === 'boolean' ? newValue : !!newValue;
  if (!needsPermission) {
    return true;
  }

  const hasIt = await hasPermissions(requiredPermissions);
  if (hasIt) {
    return true;
  }

  const granted = await requestPermissions(requiredPermissions);
  return granted;
};

/**
 * Setup a checkbox with storage sync
 * @param {string} id Element ID
 * @param {boolean} storedValue Current stored value
 * @param {boolean} defaultValue Default value if not stored
 */
export const setupCheckbox = async (id, storedValue, defaultValue = false) => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.checked = value;

  if (storedValue === undefined && defaultValue !== false) {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }

  element.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;

    const canProceed = await ensurePermissions(id, isChecked);
    if (!canProceed) {
      e.target.checked = false;
      return;
    }

    const stopFlashing = flashMessage(e.target);
    await chrome.storage.sync.set({ [id]: isChecked });
    stopFlashing();
  });
};

/**
 * Setup a dropdown with storage sync
 * @param {string} id Element ID
 * @param {string} storedValue Current stored value
 * @param {string} defaultValue Default value if not stored
 */
export const setupDropdown = async (id, storedValue, defaultValue = '') => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.value = value;

  if (storedValue === undefined && defaultValue !== '') {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }

  element.addEventListener('change', async (e) => {
    const newValue = e.target.value;

    const canProceed = await ensurePermissions(id, newValue);
    if (!canProceed) {
      e.target.value = value;
      return;
    }

    const stopFlashing = flashMessage(e.target);
    await chrome.storage.sync.set({ [id]: newValue });
    stopFlashing();
  });
};

/**
 * Setup a textarea with storage sync and debouncing
 * @param {string} id Element ID
 * @param {string} storedValue Current stored value
 * @param {string} defaultValue Default value if not stored
 */
export const setupTextarea = async (id, storedValue, defaultValue = '') => {
  const element = $(id);
  const value = storedValue ?? defaultValue;
  element.value = value;

  if (storedValue === undefined && defaultValue !== '') {
    await chrome.storage.sync.set({ [id]: defaultValue });
  }

  const debouncedSave = debounce(async (newValue) => {
    const canProceed = await ensurePermissions(id, newValue);
    if (!canProceed) {
      element.value = value;
      return;
    }

    const stopFlashing = flashMessage(element);
    await chrome.storage.sync.set({ [id]: newValue });
    stopFlashing();
  }, 300);

  element.addEventListener('input', (e) => {
    debouncedSave(e.target.value);
  });
};
