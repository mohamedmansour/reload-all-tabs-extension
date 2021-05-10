/*
 * We only need persistence when timed reloads are set (win or tabs)
 */

let timers = {windows: {}, tabs:{}};
let badgeSettings = {
      badge : {color: "#006633"},
      badgeOff : {text: ""},

      iconReady : {path: {'16': "img/icon16r.png", '48': "img/icon48r.png", '128': "img/icon128r.png"}},
      iconOn : {path: {'16': "img/icon16t.png", '48': "img/icon48t.png", '128': "img/icon128t.png"}},
      iconOff : {path: {'16': "img/icon16.png", '48': "img/icon48.png", '128': "img/icon128.png"}},
      badgeUpdateTimer : null
  };



async function getSetting(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (values) => {
      let results = {}
      keys.forEach(key => {
        let result = undefined
        const value = values[key]

        switch (key) {
          case 'version':
            result = value
            break
          case 'buttonDefaultAction':
            result = (typeof value == 'undefined') ? 'window' : value
            break
          case 'reloadWindow':
            result = (value == 'undefined') ? true : (value == true)
            break
          case 'reloadAllwind ows':
          case 'reloadPinnedOnly':
          case 'reloadUnpinnedOnly':
          case 'reloadAllRight':
          case 'reloadAllLeft':
          case 'closeAllRight':
          case 'closeAllLeft':
          case 'bypassCache':
          case 'enableTimedReloads':
            result = value || false;
            break
          default:
            result = undefined
            break
        }

        results[key] = result
      })

      resolve(results)
    })
  })
}

/**
 * Initializes the reload extension.
 */
async function init() {
  chrome.action.onClicked.addListener(async () => await reload())
  chrome.storage.onChanged.addListener(async (changes) => await onStorageChanged(changes))
  chrome.commands.onCommand.addListener(async () => await reload());
  
  chrome.contextMenus.onClicked.addListener((info,tab) => onMenuClicked(info,tab))  
//sven
	chrome.windows.onCreated.addListener((win) => onWindowCreate(win))
	chrome.windows.onFocusChanged.addListener((winId) => onWindowFocused(winId))
	chrome.windows.onRemoved.addListener((winId) => onWindowClosed(winId))

  chrome.tabs.onActivated.addListener((info) => onTabActivate(info))
  chrome.tabs.onRemoved.addListener((tabId, info) => onTabRemoved(tabId, info))
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => onTabUpdated(tabId, changeInfo, tab))

  chrome.tabs.onDetached.addListener((tabid, info) => onTabDetached(tabid, info))
  chrome.tabs.onAttached.addListener((tabid, info) => onTabAttached(tabid, info))    
  
  console.log("init timers obj")
  
  buildTimerObject(function() {
    createContextMenu('init');
  });

  // Version Check.
  const currVersion = chrome.runtime.getManifest().version
  const { version } = await getSetting(['version'])

  if (currVersion != version) {

    // Check if we just installed this extension.
    if (typeof version == 'undefined') {
      onInstall()
    }

    // Update the version incase we want to do something in future.
    chrome.storage.sync.set({ 'version': currVersion })
  }
  const { enableTimedReloads } = await getSetting(['enableTimedReloads'])
  badgeSettings.iconDefault = (enableTimedReloads)?badgeSettings.iconReady:badgeSettings.iconOff;
  chrome.action.setBadgeBackgroundColor(badgeSettings.badge);
}


async function onStorageChanged(changes) {
	
  for (key in changes) {
    if (key.startsWith('enable') || key.startsWith('reload') || key == 'bypassCache' || key.startsWith('close')) {
    // if we're disabling timed reloads in options - remove all timers
      if ( key == 'enableTimedReloads') {
        if ( changes[key].newValue == false ) await removeAllTimers(); 
      }
      await createContextMenu()
    }
  }
}

