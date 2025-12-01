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
          case 'reloadAllMatched':
            result = value;
            break;
          case 'reloadAllWindows':
          case 'reloadPinnedOnly':
          case 'reloadUnpinnedOnly':
          case 'reloadGroupedOnly':
          case 'reloadAllRight':
          case 'reloadAllLeft':
          case 'closeAllRight':
          case 'closeAllLeft':
          case 'bypassCache':
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
  chrome.commands.onCommand.addListener(async () => await reload());

  await updateContextMenu()

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
}

async function onStorageChanged(changes) {
  for (key in changes) {
    if (key.startsWith('reload') || key == 'bypassCache' || key.startsWith('close')) {
      await updateContextMenu()
    }
  }
}

function onMenuClicked(info) {
  const { parentMenuItemId, menuItemId } = info;
  const itemId = parentMenuItemId || menuItemId;
  switch (itemId) {
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
    case 'reloadAllMatched':
      chrome.windows.getCurrent((win) => reloadWindow(win, { reloadAllMatched: true }))
      break
    case 'reloadGroupedOnly':
      chrome.windows.getCurrent((win) => reloadGroupedTabs(win.id, +menuItemId))
      break
    case 'closeAllLeft':
      chrome.windows.getCurrent((win) => closeWindow(win, { closeAllLeft: true }))
      break
    case 'closeAllRight':
      chrome.windows.getCurrent((win) => closeWindow(win, { closeAllRight: true }))
      break
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
      chrome.windows.getCurrent((win) => this.reloadWindow(win))
      break
  }
}


/**
 * Handles the request coming back from an external extension.
 */
async function updateContextMenu() {
  chrome.contextMenus.removeAll()

  chrome.contextMenus.onClicked.addListener((info) => onMenuClicked(info))

  const setting = await getSetting([
    'bypassCache',
    'reloadWindow',
    'reloadAllWindows',
    'reloadPinnedOnly',
    'reloadUnpinnedOnly',
    'reloadAllLeft',
    'reloadAllRight',
    'reloadAllMatched',
    'reloadGroupedOnly',
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

  if (setting.reloadAllMatched) {
    chrome.contextMenus.create({
      id: 'reloadAllMatched',
      type: 'normal',
      title: `Reload all tabs with matched urls${attributions}`,
      contexts: ['all']
    })
  }

  if (setting.reloadGroupedOnly) {
    chrome.contextMenus.create({
      id: 'reloadGroupedOnly',
      type: 'normal',
      title: `Reload all grouped tabs${attributions}`,
      contexts: ['all']
    })
    const { id: windowId } = await chrome.windows.getCurrent();
    const tabGroups = await chrome.tabGroups.query({ windowId });
    for (const i in tabGroups) {
      const tabGroup = tabGroups[i];
      chrome.contextMenus.create({
        id: `${tabGroup.id}`,
        parentId: 'reloadGroupedOnly',
        type: 'normal',
        title: `${tabGroup.title} (${tabGroup.color})`,
        contexts: ['all']
      })
    }
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
    for (const i in tabs) {
      const tab = tabs[i]
      await reloadStrategy(tab, strategy, options)
    }
  })
}

// When this gets complicated, create a strategy pattern.
async function reloadStrategy(tab, strategy, options = {}) {
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

  if (options.reloadAllMatched) {
    const { reloadAllMatched: urlString } = await getSetting(['reloadAllMatched']);
    const isUrlMatched = urlString.split(',').map(url => url.trim()).some(url => tab.url.startsWith(url));
    if(!isUrlMatched) {
      issueReload = false;
    }
  }

  if (issueReload) {
    const { bypassCache } = await getSetting(['bypassCache'])
    console.log(`reloading ${tab.url}, cache bypassed: ${bypassCache}`)
    chrome.tabs.reload(tab.id, { bypassCache }, null)
  }
}

/**
 * Reload grouped tabs.
 *
 * @param win Window to reload.
 * @param groupId tab group to reload
 */

async function reloadGroupedTabs(windowId, groupId) {
  const tabs = await chrome.tabs.query({ windowId, groupId });
  const { bypassCache } = await getSetting(['bypassCache']);
  for (const i in tabs) {
    const tab = tabs[i]
    chrome.tabs.reload(tab.id, { bypassCache }, null)
  }
}

/**
 * Reload all tabs in all windows one by one.
 */
function reloadAllWindows() {
  chrome.windows.getAll({}, (windows) => {
    for (const i in windows) {
      reloadWindow(windows[i])
    }
  })
}

try {
  init()
}
catch (e) {
  console.error(e)
}
