/**
 * Shared storage utilities
 */

/**
 * Get settings from storage with proper defaults
 * @param {string[]} keys Settings keys to fetch
 * @returns {Promise<Object>} Settings object
 */
export const getSetting = async (keys) => {
  const values = await chrome.storage.sync.get(keys);
  const results = {};

  for (const key of keys) {
    switch (key) {
      case 'buttonDefaultAction':
        results[key] = values[key] ?? 'window';
        break;
      case 'reloadWindow':
        results[key] = values[key] === undefined ? true : values[key] === true;
        break;
      case 'reloadAllMatched':
      case 'reloadSkipMatched':
      case 'skipMatchedTabs':
      case 'version':
        results[key] = values[key];
        break;
      case 'reloadDelay':
        results[key] = parseInt(values[key] ?? '0', 10);
        break;
      case 'reloadAllWindows':
      case 'reloadPinnedOnly':
      case 'reloadUnpinnedOnly':
      case 'reloadGroupedOnly':
      case 'reloadAllRight':
      case 'reloadAllLeft':
      case 'bypassCache':
      case 'excludeActiveTab':
      case 'excludeAudioTabs':
        results[key] = values[key] === true;
        break;
      case 'scheduledJobs':
        results[key] = Array.isArray(values[key]) ? values[key] : [];
        break;
      default:
        results[key] = undefined;
        break;
    }
  }

  return results;
};
