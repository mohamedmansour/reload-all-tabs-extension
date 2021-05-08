/**
 * Controls the browser tab reloads.
 *
 * @constructor
 */
 ReloadController = function()
{
  //move event listeners to init
  
  console.log("start instantiate" + new Date().toISOString())

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
    enableTimedReloads: false,
    reloadStartup: 'none',
    bypassCache: false,
    buttonDefaultAction: 'window'
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
    'enableTimedReloads',
    'reloadStartup',
    'bypassCache',
    'version'
  ]

    
    this.badgeSettings = {
        badge : {color: "#006633"},
        badgeOff : {text: ""},

        iconReady : {path: {'16': "img/icon16r.png", '48': "img/icon48r.png", '128': "img/icon128r.png"}},
        iconOn : {path: {'16': "img/icon16t.png", '48': "img/icon48t.png", '128': "img/icon128t.png"}},
        iconOff : {path: {'16': "img/icon16.png", '48': "img/icon48.png", '128': "img/icon128.png"}},

        iconDefault : this.iconOff
    };
	
	this.badgeUpdateTimer = null;

    this.init(); //sven init needs to fire ONLY after settings have been retrieved
}

ReloadController.prototype.onStorageChanged = function(changes, namespace) {
  for (key in changes) {
    this.cachedSettings[key] = changes[key].newValue

    var keysForceMenuRebuild = [
        'reloadWindow',
        'reloadAllWindows',
        'reloadPinnedOnly',
        'reloadUnpinnedOnly',
        'reloadAllRight',
        'reloadAllLeft',
        'closeAllRight',
        'closeAllLeft',
        'enableTimedReloads'
    ];
    // if we're disabling timed reloads in options - remove all timers
    if ( key == 'enableTimedReloads') {
      if ( changes[key].newValue == false ) this.removeAllTimers();
    }

    // if the changed key is any of the above, rebuild the context menu
    if ( -1 < keysForceMenuRebuild.indexOf(key) ) {
        this.createContextMenu('onStorageChaged-enableTimedReloads')
    }
    
  }    
}

ReloadController.prototype.onMessage = function(request, sender, response)
{
/**
 * Context Menu Message listener when a keyboard event happened.
 */

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
/**
 * define actions for each contextMenu option.
 */
    
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
    case 'enableTimedReloads':
    case 'timedReloadScope-tab': 
    case 'timedReloadScope-window': 
    case 'timedReloadInterval-none':
    case 'timedReloadInterval-10':
    case 'timedReloadInterval-30':
    case 'timedReloadInterval-60':
    case 'timedReloadInterval-120':
    case 'timedReloadInterval-300':
    case 'timedReloadInterval-900':
    case 'timedReloadInterval-1800':
    case 'timedReloadInterval-3600':
        // get current window and tab IDs
        var rlc = this;
        if ( info.menuItemId == 'enableTimedReloads' ){
            rlc.setTimedReloadEnabled(tab, info.checked);
        } else if ( null !== info.menuItemId.match(/^timedReloadScope/) ) {
            var scope = info.menuItemId.replace(/^timedReloadScope\-/,'').toLowerCase();
            rlc.setTimedReloadScope(tab, scope);    
        } else if ( null !== info.menuItemId.match(/^timedReloadInterval/) ) {
            var intvl = info.menuItemId.replace(/^timedReloadInterval\-/,'');
            rlc.setTimedReloadIntvl(tab, intvl);
        }
      break;
      default:
      break
  }
  this.updateContextMenu(tab,'onMenuClicked - '+info.menuItemId);
}

ReloadController.prototype.reload = function(info, tab)
{
/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */    
  if (this.cachedSettings.buttonDefaultAction == 'allWindows') { // All Windows.
    this.reloadAllWindows()
  } else if (this.cachedSettings.buttonDefaultAction == 'pinned') { // Pinned.
    chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadPinnedOnly: true}))
  } else if (this.cachedSettings.buttonDefaultAction == 'unpinned') { // Unpinned.
    chrome.windows.getCurrent((win) => this.reloadWindow(win, {reloadUnpinnedOnly: true}))
  } else { // Current Window.
    chrome.windows.getCurrent(this.reloadWindow.bind(this))
  }
}

