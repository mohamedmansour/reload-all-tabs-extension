// Copyright under GPL, Mohamed Mansour 2009 (http://mohamedmansour.com)

// Add a keyboard listener on keyup.
if (window == top) {
  window.addEventListener('keyup', keyListener, false);
}

// Keyboard keyup listener callback.
function keyListener(e) {
  // Ctrl + Shift + R
  if (e.ctrlKey && e.shiftKey && e.which == 82) {
    var port = chrome.extension.connect({name: "ReloadAllTabs"});
    port.postMessage(true);
  }
}
