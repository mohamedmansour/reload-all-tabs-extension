 "use strict";

(() => {
  if (!window.reloadTabsExtensionLoaded && window == top) {
    window.reloadTabsExtensionLoaded = true
    console.log('Reload All Tabs keyboard handler loaded in this tab. Visit this extensions option, to disable.')
    window.addEventListener('keyup', e => {
      if (e.ctrlKey && e.keyCode && !e.metaKey && e.keyCode != 16 && e.keyCode != 17 && e.keyCode != 18) {
        chrome.extension.sendMessage({
          code: e.keyCode,
          alt: e.altKey,
          shift: e.shiftKey
        })
      }
    }, false)
  }
})()