ReloadController.prototype.init = function()
{
//  console.log("INIT-----------------------")
  //move event listeners to init
  
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
  
    // set listeners
    chrome.extension.onMessage.addListener(this.onMessage.bind(this))
    chrome.browserAction.onClicked.addListener(this.reload.bind(this))
    chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))
    chrome.windows.onCreated.addListener(this.onWindowCreate.bind(this))
    chrome.windows.onFocusChanged.addListener(this.onWindowFocused.bind(this))
    chrome.windows.onRemoved.addListener(this.onWindowClosed.bind(this))

    chrome.contextMenus.onClicked.addListener(this.onMenuClicked.bind(this))
    chrome.tabs.onActivated.addListener(this.onTabActivate.bind(this))
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this))
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this))

    chrome.tabs.onDetached.addListener(this.onTabDetached.bind(this))
    chrome.tabs.onAttached.addListener(this.onTabAttached.bind(this))    

    chrome.storage.sync.get(this.settingsToFetch, (settings) => {
        this.cachedSettings.version = settings.version;
        this.cachedSettings.buttonDefaultAction = (typeof settings.buttonDefaultAction == 'undefined') ? 'window' : settings.buttonDefaultAction;
        this.cachedSettings.enableKeyboardShortcut = settings.enableKeyboardShortcut == true;
        this.cachedSettings.shortcutKeyAlt = settings.shortcutKeyAlt == true;
        this.cachedSettings.reloadWindow = (typeof settings.reloadWindow == 'undefined') ? true : (settings.reloadWindow == true);
        this.cachedSettings.reloadAllWindows = settings.reloadAllWindows == true;
        this.cachedSettings.reloadPinnedOnly = settings.reloadPinnedOnly == true;
        this.cachedSettings.reloadUnpinnedOnly = settings.reloadUnpinnedOnly == true;
        this.cachedSettings.reloadAllRight = settings.reloadAllRight == true;
        this.cachedSettings.reloadAllLeft = settings.reloadAllLeft == true;
        this.cachedSettings.closeAllRight = settings.closeAllRight == true;
        this.cachedSettings.closeAllLeft = settings.closeAllLeft == true;
        this.cachedSettings.enableTimedReloads = (typeof settings.enableTimedReloads == 'undefined') ? false : settings.enableTimedReloads;
        this.cachedSettings.reloadStartup = (typeof settings.reloadStartup == 'undefined') ? 'none' : settings.reloadStartup;
        this.cachedSettings.bypassCache = settings.bypassCache == true;
        this.cachedSettings.shortcutKeyCode = (typeof settings.shortcutKeyCode == 'undefined') ? 82 : settings.shortcutKeyCode;
        this.cachedSettings.shortcutKeyShift = (typeof settings.shortcutKeyShift == 'undefined') ? true : (settings.shortcutKeyShift == true);


        //    console.log("---------------------------");
        //    console.log("end instantiate " + new Date().toISOString())
		var rlc = this;
        this.buildTimerObject(function(timers) {
			setInterval(function(){console.log(timers);}, 1000*60);
			rlc.createContextMenu('init');
		});

    });

    chrome.browserAction.setBadgeBackgroundColor(this.badgeSettings.badge);
};

ReloadController.prototype.onWindowCreate = function(win)
{
/** this is a onWindowCreate event - 
* removed startup reloads 
**/ 
	// add window to the object
	this.getWindowSettings(win.id);
}

