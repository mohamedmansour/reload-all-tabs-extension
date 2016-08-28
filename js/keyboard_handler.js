 "use strict";

(() => {
  if (window == top) {
    window.addEventListener('load', e => {
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
