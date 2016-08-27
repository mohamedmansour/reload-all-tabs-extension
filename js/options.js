window.addEventListener('load', onLoad, false);

/**
 * When the options window has been loaded.
 */
function onLoad() {
  onRestore();
  $('button-save').addEventListener('click', onSave, false);
  $('button-close').addEventListener('click', onClose, false);
  $('button-extension').addEventListener('click', onExtension, false);
}

/**
 *  When the options window is closed;
 */
function onClose() {
  window.close();
}

/**
 * Opens the extensions page. The reason why we didn't do a simple link,
 * is because you are not allowed to load that local resource via renderer.
 */
function onExtension() {
  chrome.tabs.create({url: 'chrome://extensions/'});
  return false;
}

/**
 * Saves options to localStorage.
 */
function onSave() {
  const settingsToSave = {
    'reloadAllWindows': $('reloadAllWindows').checked,
    'shortcutKeyShift': $('shortcutKeyShift').checked,
    'shortcutKeyAlt': $('shortcutKeyAlt').checked,
    'shortcutKeyCode': parseInt($('shortcutKeyCode').value),
    'contextMenu': $('contextMenu').checked,
    'pinnedOnly': $('pinnedOnly').checked
  };

  chrome.storage.sync.set(settingsToSave, () => {
    // Update the status of the context menu.
    bkg.reloadController.setContextMenuVisible(bkg.settings.contextMenu);
    
    // Update status to let user know options were saved.
    var info = $('info-message');
    info.style.display = 'inline';
    info.style.opacity = 1;
    setTimeout(function() {
      info.style.opacity = 0.0;
    });
  });
}

/**
* Restore all options.
*/
function onRestore() {
  const settingsToFetch = [
    'reloadAllWindows',
    'shortcutKeyShift',
    'shortcutKeyAlt',
    'shortcutKeyCode',
    'contextMenu',
    'pinnedOnly',
    'version'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    $('version').innerText = ' (v' + settings.version + ')'
    $('reloadAllWindows').checked = settings.reloadAllWindows == true;
    $('pinnedOnly').checked = settings.pinnedOnly == true
    $('shortcutKeyAlt').checked = settings.shortcutKeyAlt == true
    $('shortcutKeyCode').value = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode
    $('shortcutKeyShift').checked = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true)
    $('contextMenu').checked = (typeof settings.contextMenu == 'undefined') ? true : (settings.contextMenu == true)
  });
}
