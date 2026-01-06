/**
 * Shared URL pattern matching utilities
 */

/**
 * Escape special regex characters in a string
 * @param {string} value String to escape
 * @returns {string} Escaped string
 */
const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Check if a URL matches a pattern
 * Supports wildcard (*) matching and simple substring matching
 * 
 * Examples:
 *   - "example.com" matches any URL containing "example.com"
 *   - "*.example.com/*" matches URLs like "https://sub.example.com/page"
 *   - "https://example.com/app/*" matches URLs starting with that path
 * 
 * @param {string} url The URL to check
 * @param {string} pattern The pattern to match against
 * @returns {boolean} Whether the URL matches the pattern
 */
export const matchesPattern = (url, pattern) => {
  if (!pattern || !url) {
    return false;
  }

  const normalizedPattern = pattern.trim().toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (!normalizedPattern) {
    return false;
  }

  // If pattern contains wildcards, use regex matching
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp(`^${normalizedPattern.split('*').map(escapeForRegex).join('.*')}$`);
    return regex.test(normalizedUrl);
  }

  // Otherwise, simple substring matching
  return normalizedUrl.includes(normalizedPattern);
};

/**
 * Check if a URL matches any pattern in a comma-separated list
 * @param {string} url The URL to check
 * @param {string} patternList Comma-separated list of patterns
 * @returns {boolean} Whether the URL matches any pattern
 */
export const matchesAnyPattern = (url, patternList) => {
  if (!patternList || !url) {
    return false;
  }

  return patternList
    .split(',')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0)
    .some(pattern => matchesPattern(url, pattern));
};