ReloadController.prototype.updateBadgeText = function(windowId,tabId,force)
{
// switch tab = prev timer shows up in badge
// when zero stops - should be blank
// new timer doesn't restart countdown
 	
	if ( force ) { // called from active tab; reset any timer
		clearTimeout(this.badgeUpdateTimer);
		this.badgeUpdateTimer = null;
		chrome.browserAction.setBadgeText(this.badgeSettings.badgeOff);
	}	
    var winSettings = this.getWindowSettings(windowId);
    var tabSettings = this.getTabSettings(windowId,tabId);
	var ts = null,intvl = null;
	if ( null != winSettings.timer ) {
		intvl = winSettings.intvl;
		ts = winSettings.ts;
	} else if ( null != tabSettings.timer ) {
		intvl = tabSettings.intvl;
		ts = tabSettings.ts;
	} else { // no timer
		chrome.browserAction.setBadgeText(this.badgeSettings.badgeOff);
		return;
	}
		
	var badgeIntvl = 1000;
	var rem = parseInt(( ts + intvl*1000-new Date().getTime() )/1000);

	if ( rem > 60 ) {
		badgeIntvl *= 60;
		rem = parseInt(rem/60);
		rem = "-"+rem+"m";
	} else if ( rem == 0 ) {	
		rem = "...";
	} else {
		rem = "-"+rem+"s";
	}
	var rlc = this;
	this.badgeUpdateTimer = setTimeout(function(){
		rlc.badgeUpdateTimer = null;
		rlc.updateBadgeText(0+windowId,0+tabId);
	}, parseInt(badgeIntvl));	
//	console.log(rem)
	chrome.browserAction.setBadgeText({text:rem});
}

ReloadController.prototype.updateContextMenu = function(tab,s)
{    
/**
 * updat menu w/ tab and window-specific settings
 */
	if (!this.cachedSettings.enableTimedReloads) {
		return;
	};

    if ( tab == null ) return;
    
    var tabId = tab.id;
    var windowId = tab.windowId;
    var winSettings = this.getWindowSettings(windowId);

    var tabSettings = this.getTabSettings(windowId,tabId);
    var currIntvl = (winSettings.scope=="window")
                    ?winSettings.intvl
                    :tabSettings.intvl;

	if (!winSettings.enabled) {
		this.badgeSettings.iconDefault = this.badgeSettings.iconOff;
	}else {
		this.badgeSettings.iconDefault = this.badgeSettings.iconReady;
	};            
                    
//    console.log('update context menu - '+s+" - intvl="+currIntvl+", enabled="+winSettings.enabled);

	if ( null != winSettings.timer || null != tabSettings.timer ) {
		chrome.browserAction.setIcon(this.badgeSettings.iconOn);
	} else { 
		chrome.browserAction.setIcon(this.badgeSettings.iconDefault);
	}

	if ( null != winSettings.timer ) {
		console.log("call updateBadge for win "+winSettings.id)
	} else if ( null != tabSettings.timer ) {
		console.log("call updateBadge for win "+winSettings.id+", tab "+tabSettings.id)
	} else {
		console.log("no timer on win "+winSettings.id+", tab "+tabSettings.id+"- call updateBadge to reset badge")
	}

	this.updateBadgeText(windowId,tabId,true);

	chrome.contextMenus.update('enableTimedReloads',{
		title:(winSettings.enabled?"Clear for this window":"Enable for this window"),
		checked: (winSettings.enabled)
	});
	chrome.contextMenus.update('timedReloadScope',{
		visible: (winSettings.enabled)
	});
	chrome.contextMenus.update('timedReloadScope-tab',{
		visible: (winSettings.enabled),
		checked:(winSettings.scope=="tab")
	});
	chrome.contextMenus.update('timedReloadScope-window',{
		visible: (winSettings.enabled),
		checked: (winSettings.scope=="window")
	});
	chrome.contextMenus.update('timedReloadIntvl',{
		visible: (winSettings.enabled)
	});

	chrome.contextMenus.update('timedReloadInterval-none',{
		visible: (winSettings.enabled),
		checked: (currIntvl=="none"||currIntvl==null)
	})
	chrome.contextMenus.update('timedReloadInterval-10',{ 
		visible: (winSettings.enabled),
		checked: (currIntvl==10)
	})
	chrome.contextMenus.update('timedReloadInterval-30',{
		visible: (winSettings.enabled),
		checked: (currIntvl==30)
	})
	chrome.contextMenus.update('timedReloadInterval-60',{
		checked: (currIntvl==60),
		visible: (winSettings.enabled)
	})    
	chrome.contextMenus.update('timedReloadInterval-120',{
		checked: (currIntvl==120),
		visible: (winSettings.enabled)
	})    
	chrome.contextMenus.update('timedReloadInterval-300',{
		checked: (currIntvl==300),
		visible: (winSettings.enabled)
	})
	chrome.contextMenus.update('timedReloadInterval-900',{
		checked: (currIntvl==900),
		visible: (winSettings.enabled)
	})
	chrome.contextMenus.update('timedReloadInterval-1800',{
		checked: (currIntvl==1800),
		visible: (winSettings.enabled)
	})
	chrome.contextMenus.update('timedReloadInterval-3600',{
		checked: (currIntvl==3600),
		visible: (winSettings.enabled)
	})
}

