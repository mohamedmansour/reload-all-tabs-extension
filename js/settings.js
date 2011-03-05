// Settings for reload all tabs.
settings = {
  get reloadAllWindows() {
    return localStorage['reload_all_windows'] === 'true';
  },
  set reloadAllWindows(val) {
    localStorage['reload_all_windows'] = val;
  },
  get shortcutKeyCode() {
    var key = localStorage['shortcut_key_code'];
    return (typeof key == 'undefined') ? 82 : key;
  },
  set shortcutKeyCode(val) {
    localStorage['shortcut_key_code'] = val;
  },
  get shortcutKeyAlt() {
    var key = localStorage['shortcut_key_alt'];
    return (typeof key == 'undefined') ? false : key === 'true';
  },
  set shortcutKeyAlt(val) {
    localStorage['shortcut_key_alt'] = val;
  },
  get shortcutKeyShift() {
    var key = localStorage['shortcut_key_shift'];
    return (typeof key == 'undefined') ? true : key === 'true';
  },
  set shortcutKeyShift(val) {
    localStorage['shortcut_key_shift'] = val;
  },
  get version() {
    return localStorage['version'];
  },
  set version(val) {
    localStorage['version'] = val;
  },
  get firstRun() {
    return localStorage['first_run'];
  },
  set firstRun(val) {
    localStorage['first_run'] = val;
  },
  get contextMenu() {
    var key = localStorage['context_menu'];
    return (typeof key == 'undefined') ? true : key === 'true';
  },
  set contextMenu(val) {
    localStorage['context_menu'] = val;
  }
};