function onMenuClicked(info, tab) {
  switch (info.menuItemId) {
    case 'reloadWindow':
      chrome.windows.getCurrent((win) => reloadWindow(win))
      break
    case 'reloadAllWindows':
      reloadAllWindows()
      break
    case 'reloadPinnedOnly':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true }))
      break
    case 'reloadUnpinnedOnly':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true }))
      break
    case 'reloadAllLeft':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllLeft: true }))
      break
    case 'reloadAllRight':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllRight: true }))
      break
    case 'closeAllLeft':
      chrome.windows.getCurrent((win) => closeWindow(win, { closeAllLeft: true }))
      break
    case 'closeAllRight':
      chrome.windows.getCurrent((win) => closeWindow(win, { closeAllRight: true }))
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
        if ( info.menuItemId == 'enableTimedReloads' ){
          setTimedReloadEnabled(tab, info.checked);
        } else if ( null !== info.menuItemId.match(/^timedReloadScope/) ) {
          var scope = info.menuItemId.replace(/^timedReloadScope\-/,'').toLowerCase();
          setTimedReloadScope(tab, scope);    
        } else if ( null !== info.menuItemId.match(/^timedReloadInterval/) ) {
          var intvl = info.menuItemId.replace(/^timedReloadInterval\-/,'');
          setTimedReloadIntvl(tab, intvl);
        }
        // selecting any timedReload-related option requires a menu update
        updateContextMenu(tab,'onMenuClicked - '+info.menuItemId);
      break;
    default:
      break
  }
}

/**
 * Reload Routine. It checks which option the user has allowed (All windows, or
 * or just the current window) then initiates the request.
 */
async function reload() {
  const { buttonDefaultAction } = await getSetting(['buttonDefaultAction'])
  switch (buttonDefaultAction) {
    case 'allWindows':
      reloadAllWindows()
      break
    case 'pinned':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadPinnedOnly: true }))
      break
    case 'unpinned':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadUnpinnedOnly: true }))
      break
    default:
      chrome.windows.getCurrent((win) => reloadWindow(win))
      break
  }
}

/**
 * Handles the request coming back from an external extension.
 */
async function createContextMenu(s) {
  
  console.log(s)
  
  chrome.contextMenus.removeAll()

  const setting = await getSetting([
    'bypassCache',
    'reloadWindow',
    'reloadAllWindows',
    'reloadPinnedOnly',
    'reloadUnpinnedOnly',
    'reloadAllLeft',
    'reloadAllRight',
    'closeAllLeft',
    'closeAllRight',
    'enableTimedReloads'
  ])

  let bypassCache = ''
  bypassCache = setting.bypassCache?' (cache bypassed)':''

  if (setting.reloadWindow || 
      setting.reloadAllWindows ||
      setting.reloadPinnedOnly ||
      setting.reloadUnpinnedOnly ||
      setting.reloadAllLeft ||
      setting.reloadAllRight
      ) {
      chrome.contextMenus.create({
          id: 'reload',
          type: 'normal',
          title: 'Reload ...',
          contexts: ['all']
      })
  }
  if (setting.reloadWindow) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadWindow',
          type: 'normal',
          title: 'Reload this window'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.reloadAllWindows) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadAllWindows',
          type: 'normal',
          title: 'Reload all windows'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.reloadPinnedOnly) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadPinnedOnly',
          type: 'normal',
          title: 'Reload pinned tabs'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.reloadUnpinnedOnly) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadUnpinnedOnly',
          type: 'normal',
          title: 'Reload unpinned tabs'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.reloadAllLeft) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadAllLeft',
          type: 'normal',
          title: 'Reload all tabs to the left'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.reloadAllRight) {
      chrome.contextMenus.create({
          parentId: 'reload',
          id: 'reloadAllRight',
          type: 'normal',
          title: 'Reload all tabs to the right'+bypassCache,
          contexts: ['all']
      })
  }
  if (setting.closeAllLeft ||
      setting.closeAllRight) {
      chrome.contextMenus.create({
          id: 'close',
          type: 'normal',
          title: 'Close tabs',
          contexts: ['all']
      })
  }
  if (setting.closeAllLeft) {
      chrome.contextMenus.create({
          parentId: 'close',
          id: 'closeAllLeft',
          type: 'normal',
          title: 'To the left',
          contexts: ['all']
      })
  }

  if (setting.closeAllRight) {
      chrome.contextMenus.create({
          parentId: 'close',
          id: 'closeAllRight',
          type: 'normal',
          title: 'To the right',
          contexts: ['all']
      })
  }
  if (setting.enableTimedReloads) {
      
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

  chrome.tabs.query({
          "active":true,
          "windowType":"normal",
          "currentWindow":true
      }, 
      function (tabs) {
          updateContextMenu(tabs[0], "createContextMenu");
      }
  );
}

/**
 * When the extension first installed.
 */
function onInstall() {  
  chrome.runtime.openOptionsPage()
}