ReloadController.prototype.onInstall = function()
{
/**
 * When the extension first installed.
 */
  chrome.runtime.openOptionsPage()
}

ReloadController.prototype.closeWindow = function(win, options = {})
{
/**
 * Close tabs to left or right one by one.
 *
 * @param win Window to close.
 */
 chrome.tabs.getAllInWindow(win.id, (tabs) => {

    var pastCurrent = false;

    for (var i in tabs) {
      var tab = tabs[i];
      var closeThisTab = false;

      if ( tab.active ) {
        pastCurrent = true;
        continue;
      }

      if (pastCurrent) { // right of current
        if (options.closeAllLeft) return;
        if (options.closeAllRight) closeThisTab = true;
      } else { // left of current
        if (options.closeAllLeft) closeThisTab = true;
      }
      if (closeThisTab) chrome.tabs.remove(tab.id); 
    }
  })
}

ReloadController.prototype.reloadWindow = function(win, options = {})
{
/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
 chrome.tabs.getAllInWindow(win.id, (tabs) => {
    const strategy = {}
    var reloadCounter = 0; // counter to stagger reloads
    for (var i in tabs) {
      var tab = tabs[i];
      reloadCounter = this.reloadStrategy(tab, strategy, options, reloadCounter)
    }
  })
}

ReloadController.prototype.reloadStrategy = function(tab, strategy, options = {}, reloadCounter) {
// When this gets complicated, create a strategy pattern.
// consider pinnd/unpinned etc

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
    reloadCounter++;
    const con = chrome.extension.getBackgroundPage().console;
    con.log('reloading ${tab.url}, cache bypassed: ${this.cachedSettings.bypassCache}')
    var bpc = this.cachedSettings.bypassCache;
    var id = tab.id;
    setTimeout(function(){
        chrome.tabs.reload(id, { bypassCache: bpc }, null)
        }, reloadCounter*500);
    return reloadCounter;
  }
}

ReloadController.prototype.reloadAllWindows = function()
{
/**
 * Reload all tabs in all windows one by one.
 */
 chrome.windows.getAll({}, function(windows) {
    for (var i in windows) {
        setTimeout(function(){
            this.reloadWindow(windows[i])
        , 500});
    }
  }.bind(this))
};

