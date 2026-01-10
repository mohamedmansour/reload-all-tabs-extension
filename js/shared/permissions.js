/**
 * Shared permission utilities
 */

/**
 * Check if extension has a specific permission
 * @param {string} permission Permission name
 * @returns {Promise<boolean>} Whether permission is granted
 */
export const hasPermission = async (permission) => {
  return chrome.permissions.contains({ permissions: [permission] });
};

/**
 * Check if extension has all specified permissions
 * @param {string[]} permissions Permission names
 * @returns {Promise<boolean>} Whether all permissions are granted
 */
export const hasPermissions = async (permissions) => {
  return chrome.permissions.contains({ permissions });
};

/**
 * Request permissions from the user
 * @param {string[]} permissions Permission names
 * @returns {Promise<boolean>} Whether permissions were granted
 */
export const requestPermissions = async (permissions) => {
  return chrome.permissions.request({ permissions });
};

/**
 * Map of settings to their required permissions
 */
export const PERMISSION_REQUIREMENTS = {
  reloadGroupedOnly: ['tabGroups'],
  reloadAllMatched: ['tabs'],
  reloadSkipMatched: ['tabs'],
  skipMatchedTabs: ['tabs'],
};
