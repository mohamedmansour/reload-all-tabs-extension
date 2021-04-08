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
  chrome.windows.onCreated.addListener(this.onStartup.bind(this))

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
    reloadAllLeft: false,
    closeAllRight: false,
    closeAllLeft: false,
    reloadStartup: 'none',
    bypassCache: false,
	buttonDefaultAction: "window"
  }

  const settingsToFetch = [
    'buttonDefaultAction',
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
    'closeAllRight',
    'closeAllLeft',
    'reloadStartup',
    'bypassCache',
    'version'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    this.cachedSettings.version = settings.version
    this.cachedSettings.buttonDefaultAction = (typeof settings.buttonDefaultAction == 'undefined') ? "window" : settings.buttonDefaultAction
    this.cachedSettings.enableKeyboardShortcut = settings.enableKeyboardShortcut == true
    this.cachedSettings.shortcutKeyAlt = settings.shortcutKeyAlt == true
    this.cachedSettings.reloadWindow = (typeof settings.reloadWindow == 'undefined') ? true : (settings.reloadWindow == true)
    this.cachedSettings.reloadAllWindows = settings.reloadAllWindows == true
    this.cachedSettings.reloadPinnedOnly = settings.reloadPinnedOnly == true
    this.cachedSettings.reloadUnpinnedOnly = settings.reloadUnpinnedOnly == true
    this.cachedSettings.reloadAllRight = settings.reloadAllRight == true
    this.cachedSettings.reloadAllLeft = settings.reloadAllLeft == true
	this.cachedSettings.closeAllRight = settings.closeAllRight == true
    this.cachedSettings.closeAllLeft = settings.closeAllLeft == true
    this.cachedSettings.reloadStartup = (typeof settings.reloadStartup == 'undefined') ? "none" : settings.reloadStartup
    this.cachedSettings.bypassCache = settings.bypassCache == true
    this.cachedSettings.shortcutKeyCode = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode
    this.cachedSettings.shortcutKeyShift = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true)

    // Update initial context menu.
    this.updateContextMenu()
  })
}

ReloadController.prototype.onStorageChanged = function(changes, namespace) {
  for (key in changes) {
    this.cachedSettings[key] = changes[key].newValue

    if (key.startsWith('reload') || key == 'bypassCache') {
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
  const validKeys = (this.cachedSettings.enableKeyboardShortcut &&
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
    case 'closeAllLeft':
      chrome.windows.getCurrent((win) => this.closeWindow(win, {closeAllLeft: true}))
      break
    case 'closeAllRight':
      chrome.windows.getCurrent((win) => this.closeWindow(win, {closeAllRight: true}))
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
  if (this.cachedSettings.buttonDefaultAction == "allWindows") { // All Windows.
    this.reloadAllWindows()
  } else if (this.cachedSettings.buttonDefaultAction == "pinned") { // Pinned.
	chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadPinnedOnly: true}))
  } else if (this.cachedSettings.buttonDefaultAction == "unpinned") { // Unpinned.
	chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadUnpinnedOnly: true}))
  } else { // Current Window.
    chrome.windows.getCurrent(this.reloadWindow.bind(this))
  }
}

/**
 * Initializes the reload extension.
 */
ReloadController.prototype.init = function()
{
  const currVersion = chrome.app.getDetails().version
  const prevVersion = this.cachedSettings.version
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
 * Do onStartup actions
 */
ReloadController.prototype.onStartup = function(win)
{
  const con = chrome.extension.getBackgroundPage().console;
  con.log(`onStartup: ${this.cachedSettings.reloadStartup}`)
  switch (this.cachedSettings.reloadStartup) {
    case 'all':
      this.reloadWindow(win)
      break
    case 'pinned':
      this.reloadWindow(win, {reloadPinnedOnly: true})
      break
    case 'unpinned':
        this.reloadWindow(win, {reloadUnpinnedOnly: true})
      break
    default:
      break
  }
}

/**
 * Handles the request coming back from an external extension.
 */
ReloadController.prototype.updateContextMenu = function()
{
  chrome.contextMenus.removeAll()

  chrome.contextMenus.onClicked.addListener(this.onMenuClicked.bind(this))

  let attributions = '';
  if (this.cachedSettings.bypassCache) {
    attributions = ' (cache bypassed)'
  }

  if (this.cachedSettings.reloadWindow) {
    chrome.contextMenus.create({
      id: 'reloadWindow',
      type: 'normal',
      title: `Reload this window${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllWindows) {
    chrome.contextMenus.create({
      id: 'reloadAllWindows',
      type: 'normal',
      title: `Reload all windows${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadPinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadPinnedOnly',
      type: 'normal',
      title: `Reload pinned tabs${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadUnpinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadUnpinnedOnly',
      type: 'normal',
      title: `Reload unpinned tabs${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllLeft) {
    chrome.contextMenus.create({
      id: 'reloadAllLeft',
      type: 'normal',
      title: `Reload all tabs to the left${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.reloadAllRight) {
    chrome.contextMenus.create({
      id: 'reloadAllRight',
      type: 'normal',
      title: `Reload all tabs to the right${attributions}`,
      contexts: ['all']
    })
  }
  
  if (this.cachedSettings.closeAllLeft) {
    chrome.contextMenus.create({
      id: 'closeAllLeft',
      type: 'normal',
      title: `Close all tabs to the left${attributions}`,
      contexts: ['all']
    })
  }

  if (this.cachedSettings.closeAllRight) {
    chrome.contextMenus.create({
      id: 'closeAllRight',
      type: 'normal',
      title: `Close all tabs to the right${attributions}`,
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
 * Close tabs to left or right one by one.
 *
 * @param win Window to close.
 */
ReloadController.prototype.closeWindow = function(win, options = {})
{
  chrome.tabs.getAllInWindow(win.id, (tabs) => {

    var passedCurrent = false;

	for (var i in tabs) {
      var tab = tabs[i];
	  var closeThisTab = false;

	  if ( tab.active ) {
		passedCurrent = true;
		continue;
	  }

	  if (passedCurrent) { // right of current
		if (options.closeAllLeft) return;
		if (options.closeAllRight) closeThisTab = true;
	  } else { // left of current
		if (options.closeAllLeft) closeThisTab = true;
	  }
	  if (closeThisTab) chrome.tabs.remove(tab.id); 
    }
  })
}


/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
ReloadController.prototype.reloadWindow = function(win, options = {})
{
  chrome.tabs.getAllInWindow(win.id, (tabs) => {
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
    const con = chrome.extension.getBackgroundPage().console;
    con.log(`reloading ${tab.url}, cache bypassed: ${this.cachedSettings.bypassCache}`)
    chrome.tabs.reload(tab.id, { bypassCache: this.cachedSettings.bypassCache }, null)
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
};

const reloadController = new ReloadController()
reloadController.init()
