/**
 * Options page entry point
 */

import { $ } from './dom.js';
import { setupCheckbox, setupDropdown, setupTextarea } from './forms.js';
import { renderScheduledJobs, attachJobHandlers, resetJobForm } from './jobs.js';

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
