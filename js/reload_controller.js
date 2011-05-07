/**
 * Controls the browser tab reloads.
 *
 * @constructor
 */
ReloadController = function()
{
  // Add a listener to the content script can request to.
  chrome.extension.onRequest.addListener(this.onMessage.bind(this));
  
  // Listens on browser action callbacks.
  chrome.browserAction.onClicked.addListener(this.reload.bind(this));
};

/**
 * Context Menu Message listener when a keyboard event happened.
 */
ReloadController.prototype.onMessage = function(request, sender, response)
{
  // Checks if the shortcut key is valid to reload all tabs.
  var validKeys = (request.code == settings.shortcutKeyCode &&
      request.alt == settings.shortcutKeyAlt &&
      request.shift == settings.shortcutKeyShift);
  
  // Once valid, we can choose which reload method is needed.
  if (validKeys) {
    this.reload();
  }
};

/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */
ReloadController.prototype.reload = function(opt_tab)
{
  if (settings.reloadAllWindows) { // All Windows.
    this.reloadAllWindows();
  }
  else { // Current Window.
    chrome.windows.getCurrent(this.reloadWindow.bind(this));
  }
};

/**
 * Initializes the reload extension.
 */
ReloadController.prototype.init = function()
{
  // Read the local manifest.
  var version = 'NaN';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', chrome.extension.getURL('manifest.json'), false);
  xhr.send(null);
  var manifest = JSON.parse(xhr.responseText);
 
  // Check if the version has changed. In case we want to do something in the future.
  var currVersion = manifest.version;
  var prevVersion = settings.version
  if (currVersion != prevVersion) {
    // Check if we just installed this extension.
    if (typeof prevVersion == 'undefined') {
      this.onInstall();
    }
    // Update the version incase we want to do something in future.
    settings.version = currVersion;
  }

  // Initialize the context menu.
  this.setContextMenuVisible(settings.contextMenu);
};

/**
 * Handles the request coming back from an external extension.
 *
 * @param request The request that the extension is passing.
 * @param response The response that will be sent back.
 */
ReloadController.prototype.setContextMenuVisible = function(visible)
{
  chrome.contextMenus.removeAll();
  if (visible) {
    var contextMenuProperty = {
      type: 'normal',
      title: 'Reload all tabs',
      contexts: ['all'],
      onclick: this.reload.bind(this)
    };
    chrome.contextMenus.create(contextMenuProperty);
  }
};

/**
 * When the extension first installed.
 */
ReloadController.prototype.onInstall = function()
{
  chrome.windows.getAll({}, function(windows) {
    for (var w in windows) {
      chrome.tabs.getAllInWindow(windows[w].id, function(tabs) {
        for (var t in tabs) {
          chrome.tabs.executeScript(tabs[t].id, 
              {file: 'js/keyboard_handler', allFrames: true});
        }
      });
    }
  });
    
  // Show up the options window on first install.
  chrome.tabs.create({url: 'options.html'});
};

/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
ReloadController.prototype.reloadWindow = function(win)
{
  chrome.tabs.getAllInWindow(win.id, function reloadTabs(tabs) {
    var pinnedOnly = settings.pinnedOnly;
    for (var i in tabs) {
      var tab = tabs[i];
      if (!pinnedOnly || tab.pinned){
        chrome.tabs.update(tab.id, {url: tab.url, selected: tab.selected}, null);
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
      this.reloadWindow(windows[i]);
  }.bind(this));
};

