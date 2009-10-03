// Mohamed Mansour 2009 (hello@mohamedmansour.com)

// Add a keyboard listener on keyup.
if (window == top) {
  window.addEventListener('keyup', keyListener, false);
}

// Keyboard keyup listener callback.
function keyListener(e) {
  // CTRL + SHIFT + R
  if (e.ctrlKey && e.shiftKey && e.which == 82) {
    console.log("KeyInputed");
    var port = chrome.extension.connect({name: "ReloadAllTabs"});
    port.postMessage(true);
  }
}
