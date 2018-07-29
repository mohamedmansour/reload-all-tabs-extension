/**
 * Controls the browser tab reloads.
 *
 * @constructor
 */
ReloadController = function()
{
  chrome.extension.onMessage.addListener(this.onMessage.bind(this))
  chrome.browserAction.onClicked.addListener(this.reload.bind(this))
  chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))

  this.cachedSettings = {
    enableKeyboardShortcut: false,
    shortcutKeyShift: false,
    shortcutKeyAlt: false,
    shortcutKeyCode: null,
    version: null,
    reloadWindow: true,
    reloadAllWindows: false,
    reloadPinnedOnly: false,
    reloadUnpinnedOnly: false,
    reloadAllRight: false,
    reloadAllLeft: false
  }

  const settingsToFetch = [
    'enableKeyboardShortcut',
    'shortcutKeyShift',
    'shortcutKeyAlt',
    'shortcutKeyCode',
    'reloadWindow',
    'reloadAllWindows',
    'reloadPinnedOnly',
    'reloadUnpinnedOnly',
    'reloadAllRight',
    'reloadAllLeft',
    'version'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    this.cachedSettings.version = settings.version
    this.cachedSettings.enableKeyboardShortcut = settings.enableKeyboardShortcut == true
    this.cachedSettings.shortcutKeyAlt = settings.shortcutKeyAlt == true
    this.cachedSettings.reloadWindow = (typeof settings.reloadWindow == 'undefined') ? true : (settings.reloadWindow == true)
    this.cachedSettings.reloadAllWindows = settings.reloadAllWindows == true
    this.cachedSettings.reloadPinnedOnly = settings.reloadPinnedOnly == true
    this.cachedSettings.reloadUnpinnedOnly = settings.reloadUnpinnedOnly == true
    this.cachedSettings.reloadAllRight = settings.reloadAllRight == true
    this.cachedSettings.reloadAllLeft = settings.reloadAllLeft == true
    this.cachedSettings.shortcutKeyCode = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode
    this.cachedSettings.shortcutKeyShift = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true)
  
    // Update initial context menu.
    this.updateContextMenu()
  })
}

ReloadController.prototype.onStorageChanged = function(changes, namespace) {
  for (key in changes) {
    this.cachedSettings[key] = changes[key].newValue

    if (key.startsWith('reload')) {
      this.updateContextMenu()
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
  switch (info.menuItemId) {
    case 'reloadWindow':
      chrome.windows.getCurrent(this.reloadWindow.bind(this))
      break
    case 'reloadAllWindows':
      this.reloadAllWindows()
      break
    case 'reloadPinnedOnly':
      chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadPinnedOnly: true}))
      break
    case 'reloadUnpinnedOnly':
      chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadUnpinnedOnly: true}))
      break
    case 'reloadAllLeft':
      chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadAllLeft: true}))
      break
    case 'reloadAllRight':
      chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadAllRight: true}))
      break
    default:
      break
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
};

/**
 * Handles the request coming back from an external extension.
 */
ReloadController.prototype.updateContextMenu = function()
{
  chrome.contextMenus.removeAll()

  chrome.contextMenus.onClicked.addListener(this.onMenuClicked.bind(this))

  if (this.cachedSettings.reloadWindow) {
    chrome.contextMenus.create({
      id: 'reloadWindow',
      type: 'normal',
      title: 'Reload this window',
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllWindows) {
    chrome.contextMenus.create({
      id: 'reloadAllWindows',
      type: 'normal',
      title: 'Reload all windows',
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadPinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadPinnedOnly',
      type: 'normal',
      title: 'Reload pinned tabs',
      contexts: ['all']
    })
  }
  
  if (this.cachedSettings.reloadUnpinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadUnpinnedOnly',
      type: 'normal',
      title: 'Reload unpinned tabs',
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllLeft) {
    chrome.contextMenus.create({
      id: 'reloadAllLeft',
      type: 'normal',
      title: 'Reload all tabs to the left',
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllRight) {
    chrome.contextMenus.create({
      id: 'reloadAllRight',
      type: 'normal',
      title: 'Reload all tabs to the right',
      contexts: ['all']
    })
  }
}

/**
 * When the extension first installed.
 */
ReloadController.prototype.onInstall = function()
{
  chrome.runtime.openOptionsPage()
}

/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
ReloadController.prototype.reloadWindow = function(win, options = {})
{
  chrome.tabs.getAllInWindow(win.id, (tabs) => {
    let strategy = {}
    for (var i in tabs) {
      var tab = tabs[i]
      this.reloadStrategy(tab, strategy, options)
    }
  })
}

// When this gets complicated, create a strategy pattern.
ReloadController.prototype.reloadStrategy = function(tab, strategy, options = {}) {
  let issueReload = true

  if (options.reloadPinnedOnly && !tab.pinned){
    issueReload = false
  }

  if (options.reloadUnpinnedOnly && tab.pinned){
    issueReload = false
  }

  if (options.reloadAllLeft) {
    if (tab.active) {
      strategy.stop = true
    }

    if (strategy.stop) {
      issueReload = false
    }
  }
  
  if (options.reloadAllRight) {
    if (!strategy.reset) {
      if (!tab.active) {
        strategy.stop = true
      }
      else {
        strategy.reset = true
      }
    }
    
    if (strategy.stop) {
      issueReload = false
      if (strategy.reset) {
        strategy.stop = false
      }
    }
  }

  if (issueReload){
    console.log(`reloading ${tab.url}`)
    chrome.tabs.update(tab.id, {url: tab.url, selected: tab.selected}, null)
  }
}

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
