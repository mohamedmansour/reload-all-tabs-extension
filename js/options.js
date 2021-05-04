window.addEventListener('load', onLoad, false)

/**
 * When the options window has been loaded.
 */
function onLoad() {
  onRestore();
  $('button-save').addEventListener('click', onSave, false)
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
 * Opens the extensions page. The reason why we didn't do a simple link,
 * is because you are not allowed to load that local resource via renderer.
 */
function onExtension() {
  chrome.tabs.create({url: 'chrome://extensions/'})
  return false
}

/**
 * Saves options to localStorage.
 */
function onSave() {
  const settingsToSave = {
    'reloadWindow': $('reloadWindow').checked,
    'reloadAllWindows': $('reloadAllWindows').checked,
    'reloadPinnedOnly': $('reloadPinnedOnly').checked,
    'reloadUnpinnedOnly': $('reloadUnpinnedOnly').checked,
    'reloadAllLeft': $('reloadAllLeft').checked,
    'reloadAllRight': $('reloadAllRight').checked,
    'closeAllLeft': $('closeAllLeft').checked,
    'closeAllRight': $('closeAllRight').checked,
    'reloadStartup': $('reloadStartup').value,
    'bypassCache': $('bypassCache').checked,
    'buttonDefaultAction': $('buttonDefaultAction').value,
    'enableTimedReloads': $('enableTimedReloads').checked
  };

  chrome.storage.sync.set(settingsToSave, () => {

    // Update status to let user know options were saved.
    const info = $('info-message')
    info.style.opacity = 1
    setTimeout(function() {
      info.style.opacity = 0.0;
    }, 1000)
  })
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
    'closeAllLeft',
    'closeAllRight',
    'reloadStartup',
    'bypassCache',
    'enableTimedReloads',
    'buttonDefaultAction',
    'version'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    $('version').innerText = ' (v' + settings.version + ')'
    $('reloadWindow').checked = (typeof settings.reloadWindow == 'undefined') ? true : (settings.reloadWindow == true)
    $('reloadAllWindows').checked = settings.reloadAllWindows == true
    $('reloadPinnedOnly').checked = settings.reloadPinnedOnly == true
    $('reloadUnpinnedOnly').checked = settings.reloadUnpinnedOnly == true
    $('reloadAllLeft').checked = settings.reloadAllLeft == true
    $('reloadAllRight').checked = settings.reloadAllRight == true
    $('closeAllLeft').checked = settings.closeAllLeft == true
    $('closeAllRight').checked = settings.closeAllRight == true
    $('reloadStartup').value = (typeof settings.reloadStartup == 'undefined') ? 'none' : settings.reloadStartup
    $('bypassCache').checked = settings.bypassCache == true
    $('buttonDefaultAction').value = (typeof settings.buttonDefaultAction == 'undefined') ? 'window' : settings.buttonDefaultAction
    $('enableTimedReloads').checked = settings.enableTimedReloads == true
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
