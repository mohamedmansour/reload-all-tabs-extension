/**
 * Chrome API mock for testing
 * Provides a mock implementation of the chrome.* APIs used by the extension
 */

/**
 * Create a fresh mock of the Chrome API
 * @returns {Object} Mock chrome object
 */
export function createChromeMock() {
  const storage = new Map();
  const permissions = new Set(['storage', 'contextMenus']);

  const mock = {
    storage: {
      sync: {
        get: async (keys) => {
          const result = {};
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            if (storage.has(key)) {
              result[key] = storage.get(key);
            }
          }
          return result;
        },
        set: async (items) => {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, value);
          }
        },
        clear: async () => {
          storage.clear();
        }
      },
      onChanged: {
        addListener: () => { },
        removeListener: () => { }
      }
    },

    permissions: {
      contains: async ({ permissions: perms }) => {
        return perms.every(p => permissions.has(p));
      },
      request: async ({ permissions: perms }) => {
        perms.forEach(p => permissions.add(p));
        return true;
      },
      onAdded: {
        addListener: () => { }
      }
    },

    tabs: {
      query: async () => [],
      reload: async () => { },
      create: async () => ({})
    },

    windows: {
      getAll: async () => [],
      getCurrent: (callback) => {
        if (typeof callback === 'function') {
          callback({ id: 1 });
        } else {
          return Promise.resolve({ id: 1 });
        }
      }
    },

    contextMenus: {
      create: () => { },
      removeAll: async () => { },
      onClicked: {
        addListener: () => { }
      }
    },

    commands: {
      getAll: async () => [],
      onCommand: {
        addListener: () => { }
      }
    },

    action: {
      onClicked: {
        addListener: () => { }
      }
    },

    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage: () => { },
      lastError: null
    },

    alarms: {
      create: () => { },
      clear: async () => true,
      getAll: async () => [],
      onAlarm: {
        addListener: () => { }
      }
    },

    tabGroups: {
      query: async () => [],
      onCreated: { addListener: () => { } },
      onRemoved: { addListener: () => { } },
      onUpdated: { addListener: () => { } }
    },

    // Test helpers - use getter to always return current map reference
    get _storage() { return storage; },
    _permissions: permissions,
    _addPermission: (perm) => permissions.add(perm),
    _removePermission: (perm) => permissions.delete(perm),
    _setStorage: (key, value) => storage.set(key, value),
    _getStorage: (key) => storage.get(key),
    _clearStorage: () => storage.clear()
  };

  return mock;
}

/**
 * Install the chrome mock globally
 * @returns {Object} The mock chrome object
 */
export function installChromeMock() {
  const mock = createChromeMock();
  globalThis.chrome = mock;
  return mock;
}

/**
 * Reset the chrome mock to initial state
 * @param {Object} mock The mock to reset
 */
export function resetChromeMock(mock) {
  mock._clearStorage();
  mock._permissions.clear();
  mock._permissions.add('storage');
  mock._permissions.add('contextMenus');
}
