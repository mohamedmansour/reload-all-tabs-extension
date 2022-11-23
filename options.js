window.addEventListener('load', onLoad, false)

/**
 * Short form for getting elements by id.
 * @param {string} id The id.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * When the options window has been loaded.
 */
function onLoad() {
  onRestore();
  $('button-close').addEventListener('click', onClose, false)
  $('button-extension').addEventListener('click', onExtension, false)
  $('keyboardShortcutUpdate').addEventListener('click', onKeyboardShortcut, false)
}

/**
 *  When the options window is closed;
 */
function onClose() {
  window.close()
}

/**
 * @param {*} ctx The context
 * @param {function} func The function to execute after the debounce time
 * @param {number} delay The amount of time to wait
 * @return {function} The debounced function
 */
 let timeout;
 const debounce = (context, func, delay) => {

  return (...arguments) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, arguments);
    }, delay);
  };
};

/**
 * Opens the extensions page. The reason why we didn't do a simple link,
 * is because you are not allowed to load that local resource via renderer.
 */
function onExtension() {
  chrome.tabs.create({ url: 'chrome://extensions/' })
  return false
}

function setupCheckbox(id, storedValue, defaultValue = false) {
  const element = $(id)
  element.checked = (typeof storedValue == 'undefined') ? defaultValue : (storedValue == true)
  element.addEventListener('change', (e) => {
    const stopFlashing = flashMessage(e.target)
    chrome.storage.sync.set({ [id]: e.target.checked }, () => stopFlashing())
  })
}

function setupDropdown(id, storedValue, defaultValue = false) {
  const element = $(id)
  element.value = (typeof storedValue == 'undefined') ? defaultValue : storedValue
  element.addEventListener('change', (e) => {
    const stopFlashing = flashMessage(e.target)
    chrome.storage.sync.set({ [id]: e.target.value }, () => stopFlashing())
  })
}

function setupTextarea(id, storedValue, defaultValue = "") {
  const element = $(id);
  element.value = !storedValue ? defaultValue : storedValue;
  element.addEventListener('input', (e) => {
    debounce(this, () => {
      const stopFlashing = flashMessage(e.target);
      chrome.storage.sync.set({ [id]: e.target.value }, () => stopFlashing());
    }, 300)();    
  });
}

function flashMessage(element) {
  const rect = element.getBoundingClientRect()
  const info = $('info-message')
  info.style.top = rect.top + (rect.height / 2) - (info.clientHeight / 2) + 'px'
  info.style.left = rect.x + rect.width + 'px'
  info.style.opacity = 1
  return () => setTimeout(() => info.style.opacity = 0.0, 1000)
}

/**
* Restore all options.
*/
function onRestore() {
  const settingsToFetch = [
    'reloadWindow',
    'reloadAllWindows',
    'reloadPinnedOnly',
    'reloadUnpinnedOnly',
    'reloadAllLeft',
    'reloadAllRight',
    'reloadAllMatched',
    'reloadGroupedOnly',
    'closeAllLeft',
    'closeAllRight',
    'bypassCache',
    'buttonDefaultAction',
    'version'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    $('version').innerText = ' (v' + settings.version + ')'

    setupCheckbox('reloadWindow', settings.reloadWindow, true /* default if not exists */)
    setupCheckbox('reloadAllWindows', settings.reloadAllWindows)
    setupCheckbox('reloadPinnedOnly', settings.reloadPinnedOnly)
    setupCheckbox('reloadUnpinnedOnly', settings.reloadUnpinnedOnly)
    setupCheckbox('reloadGroupedOnly', settings.reloadGroupedOnly)
    setupCheckbox('reloadAllLeft', settings.reloadAllLeft)
    setupCheckbox('reloadAllRight', settings.reloadAllRight)
    setupCheckbox('closeAllLeft', settings.closeAllLeft)
    setupCheckbox('closeAllRight', settings.closeAllRight)
    setupCheckbox('bypassCache', settings.bypassCache)

    setupDropdown('buttonDefaultAction', settings.buttonDefaultAction, 'window')
    setupTextarea('reloadAllMatched', settings.reloadAllMatched);
  })

  chrome.commands.getAll(callback => {
    $('keyboardShortcut').innerText = callback[0].shortcut || 'Not Set'
  })
}

function onKeyboardShortcut(e) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(e.target)
  selection.removeAllRanges()
  selection.addRange(range)

  document.execCommand('copy')
  selection.removeAllRanges()

  alert(`Copied the following link '${e.target.innerText}' to clipboard. You can change its defaults there. Due to Chrome security, you need to visit it manually.`)
}