///sven : new methods below to support timed reloads
ReloadController.prototype.createContextMenu = function(s)
{
/**
 * Create menu based on settings
 * only gets update when settings change
 */
// console.log('(re)create context menu - '+s)
        
    chrome.contextMenus.removeAll()

    var attributions = '';
    if (this.cachedSettings.bypassCache) {
        attributions = ' (cache bypassed)'
    }

    if (this.cachedSettings.reloadWindow || 
        this.cachedSettings.reloadAllWindows ||
        this.cachedSettings.reloadPinnedOnly ||
        this.cachedSettings.reloadUnpinnedOnly ||
        this.cachedSettings.reloadAllLeft ||
        this.cachedSettings.reloadAllRight
        ) {
        chrome.contextMenus.create({
            id: 'reload',
            type: 'normal',
            title: 'Reload ...',
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadWindow) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadWindow',
            type: 'normal',
            title: 'Reload this window'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadAllWindows) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadAllWindows',
            type: 'normal',
            title: 'Reload all windows'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadPinnedOnly) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadPinnedOnly',
            type: 'normal',
            title: 'Reload pinned tabs'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadUnpinnedOnly) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadUnpinnedOnly',
            type: 'normal',
            title: 'Reload unpinned tabs'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadAllLeft) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadAllLeft',
            type: 'normal',
            title: 'Reload all tabs to the left'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.reloadAllRight) {
        chrome.contextMenus.create({
            parentId: 'reload',
            id: 'reloadAllRight',
            type: 'normal',
            title: 'Reload all tabs to the right'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.closeAllLeft ||
        this.cachedSettings.closeAllRight) {
        chrome.contextMenus.create({
            id: 'close',
            type: 'normal',
            title: 'Close tabs',
            contexts: ['all']
        })
    }
    if (this.cachedSettings.closeAllLeft) {
        chrome.contextMenus.create({
            parentId: 'close',
            id: 'closeAllLeft',
            type: 'normal',
            title: 'To the left'+attributions,
            contexts: ['all']
        })
    }

    if (this.cachedSettings.closeAllRight) {
        chrome.contextMenus.create({
            parentId: 'close',
            id: 'closeAllRight',
            type: 'normal',
            title: 'To the right'+attributions,
            contexts: ['all']
        })
    }
    if (this.cachedSettings.enableTimedReloads) {
        
    // timed reload menus
    // use defaults
    // window specific settings will be handled in updateContextMenu
        chrome.contextMenus.create({
            id: 'timedReloads',
            type: 'normal',
            title: 'Timed reloads',
            contexts: ['all']
        });
        chrome.contextMenus.create({
            parentId: 'timedReloads',
            id: 'enableTimedReloads',
            type: 'checkbox',
            title: 'Enable for this window',
            checked: false,
            contexts: ['all']
        });
         chrome.contextMenus.create({
            parentId: 'timedReloads',
            visible: false,
            id: 'timedReloadScope',
            title: 'Set scope',
            checked: false,
            contexts: ['all']
        });
         chrome.contextMenus.create({
            parentId: 'timedReloadScope',
            visible: false,
            id: 'timedReloadScope-tab',
            type: 'radio',
            title: 'Set per each tab in window',
            checked: false,
            contexts: ['all']
        });
        chrome.contextMenus.create({
            parentId: 'timedReloadScope',
            id: 'timedReloadScope-window',
            visible: false,
            type: 'radio',
            title: 'Set for all tabs in window',
            checked: false,
            contexts: ['all']
        });
        chrome.contextMenus.create({
            parentId: 'timedReloads',
            visible: false,
            id: 'timedReloadIntvl',
            title: 'Set interval',
            checked: false,
            contexts: ['all']
        });
        chrome.contextMenus.create({
            id: 'timedReloadInterval-none',
            parentId: 'timedReloadIntvl',
            title: 'OFF',
            visible: false,
            type: 'radio',
            checked: true,
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-10',
            parentId: 'timedReloadIntvl',
            visible: false,
            title: '10sec',
            type: 'radio',
            checked: false,
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-30',
            parentId: 'timedReloadIntvl',
            type: 'radio',
            visible: false,
            checked: false,
            title: '30sec',
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-60',
            parentId: 'timedReloadIntvl',
            type: 'radio',
            visible: false,
            checked: false,
            title: '1 minute',
            contexts: ['all']
        })    
        chrome.contextMenus.create({
            id: 'timedReloadInterval-120',
            parentId: 'timedReloadIntvl',
            type: 'radio',
            visible: false,
            checked: false,
            title: '2 minutes',
            contexts: ['all']
        })    
        chrome.contextMenus.create({
            id: 'timedReloadInterval-300',
            parentId: 'timedReloadIntvl',
            type: 'radio',
            visible: false,
            checked: false,
            title: '5 minutes',
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-900',
            parentId: 'timedReloadIntvl',
            visible: false,
            type: 'radio',
            checked: false,
            title: '15 minutes',
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-1800',
            parentId: 'timedReloadIntvl',
            type: 'radio',
            visible: false,
            checked: false,
            title: '30 minutes',
            contexts: ['all']
        })
        chrome.contextMenus.create({
            id: 'timedReloadInterval-3600',
            parentId: 'timedReloadIntvl',
            visible: false,
            type: 'radio',
            checked: false,
            title: '60 minutes',
            contexts: ['all']
        })

    }
    var rlc = this;
    chrome.tabs.query({
            "active":true,
            "windowType":"normal",
            "currentWindow":true
        }, 
        function (tabs) {
            rlc.updateContextMenu(tabs[0], "createContextMenu");
        }
    );
};

ReloadController.prototype.setTimedReloadEnabled = function (tab, enabled) {
/**
*    Settings are by window
*     save setting; this will control whether timers run
**/    
    
    var winSettings = this.getWindowSettings(tab.windowId);

    if ( !enabled) {
//        console.log('removing timers from win - setTimedReloadEnabled')
        this.removeWinTimers(tab.windowId);
        winSettings.enabled = false;
    } else {
        winSettings.enabled = true;
    }
    
}

ReloadController.prototype.setTimedReloadIntvl = function (tab, intvl) {
/**
*    scope : win, gobal, tab
*    interval
*     when change in intvl, remove & replace prior intervals
*    this.timers.tabs, .windows
**/
    var winSettings = this.getWindowSettings(tab.windowId);
    var tabSettings = this.getTabSettings(tab.windowId,tab.id);
    
    // interval changed
//    console.log('intvl changed to '+intvl);
    
    if ( winSettings.scope == 'window' ) {
        // change the window timer
        winSettings.intvl = intvl;
        if ( null != winSettings.timer ) {
            clearInterval(winSettings.timer);
            winSettings.timer = null;
        }
        if ( intvl != "none" ) {
            winSettings.ts = new Date().getTime();
            winSettings.timer = this.createNewTimer(tab.windowId, null, intvl, 'win '+tab.windowId);
        }
    } else if (winSettings.scope == 'tab') {
        // change the tab timers
        tabSettings.intvl = intvl;
        if ( null != tabSettings.timer ) {
            clearInterval(tabSettings.timer);
            tabSettings.timer = null;
        }
        if ( intvl != "none" ) {
            tabSettings.ts = new Date().getTime();
            tabSettings.timer = this.createNewTimer(tab.windowId, tab.id, intvl, 'tab '+tab.title);
        }
    }
}

ReloadController.prototype.setTimedReloadScope = function (tab,scope) {
/**
*    scope : win, gobal, tab
*    interval
*     when change in scope, remove prior intervals
*    this.timers.tabs, .windows
**/
    var winSettings = this.getWindowSettings(tab.windowId);

    if ( scope != winSettings.scope ) {
//        console.log('scope changed to '+scope);
        winSettings.scope = scope;
        if ( scope == 'window' ){ // changed to window
            // remove tab timers on the window
            this.removeWinTimers(tab.windowId);
            // can't redo timers - tabs have all diff ones
            setTimeout( function () {
                alert("Changing the scope to window removed individual tab timers. Please set them as you need.");
            }, 100);
        } else { // changed to tabs - tabs will get win.intvl based timers
            var tabIntvl = winSettings.intvl;
            if ( tabIntvl != null && tabIntvl != 'none' ) {
                // remove all timers
                this.removeWinTimers(tab.windowId);
                // set new tab timers wt the win intvl
                for ( var i in this.timers.tabs ) {
                    this.timers.tabs[i].intvl = tabIntvl;
                    this.timers.tabs[i].ts = new Date().getTime();
                    this.timers.tabs[i].timer = this.createNewTimer(tab.windowId, tab.id, tabIntvl, 'tab '+tab.title);
                }
            }
        }
    }
}

ReloadController.prototype.removeWinTimers = function (winId,tabId, del) {
/**
*    remove all timers for a window
**/
    console.log('removeWinTimers '+winId+','+tabId)

	var winSettings = this.getWindowSettings(winId);

    
	var intvlCleared = {tab:0, win:0};
    if ( tabId ) {
		var tabSettings = this.getTabSettings(winId,tabId);
		tabSettings.intvl = null;
        tabSettings.ts = null;
        if (null!=tabSettings.timer){
            clearInterval(tabSettings.timer);
            tabSettings.timer = null;
            intvlCleared.tab++;
            console.log('Cleared timer for tab '+tabId+' in win '+winId);
        }
    } else {
        winSettings.intvl = null;
        winSettings.ts = null;
        if (null!=winSettings.timer){
            clearInterval(winSettings.timer);
            winSettings.timer = null;
            intvlCleared.win++;
            console.log('cleared timer for Window '+winId);
        }
        for ( var i in this.timers.tabs ) {
			if (this.timers.tabs[i].windowId != winId) continue; 
            this.timers.tabs[i].intvl = null;
            this.timers.tabs[i].ts = null;
            if (null!=this.timers.tabs[i].timer){
                clearInterval(this.timers.tabs[i].timer);
                this.timers.tabs[i].timer = null;
                intvlCleared.tab++;
                console.log('cleared timer for tab '+i+' in win '+winId);
            }
        }
    }
    return intvlCleared;
}

ReloadController.prototype.removeAllTimers = function () {
/**
*    remove all timers for all windows
**/
    for (var i in this.timers.windows) {
        this.removeWinTimers(i);
    }

}

ReloadController.prototype.createNewTimer = function (winId, tabId, intvl, msg) {    
    var rlc = this;
    console.log('setting timer for win/tab '+winId+"/"+tabId+" - "+msg+', '+this.formatIntvl(intvl))

    return setInterval( 
        function (){
            rlc.doTimedReload(winId, tabId, msg);
        }, intvl*1000 );
}

ReloadController.prototype.doTimedReload = function(winId, tabId, msg) {
/**
 * called by the set interval.
 * reload that specific tab
 */
 
//    console.log('timed reload: win/tab/msg : '+winId+', '+tabId+', '+msg)
	var bpc = this.cachedSettings.bypassCache;
    function doit(title,tabid,bpc,reloadCounter){    
        setTimeout(function(){
            chrome.tabs.reload(tabid, { bypassCache: bpc }, function(){
                console.log('Reloading '+title+' ('+tabid+'), '+(bpc?'cache bypassed':'')+' at '+new Date().toLocaleString());
            })
        }, reloadCounter*500);        
    }
	var n = new Date().getTime();
    if ( null!=tabId ) { // single tab
        var tabSettings = this.getTabSettings(winId, tabId);
		tabSettings.ts = n+1000;
        doit(tabSettings.title, tabId, bpc, 0)
    } else { // all window tabs
		var winSettings = this.getWindowSettings(winId);
		winSettings.ts = n+1000;
        chrome.tabs.getAllInWindow(winId, function (tabs) {
            var reloadCounter = 0; // counter to stagger reloads
            for (var i=0; i<tabs.length; i++) {
                var tab = tabs[i];
                doit(tab.title, tab.id, bpc, reloadCounter);
				reloadCounter++;
            }
        });
    }
}

ReloadController.prototype.getWindowSettings = function (winId) {
/**
*     get settings from BGpage by winId
**/
    this.timers.windows[winId] = this.timers.windows[winId] || {
        intvl: 'none',
        scope: 'window',
        ts: null,
        title : null,
        timer: null,
        enabled : false,
		id: winId
    };
    return this.timers.windows[winId];
}

ReloadController.prototype.getTabSettings = function (winId,tabId) {
/**
*     get settings from BGpage by tabId
**/

    this.timers.tabs[tabId] = this.timers.tabs[tabId] || {
        intvl: 'none',
        title : null,
        url : null,
        timer: null,
        id: tabId,
		windowId: winId
    };
	if ( this.timers.tabs[tabId].windowId != winId )
		this.timers.tabs[tabId].windowId = winId;
    return this.timers.tabs[tabId];
}

ReloadController.prototype.buildTimerObject = function(cb){
	// called only at init
	console.log("init timers obj")
    this.timers = {windows: {}, tabs:{}};
    var rlc = this;

    chrome.windows.getAll({populate:true, windowTypes:['normal']}, function(windows) {
//        console.log("build timers object");
        for ( var w=0; w<windows.length; w++ ){
            var winSettings = rlc.getWindowSettings(windows[w].id);

            for ( var t=0; t<windows[w].tabs.length; t++ ){
                var tabSettings = rlc.getTabSettings(windows[w].id, windows[w].tabs[t].id);
                tabSettings.title=windows[w].tabs[t].title; 
                tabSettings.url=windows[w].tabs[t].url;
                tabSettings.id=windows[w].tabs[t].id;
            }
        }
		if ( cb && typeof(cb)=="function" ){
			cb(rlc.timers);
		}
    })
}

ReloadController.prototype.formatIntvl = function (i) {
    
    return (i>=60?(i/60)+'min':i+'sec')
    
}

ReloadController.prototype.onWindowClosed = function(winId)
{
/**
 * called then a window is closed
 * if theres a window timer - kill it, then remove win object
*/
	console.log("win closed")
	var winSettings = this.getWindowSettings(winId);
	if ( winSettings.timer != null ) {
		clearInterval(winSettings.timer);
	}
	delete winSettings;
}

ReloadController.prototype.onWindowFocused = function(winId)
{
    var rlc = this;
    chrome.tabs.query({
            "active":true,
            "windowType":"normal",
            "currentWindow":true}, 
            function (tabs) {
                if ( tabs.length == 0 || tabs[0].id == -1 ) return;
                rlc.onTabActivate({windowId: winId,tabId:tabs[0].id})
            }
    );
}

ReloadController.prototype.onTabAttached = function(tabid, info)
{
/**
 * called then a tab is attached
 * 
*/
    if ( tabid == -1 ||  tabid == undefined ) return
	this.getTabSettings(info.windowId, tabid);
//console.log("attached")
//console.log(info) // if detached winId = -1
//console.log(this.timers)
}

ReloadController.prototype.onTabDetached = function(tabid, info)
{
/**
 * called then a tab is detached
 * set the old winID on tab setting
*/
//console.log("detached")
//console.log(info) // if detached winId = -1
//console.log(this.timers)
}

ReloadController.prototype.onTabActivate = function(info)
{
/**
 * called then a tab is activated
 * 
*/
// info.tabId
// info.windowId

    if ( info.windowId == -1 ) return
    var rlc = this;
	// get the curr tab and window
    chrome.tabs.get(info.tabId, function (tab){
		if ( rlc.timers.windows[tab.windowId] ) 
		
		
        var tabSettings = rlc.getTabSettings(tab.windowId, tab.id);
            tabSettings.title=tab.title; 
            tabSettings.url=tab.url;
            tabSettings.id=tab.id;
        rlc.updateContextMenu(tab, "tab activated");        
//console.log("activated")
//console.log(info) // if detached winId = -1
//console.log(rlc.timers)
    });
}

ReloadController.prototype.onTabUpdated = function(tabId, changeInfo, tab)
{ 
/**
 * called then a tab is opened
 * 
*/
//console.log("updated")
//console.log("tab "+tabId)
//console.log(changeInfo)
//console.log(this.timers)

    if ( tabId == -1 ) return;

    if ( changeInfo.url || changeInfo.title ) {
        var tabSettings = this.getTabSettings(tab.windowId, tab.id);
            tabSettings.title=tab.title; 
            tabSettings.url=tab.url;
    }
}

ReloadController.prototype.onTabRemoved = function(tabId, info)
{
/**
 * called then a tab is closed
 * if theres a tab timer - kill it; remove the tab object
*/
console.log("tab removed")
    if ( tabId == -1 ) return

	// single tab closed
	var tabSettings = this.getTabSettings(info.windowId,tabId);
	if ( tabSettings.timer != null ) {
		clearInterval(tabSettings.timer);
	}
	delete tabSettings;
}


const reloadController = new ReloadController()
