/**
 * Controls the browser tab reloads.
 *
 * @constructor
 */
ReloadController = function()
{
  // Add a listener to the content script can request to.
  chrome.extension.onRequest.addListener(this.onMessage.bind(this))
  
  // Listens on browser action callbacks.
  chrome.browserAction.onClicked.addListener(this.reload.bind(this))

  this.shortcutKeyShift = null
  this.shortcutKeyAlt = null
  this.shortcutKeyCode = null
  this.version = null
  this.reloadAllWindows = false;
  this.contextMenu = true;
  this.pinnedOnly = false;

  const settingsToFetch = [
    'shortcutKeyShift',
    'shortcutKeyAlt',
    'shortcutKeyCode',
    'reloadAllWindows',
    'contextMenu',
    'version',
    'pinnedOnly'
  ]

  chrome.storage.sync.get(settingsToFetch, settings => {
    this.version = settings.version
    this.shortcutKeyAlt = settings.shortcutKeyAlt == true
    this.reloadAllWindows = settings.reloadAllWindows == true
    this.pinnedOnly = settings.pinnedOnly == true
    this.shortcutKeyCode = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode
    this.shortcutKeyShift = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true)
    this.contextMenu = (typeof settings.contextMenu == 'undefined') ? true : (settings.contextMenu == true)
  })
}

/**
 * Context Menu Message listener when a keyboard event happened.
 */
ReloadController.prototype.onMessage = function(request, sender, response)
{
  // Checks if the shortcut key is valid to reload all tabs.
  var validKeys = (request.code == this.shortcutKeyCode &&
      request.alt == this.shortcutKeyAlt &&
      request.shift == this.shortcutKeyShift)
  
  // Once valid, we can choose which reload method is needed.
  if (validKeys) {
    this.reload()
  }
}

/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */
ReloadController.prototype.reload = function(opt_tab)
{
  if (this.reloadAllWindows) { // All Windows.
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
  var prevVersion = this.version
  if (currVersion != prevVersion) {

    // Check if we just installed this extension.
    if (typeof prevVersion == 'undefined') {
      this.onInstall()
    } 

    // Update the version incase we want to do something in future.
    this.version = currVersion
    chrome.storage.sync.set({'version': this.version})
  }

  // Initialize the context menu.
  this.setContextMenuVisible(this.contextMenu)
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
    var contextMenuProperty = {
      type: 'normal',
      title: 'Reload all tabs',
      contexts: ['all'],
      onclick: this.reload.bind(this)
    }
    chrome.contextMenus.create(contextMenuProperty)
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
          chrome.tabs.executeScript(tab.id, { file: 'js/keyboard_handler.js', allFrames: true })
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
    var pinnedOnly = this.pinnedOnly;
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