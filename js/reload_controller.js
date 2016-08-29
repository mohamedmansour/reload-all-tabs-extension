/**
 * Controls the browser tab reloads.
 *
 * @constructor
 */
ReloadController = function()
{
  // Add a listener to the content script can request to.
  chrome.extension.onMessage.addListener(this.onMessage.bind(this))
  
  // Listens on browser action callbacks.
  chrome.browserAction.onClicked.addListener(this.reload.bind(this))

  chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))

  chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this))

  this.cachedSettings = {
    enableKeyboardShortcut: false,
    shortcutKeyShift: false,
    shortcutKeyAlt: false,
    shortcutKeyCode: null,
    version: null,
    reloadAllWindows: false,
    contextMenu: true,
    pinnedOnly: false
  }

  const settingsToFetch = [
    'enableKeyboardShortcut',
    'shortcutKeyShift',
    'shortcutKeyAlt',
    'shortcutKeyCode',
    'reloadAllWindows',
    'contextMenu',
    'version',
    'pinnedOnly'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    this.cachedSettings.version = settings.version
    this.cachedSettings.enableKeyboardShortcut = settings.enableKeyboardShortcut == true
    this.cachedSettings.shortcutKeyAlt = settings.shortcutKeyAlt == true
    this.cachedSettings.reloadAllWindows = settings.reloadAllWindows == true
    this.cachedSettings.pinnedOnly = settings.pinnedOnly == true
    this.cachedSettings.shortcutKeyCode = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode
    this.cachedSettings.shortcutKeyShift = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true)
    this.cachedSettings.contextMenu = (typeof settings.contextMenu == 'undefined') ? true : (settings.contextMenu == true)
  })
}

ReloadController.prototype.onTabUpdated = function(tabid, changeInfo, tab) {
  if (changeInfo.status != 'complete') {
    return
  }

  chrome.tabs.executeScript(tab.id, { file: 'js/keyboard_handler.js', allFrames: false })
}

ReloadController.prototype.onStorageChanged = function(changes, namespace) {
  for (key in changes) {
    this.cachedSettings[key] = changes[key].newValue

    if (key == 'contextMenu') {
      this.setContextMenuVisible(this.cachedSettings.contextMenu)
    }
  }
}

/**
 * Context Menu Message listener when a keyboard event happened.
 */
ReloadController.prototype.onMessage = function(request, sender, response)
{
  // Checks if the shortcut key is valid to reload all tabs.
  var validKeys = (this.cachedSettings.enableKeyboardShortcut &&
                   request.code == this.cachedSettings.shortcutKeyCode &&
                   request.alt == this.cachedSettings.shortcutKeyAlt &&
                   request.shift == this.cachedSettings.shortcutKeyShift)
  
  // Once valid, we can choose which reload method is needed.
  if (validKeys) {
    this.reload()
  }
}


ReloadController.prototype.onMenuClicked = function(info, tab)
{
  if (info.parentMenuItemId == 'thiswindow') {
    chrome.windows.getCurrent(this.reloadWindow.bind(this))
  }
  else if (info.parentMenuItemId == 'allwindows') {
    this.reloadAllWindows()
  }
}

/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */
ReloadController.prototype.reload = function(info, tab)
{
  if (this.cachedSettings.reloadAllWindows) { // All Windows.
    this.reloadAllWindows()
  }
  else { // Current Window.
    chrome.windows.getCurrent(this.reloadWindow.bind(this))
  }
}

/**
 * Initializes the reload extension.
 */
ReloadController.prototype.init = function()
{
  var currVersion = chrome.app.getDetails().version
  var prevVersion = this.cachedSettings.version
  if (currVersion != prevVersion) {

    // Check if we just installed this extension.
    if (typeof prevVersion == 'undefined') {
      this.onInstall()
    } 

    // Update the version incase we want to do something in future.
    this.cachedSettings.version = currVersion
    chrome.storage.sync.set({'version': this.cachedSettings.version})
  }

  // Initialize the context menu.
  this.setContextMenuVisible(this.cachedSettings.contextMenu)
};

/**
 * Handles the request coming back from an external extension.
 *
 * @param request The request that the extension is passing.
 * @param response The response that will be sent back.
 */
ReloadController.prototype.setContextMenuVisible = function(visible)
{
  chrome.contextMenus.removeAll()
  if (visible) {
    chrome.contextMenus.create({
      id: 'root',
      type: 'normal',
      title: 'Reload all tabs',
      contexts: ['all']
    })
    chrome.contextMenus.create({
      id: 'thiswindow',
      parentId: 'root',
      type: 'normal',
      title: 'Reload this window',
      contexts: ['all']
    })
    chrome.contextMenus.create({
      id: 'allwindows',
      parentId: 'root',
      type: 'normal',
      title: 'Reload all windows',
      contexts: ['all']
    })

    chrome.contextMenus.onClicked.addListener(this.onMenuClicked.bind(this))
  }
}

/**
 * When the extension first installed.
 */
ReloadController.prototype.onInstall = function()
{
  chrome.windows.getAll({ populate: true }, function(windows) {
    for (var w = 0; w < windows.length; w++) {
      var tabs = windows[w].tabs
      for (var t = 0; t < tabs.length; t++) {
        var tab = tabs[t]
        if (tab.url.indexOf('http') == 0) { // Only inject in web pages.
          chrome.tabs.executeScript(tab.id, { file: 'js/keyboard_handler.js', allFrames: false })
        }
      }
    }
  })
 
  // Show up the options window on first install.
  chrome.tabs.create({url: 'options.html'})
}

/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
ReloadController.prototype.reloadWindow = function(win)
{
  chrome.tabs.getAllInWindow(win.id, (tabs) => {
    var pinnedOnly = this.cachedSettings.pinnedOnly;
    for (var i in tabs) {
      var tab = tabs[i]
      if (!pinnedOnly || tab.pinned){
        chrome.tabs.update(tab.id, {url: tab.url, selected: tab.selected}, null)
      }
    }
  });
};

/**
 * Reload all tabs in all windows one by one.
 */
ReloadController.prototype.reloadAllWindows = function()
{
  chrome.windows.getAll({}, function(windows) {
    for (var i in windows)
      this.reloadWindow(windows[i])
  }.bind(this))
}


  var reloadController = new ReloadController()
  reloadController.init()