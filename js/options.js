// Extensions pages can all have access to the bacground page.
var bkg = chrome.extension.getBackgroundPage();

// When the DOM is loaded, make sure all the saved info is restored.
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
  // Save settings.
  bkg.settings.reloadAllWindows = $('reloadAllWindows').checked;
  bkg.settings.shortcutKeyShift = $('shortcutKeyShift').checked;
  bkg.settings.shortcutKeyAlt = $('shortcutKeyAlt').checked;
  bkg.settings.shortcutKeyCode = parseInt($('shortcutKeyCode').value);
  bkg.settings.contextMenu = $('contextMenu').checked;
  
  // Update the status of the context menu.
  bkg.reloadController.setContextMenuVisible(bkg.settings.contextMenu);
  
  // Update status to let user know options were saved.
  var info = $('info-message');
  info.style.display = 'inline';
  info.style.opacity = 1;
  setTimeout(function() {
    info.style.opacity = 0.0;
  }, 1000);
}

/**
* Restore all options.
*/
function onRestore() {
  // Restore settings.
  $('version').innerHTML = ' (v' + bkg.settings.version + ')';
  $('reloadAllWindows').checked = bkg.settings.reloadAllWindows;
  $('shortcutKeyShift').checked = bkg.settings.shortcutKeyShift;
  $('shortcutKeyAlt').checked = bkg.settings.shortcutKeyAlt;
  $('shortcutKeyCode').value = bkg.settings.shortcutKeyCode;
  $('contextMenu').checked = bkg.settings.contextMenu;
}
