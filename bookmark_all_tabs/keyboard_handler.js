// Mohamed Mansour 2009 (hello@mohamedmansour.com)


// Add a keyboard listener on keyup.
if (window == top) {
  window.addEventListener('keyup', keyListener, false);
}

// Keyboard keyup listener callback.
function keyListener(e) {	
 if (e.ctrlKey && e.shiftKey && e.which == 68) {
    console.log("Pressed button After");
    var folderName = prompt("Please enter a folder name", "My bookmarks");
    if (folderName) {
      // Notify the extension that we want to bookmark all tabs.
      var port = chrome.extension.connect({name: "BookmarkAllTabs"});
      port.postMessage(folderName);
    }
  }
}
