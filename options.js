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
  $('button-close').addEventListener('click', onClose);
  $('button-extension').addEventListener('click', onExtension);
  $('keyboardShortcutUpdate').addEventListener('click', onKeyboardShortcut);
};

// Initialize when DOM is ready
window.addEventListener('load', onLoad);