/**
 * Close tabs to left or right one by one.
 *
 * @param win Window to close.
 */
function closeWindow(win, options = {}) {
  chrome.tabs.query({ windowId: win.id }, (tabs) => {
    const tabsToClose = []
    let passedCurrent = false

    for (const i in tabs) {
      const tab = tabs[i]

      if (tab.active) {
        passedCurrent = true
        continue
      }

      if (passedCurrent) { // right of current
        if (options.closeAllLeft) {
          break
        }

        if (options.closeAllRight) {
          tabsToClose.push(tab.id)
        }
      } else if (options.closeAllLeft) {
        tabsToClose.push(tab.id)
      }
    }

    if (tabsToClose.length) {
      chrome.tabs.remove(tabsToClose).then(() => { })
    }
  })
}

/**
 * Reload all |tabs| one by one.
 *
 * @param win Window to reload.
 */
async function reloadWindow(win, options = {}) {
  chrome.tabs.query({ windowId: win.id }, async (tabs) => {
    const strategy = {}
    var reloadCounter = 0; // counter to stagger reloads
    for (const i in tabs) {
      const tab = tabs[i]
      await reloadStrategy(tab, strategy, options, reloadCounter)
    }
  })
}

// When this gets complicated, create a strategy pattern.
async function reloadStrategy(tab, strategy, options = {}, reloadCounter) {
  let issueReload = true

  if (options.reloadPinnedOnly && !tab.pinned) {
    issueReload = false
  }

  if (options.reloadUnpinnedOnly && tab.pinned) {
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

  if (issueReload) {
    const { bypassCache } = await getSetting(['bypassCache'])
    console.log(`reloading ${tab.url}, cache bypassed: ${bypassCache}`)

    var id = tab.id;
    setTimeout(function(){
        chrome.tabs.reload(id, { bypassCache }, null)
        }, reloadCounter*500);
    return reloadCounter++;
  }
}

/**
 * Reload all tabs in all windows one by one.
 */
function reloadAllWindows() {
  chrome.windows.getAll({}, (windows) => {
    for (const i in windows) {
      let winId = windows[i];
      setTimeout(function(){
        reloadWindow(winId)
        , 500});
    }
  })
}

try {
  init()
}
catch (e) {
  console.error(e)
}

/// sven add'l methods
function onWindowCreate(win)
{
/** this is a onWindowCreate event - 
* removed startup reloads 
**/ 
	// add window to the object
  timers.windows[win.id] = 
      timers.windows[win.id] || createWindowSettings(win.id);
      
}

async function updateBadgeText(windowId,tabId,force)
{
// switch tab = prev timer shows up in badge
// when zero stops - should be blank
// new timer doesn't restart countdown
 
	if ( force ) { // called from active tab; reset any timer
		clearTimeout(badgeSettings.badgeUpdateTimer);
		badgeSettings.badgeUpdateTimer = null;
		chrome.action.setBadgeText(badgeSettings.badgeOff);
	}	
 
	var ts = null,intvl = null;
	if ( null != timers.windows[windowId].timer ) {
		intvl = timers.windows[windowId].intvl;
		ts = timers.windows[windowId].ts;
	} else if ( null != timers.tabs[tabId].timer ) {
		intvl = timers.tabs[tabId].intvl;
		ts = timers.tabs[tabId].ts;
	} else { // no timer
		chrome.action.setBadgeText(badgeSettings.badgeOff);
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
	badgeSettings.badgeUpdateTimer = setTimeout(function(){
		updateBadgeText(0+windowId,0+tabId);
	}, parseInt(badgeIntvl));	
//	console.log(rem)
	chrome.action.setBadgeText({text:rem});
}

async function updateContextMenu(tab,s)
{    
/**
 * update menu w/ tab and window-specific settings
 */
  const { enableTimedReloads } = await getSetting(['enableTimedReloads']);
	if ( !enableTimedReloads) {
		return;
	};

console.log("upd menu - "+s)
console.log(timers)

  if ( tab == null ) return;
  
  var tabId = tab.id;
  var windowId = tab.windowId;
  var winSettings = timers.windows[windowId];

  var tabSettings = timers.tabs[tabId];
  var currIntvl = (winSettings.scope=="window")
                  ?winSettings.intvl
                  :tabSettings.intvl;

	if (!winSettings.enabled) {
		badgeSettings.iconDefault = badgeSettings.iconOff;
	}else {
		badgeSettings.iconDefault = badgeSettings.iconReady;
	};            
                    
//    console.log('update context menu - '+s+" - intvl="+currIntvl+", enabled="+winsetting.enabled);

	if ( null != winSettings.timer || null != tabSettings.timer ) {
		chrome.action.setIcon(badgeSettings.iconOn);
	} else { 
		chrome.action.setIcon(badgeSettings.iconDefault);
	}

	if ( null != winSettings.timer ) {
		console.log("call updateBadge for win "+winSettings.id)
	} else if ( null != tabSettings.timer ) {
		console.log("call updateBadge for win "+winSettings.id+", tab "+tabSettings.id)
	} else {
		console.log("no timer on win "+winSettings.id+", tab "+tabSettings.id+"- call updateBadge to reset badge")
	}

	updateBadgeText(windowId,tabId,true);

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

function setTimedReloadEnabled(tab, enabled) {
/**
*    Settings are by window
*     save setting; this will control whether timers run
**/
    if ( !enabled ) {
//        console.log('removing timers from win - setTimedReloadEnabled')
        removeWinTimers(tab.windowId);
        timers.windows[tab.windowId].enabled = false;
    } else {
        timers.windows[tab.windowId].enabled = true;
    }
}

async function setTimedReloadIntvl(tab, intvl) {
/**
*    scope : win, gobal, tab
*    interval
*     when change in intvl, remove & replace prior intervals
*    timers.tabs, .windows
**/   

    const winId = tab.windowId;
    const n = new Date().getTime();

    if ( timers.windows[winId].scope == 'window' ) {
      if ( timers.windows[winId].intvl == intvl) return;

      // change the window timer
      timers.windows[winId].intvl = intvl;
      if ( null != timers.windows[winId].timer ) {
          clearInterval(timers.windows[winId].timer);
          timers.windows[winId].timer = null;
      }
      if ( intvl != "none" ) {
          timers.windows[winId].ts = n;
          timers.windows[winId].timer = createNewTimer(tab.windowId, null, intvl, 'win '+tab.windowId);
      }
    } else if (timers.windows[winId].scope == 'tab') {
      if ( timers.tabs[tab.id].intvl == intvl) return;
      // change the timer for current tab
      timers.tabs[tab.id].intvl = intvl;
      if ( null != timers.tabs[tab.id].timer ) {
          clearInterval(timers.tabs[tab.id].timer);
          timers.tabs[tab.id].timer = null;
      }
      if ( intvl != "none" ) {
          timers.tabs[tab.id].ts = n;
          timers.tabs[tab.id].timer = createNewTimer(tab.windowId, tab.id, intvl, 'tab '+tab.title);
      }
    }
}

async function setTimedReloadScope(tab,scope) {
/**
*    scope : win, gobal, tab
*    interval
*     when change in scope, remove prior intervals
*    timers.tabs, .windows
**/

    const winId = tab.windowId;
    if ( scope != timers.windows[winId].scope ) {
//        console.log('scope changed to '+scope);
        timers.windows[winId].scope = scope;
        if ( scope == 'window' ){ // changed to window
            // remove tab timers on the window
            const intvlCleared = await removeWinTimers(winId);
            const tTimersRm = intvlCleared.tabs.length;
            // can't redo timers - tabs have all diff ones
            if (tTimersRm > 0 ) 
              registration.showNotification('Reload scope changed to "window"', {
                body: 'The scope change removed '+tTimersRm+' tab timer'+(tTimersRm>1?"s":"")+' on the current window.',
                data: null,
                requireInteraction: true,
                icon: badgeSettings.iconReady.path[128],
                renotify : true,
                tag: "ReloadAllTabsExtension",
                actions: [
                  { action: 'Close', title: 'Close' }
                ]
              })
        } else { // changed to tabs - tabs will get win.intvl based timers
            const n = new Date().getTime();
            const tabIntvl = parseInt(timers.windows[winId].intvl);
            removeWinTimers(winId);
            if ( tabIntvl != null && tabIntvl != 'none' ) {
                // set new tab timers wt the win intvl
                for ( var i in timers.tabs ) {
                    if ( timers.tabs[i].windowId != winId ) continue;
                    timers.tabs[i].intvl = tabIntvl;
                    timers.tabs[i].ts = n;
//console.log("create new timer for "+timers.tabs[i].id+" in win "+tab.windowId)
                    timers.tabs[i].timer = createNewTimer(winId, timers.tabs[i].id, tabIntvl, 'tab '+timers.tabs[i].title);
                }
            }
        }
    }
}

async function removeWinTimers(winId,tabId) {
/**
*    remove all timers for a window
**/
  console.log('removeWinTimers '+winId+','+tabId)
    
	let intvlCleared = {win:null, tabs: []};
    if ( tabId ) {
      timers.tabs[tabId].intvl = 'none';
      timers.tabs[tabId].ts = null;
      if (null!=timers.tabs[tabId].timer){
          clearInterval(timers.tabs[tabId].timer);
          timers.tabs[tabId].timer = null;
          intvlCleared.tabs.push(timers.tabs[tabId].title);
          console.log('Cleared timer for tab '+tabId+' in win '+winId);
      }
    } else if ( winId ) {
      timers.windows[winId].intvl = 'none';
      timers.windows[winId].ts = null;
      if (null!=timers.windows[winId].timer){
          clearInterval(timers.windows[winId].timer);
          timers.windows[winId].timer = null;
          intvlCleared.win = true;
          console.log('cleared timer for Window '+winId);
      } 
      let tabsCount = 0;
      for ( var i in timers.tabs ) {
        if (timers.tabs[i].windowId != winId) continue; 
        tabsCount++
        timers.tabs[i].intvl = 'none';
        timers.tabs[i].ts = null;
        if (null!=timers.tabs[i].timer){
            clearInterval(timers.tabs[i].timer);
            timers.tabs[i].timer = null;
            intvlCleared.tabs.push(timers.tabs[i].title);
            console.log('cleared timer for tab '+i+' in win '+winId);
        }
      }
    }
    return intvlCleared;
}

async function removeAllTimers() {
/**
*    remove all timers for all windows
**/
    for (var i in timers.windows) {
      timers.windows[i].intvl = 'none';
      timers.windows[i].ts = null;
      if (null!=timers.windows[i].timer){
          clearInterval(timers.windows[i].timer);
          timers.windows[i].timer = null;
          console.log('cleared timer for '+winId);
      }
    }

    for ( var i in timers.tabs ) {
      timers.tabs[i].intvl = 'none';
      timers.tabs[i].ts = null;
      if (null!=timers.tabs[i].timer){
          clearInterval(timers.tabs[i].timer);
          timers.tabs[i].timer = null;
          console.log('cleared timer for tab '+i+' in win '+timers.tabs[i].windowId);
      }
    }
}
function createNewTimer(winId, tabId, intvl, msg) {    
    console.log('setting timer for win/tab '+winId+"/"+tabId+" - "+msg+', '+formatIntvl(intvl))

    return setInterval( 
        function (){
            doTimedReload(winId, tabId, msg);
        }, intvl*1000 );
}

async function doTimedReload(winId, tabId, msg) {

/**
 * called by the set interval.
 * reload that specific tab
 */
 
//    console.log('timed reload: win/tab/msg : '+winId+', '+tabId+', '+msg)
  const { bypassCache } = await getSetting(['bypassCache']);
  
  function doit(title,tabid,bypassCache,reloadCounter){    
    setTimeout(function(){
        chrome.tabs.reload(tabid, { bypassCache: bypassCache }, function(){
            console.log('Reloading '+title+' ('+tabid+'), '+(bypassCache?'cache bypassed':'')+' at '+new Date().toLocaleString());
        })
    }, reloadCounter*500);        
  }
  var n = new Date().getTime();
  if ( null!=tabId ) { // single tab
    timers.tabs[tabId].ts = n+1000;
    doit(timers.tabs[tabId].title, tabId, bypassCache, 0)
  } else { // all window tabs
    timers.windows[winId].ts = n+1000;
    chrome.tabs.query({ windowId: winId }, async (tabs) => {
      var reloadCounter = 0; // counter to stagger reloads
      for (const i in tabs) {
        var tab = tabs[i];
        doit(tab.title, tab.id, bypassCache, reloadCounter);
        reloadCounter++;
      }
    });
  }
}

function createWindowSettings(winId) {
/**
*     get settings from BGpage by winId
**/
  return {
    intvl: 'none',
    scope: 'window',
    ts: null,
    title : null,
    timer: null,
    enabled : false,
    id: winId
  };
}

function createTabSettings(winId,tabId) {
/**
*     get settings from BGpage by tabId
**/
    return {
      intvl: 'none',
      title : null,
      url : null,
      timer: null,
      id: tabId,
      windowId: winId
    };
//	if ( timers.tabs[tabId].windowId != winId )
//		timers.tabs[tabId].windowId = winId;
}

function buildTimerObject(cb){
	// called only at init
	console.log("populate timers obj")
  
  chrome.windows.getAll({populate:true, windowTypes:['normal']}, function(windows) {
       
    for ( var w=0; w<windows.length; w++ ){
        timers.windows[windows[w].id] = createWindowSettings(windows[w].id);

        for ( var t=0; t<windows[w].tabs.length; t++ ){
            timers.tabs[windows[w].tabs[t].id] = createTabSettings(windows[w].id, windows[w].tabs[t].id);
            timers.tabs[windows[w].tabs[t].id].title=windows[w].tabs[t].title; 
            timers.tabs[windows[w].tabs[t].id].url=windows[w].tabs[t].url;
            timers.tabs[windows[w].tabs[t].id].id=windows[w].tabs[t].id;
        }
    }

    if ( cb && typeof(cb)=="function" ){
      cb();
    }

  })
}

function formatIntvl(i) {
    
    return (i>=60?(i/60)+'min':i+'sec')
    
}
async function removeWinSetting(winId) {  
  if ( undefined == timers.windows[winId] ) return;
	if ( timers.windows[winId].timer != null ) {
		clearInterval(timers.windows[winId].timer);
	}
	delete timers.windows[winId];
}

async function removeTabSetting(tabId) {
  if ( undefined == timers.tabs[tabId] ) return;
	if ( timers.tabs[tabId].timer != null ) {
		clearInterval(timers.tabs[tabId].timer);
	}
	delete timers.tabs[tabId];
}

async function onWindowClosed(winId)
{
/**
 * called then a window is closed
 * if theres a window timer - kill it, then remove win object
*/
  if ( winId == -1 ) return;
	console.log("win closed")
  await removeWinSetting(winId);
}

function onWindowFocused(winId)
{
    chrome.tabs.query({
            "active":true,
            "windowType":"normal",
            "currentWindow":true}, 
            function (tabs) {
                if ( tabs.length == 0 || tabs[0].id == -1 ) return;
                onTabActivate({windowId: winId,tabId:tabs[0].id})
            }
    );
}

function onTabAttached(tabid, info)
{
/**
 * called then a tab is attached
 * 
*/
    if ( tabid == -1 ||  tabid == undefined ) return
    
    if ( timers.tabs[tabId].windowId != info.windowId )
      timers.tabs[tabId].windowId = info.windowId;


//console.log("attached")
//console.log(info) // if detached winId = -1
//console.log(timers)
}

function onTabDetached(tabid, info)
{
/**
 * called then a tab is detached
 * set the old winID on tab setting
*/
//console.log("detached")
//console.log(info) // if detached winId = -1
//console.log(timers)
}

async function onTabActivate(info)
{
/**
 * called then a tab is activated
 * 
*/
// info.tabId
// info.windowId
    
    if ( info.windowId == -1 || info.tabId == -1 ) return
    
	// get the curr tab and window
    chrome.tabs.get(info.tabId, function (tab){
      if (tab.status == "loading") return; 
      timers.tabs[tab.id].title=tab.title; 
      timers.tabs[tab.id].url=tab.url;
      timers.tabs[tab.id].id=tab.id;
      timers.tabs[tab.id].windowId=tab.windowId;

      updateContextMenu(tab, "tab activated"); 
//console.log("activated")
//console.log(info) // if detached winId = -1
//console.log(timers)
    });
}

function onTabUpdated(tabId, changeInfo, tab)
{ 
/**
 * called then a tab is opened
 * 
*/
//console.log("updated")
//console.log("tab "+tabId)
console.log(changeInfo)
//console.log(timers)
    if (changeInfo.status != "complete") return; 
    if ( tabId == -1 ) return;

      timers.tabs[tabId] = timers.tabs[tabId] || createTabSettings(tab.windowId, tab.id)
      timers.tabs[tabId].title=tab.title; 
      timers.tabs[tabId].url=tab.url;
 
      updateContextMenu(tab, "tab activated"); 
}

async function onTabRemoved(tabId, info)
{
/**
 * called then a tab is closed
 * if theres a tab timer - kill it; remove the tab object
*/
  if ( tabId == -1 ) return
  console.log("tab removed")

	// single tab closed
  await removeTabSetting(tabId);
}
  