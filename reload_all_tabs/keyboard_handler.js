// Copyright under GPL, Mohamed Mansour 2009 (http://mohamedmansour.com)

// Add a keyboard listener on keyup.
if (window == top) {
  window.addEventListener("keyup", keyListener, false);
}

// Keyboard keyup listener callback.
function keyListener(e) {
  // Must press ctrl key to validate.
  if (e.ctrlKey && e.keyCode && !e.metaKey && e.keyCode != 16 && e.keyCode != 17 && e.keyCode != 18) {
    chrome.extension.sendRequest({
      code: e.keyCode,
      alt: e.altKey,
      shift: e.shiftKey
    });
  }
}
