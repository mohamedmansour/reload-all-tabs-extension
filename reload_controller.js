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
          case 'reloadStartup':
            result = (typeof value == 'undefined') ? 'none' : value
            break
          case 'reloadAllWindows':
          case 'reloadPinnedOnly':
          case 'reloadUnpinnedOnly':
          case 'reloadAllRight':
          case 'reloadAllLeft':
          case 'closeAllRight':
          case 'closeAllLeft':
          case 'bypassCache':
          case 'enableTimedReloads':
            result = value == true
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
  chrome.windows.onCreated.addListener(async (win) => onStartup(win))
  chrome.commands.onCommand.addListener(async () => await reload());
  
  chrome.contextMenus.onClicked.addListener((info) => onMenuClicked(info))  

  await createContextMenu()

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

  const badgeSettings = {
      badge : {color: "#006633"},
      badgeOff : {text: ""},

      iconReady : {path: {'16': "img/icon16r.png", '48': "img/icon48r.png", '128': "img/icon128r.png"}},
      iconOn : {path: {'16': "img/icon16t.png", '48': "img/icon48t.png", '128': "img/icon128t.png"}},
      iconOff : {path: {'16': "img/icon16.png", '48': "img/icon48.png", '128': "img/icon128.png"}},

      iconDefault : badgeSettings.iconOff
  };
	
	let badgeUpdateTimer = null; // FIX badge update timer
//  this.init(); // FIX init call

}


async function onStorageChanged(changes) {
	
  for (key in changes) {
    if (key.startsWith('enable') || key.startsWith('reload') || key == 'bypassCache' || key.startsWith('close')) {
    // if we're disabling timed reloads in options - remove all timers
      if ( key == 'enableTimedReloads') {
        if ( changes[key].newValue == false ) this.removeAllTimers(); // FIX remove all timers
      }
      await createContextMenu()
    }
  }
}

function onMenuClicked(info) {
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
  this.createContextMenu(tab,'onMenuClicked - '+info.menuItemId);
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
      chrome.windows.getCurrent((win) => this.reloadWindow(win))
      break
  }
}

/**
 * Do onStartup actions
 */
async function onStartup(win) {
  const { reloadStartup } = await getSetting(['reloadStartup'])
  console.log(`onStartup: ${reloadStartup}`)
  switch (reloadStartup) {
    case 'all':
      reloadWindow(win)
      break
    case 'pinned':
      reloadWindow(win, { reloadPinnedOnly: true })
      break
    case 'unpinned':
      reloadWindow(win, { reloadUnpinnedOnly: true })
      break
    default:
      break
  }
}

/**
 * Handles the request coming back from an external extension.
 */
async function createContextMenu() {
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
    'closeAllRight'
  ])

  let attributions = ''
  if (setting.bypassCache) {
    attributions = ' (cache bypassed)'
  }

  if (setting.reloadWindow) {
    chrome.contextMenus.create({
      id: 'reloadWindow',
      type: 'normal',
      title: `Reload this window${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadAllWindows) {
    chrome.contextMenus.create({
      id: 'reloadAllWindows',
      type: 'normal',
      title: `Reload all windows${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadPinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadPinnedOnly',
      type: 'normal',
      title: `Reload pinned tabs${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadUnpinnedOnly) {
    chrome.contextMenus.create({
      id: 'reloadUnpinnedOnly',
      type: 'normal',
      title: `Reload unpinned tabs${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadAllLeft) {
    chrome.contextMenus.create({
      id: 'reloadAllLeft',
      type: 'normal',
      title: `Reload all tabs to the left${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadAllRight) {
    chrome.contextMenus.create({
      id: 'reloadAllRight',
      type: 'normal',
      title: `Reload all tabs to the right${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.closeAllLeft) {
    chrome.contextMenus.create({
      id: 'closeAllLeft',
      type: 'normal',
      title: `Close all tabs to the left${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.closeAllRight) {
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
function reloadWindow(win, options = {}) {
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
