/**
 * Unit tests for js/shared/matching.js
 * Tests URL pattern matching utilities using parameterized test cases
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPattern, matchesAnyPattern } from '../../js/shared/matching.js';

// ============================================================================
// Test Case Definitions (Data-Driven / Parameterized)
// ============================================================================

/**
 * @typedef {Object} MatchPatternTestCase
 * @property {string} name - Test case description
 * @property {*} url - URL to test
 * @property {*} pattern - Pattern to match against
 * @property {boolean} expected - Expected result
 */

/** @type {MatchPatternTestCase[]} */
const MATCHES_PATTERN_CASES = [
  // Edge cases - null/undefined/empty
  { name: 'null url', url: null, pattern: 'example.com', expected: false },
  { name: 'undefined url', url: undefined, pattern: 'example.com', expected: false },
  { name: 'null pattern', url: 'https://example.com', pattern: null, expected: false },
  { name: 'undefined pattern', url: 'https://example.com', pattern: undefined, expected: false },
  { name: 'empty url', url: '', pattern: 'example.com', expected: false },
  { name: 'empty pattern', url: 'https://example.com', pattern: '', expected: false },
  { name: 'whitespace-only pattern', url: 'https://example.com', pattern: '   ', expected: false },

  // Substring matching (no wildcards)
  { name: 'URL contains pattern', url: 'https://example.com/page', pattern: 'example.com', expected: true },
  { name: 'partial domain match', url: 'https://sub.example.com/page', pattern: 'example', expected: true },
  { name: 'path segment match', url: 'https://example.com/app/dashboard', pattern: '/app/', expected: true },
  { name: 'case-insensitive (uppercase URL)', url: 'https://EXAMPLE.COM/page', pattern: 'example.com', expected: true },
  { name: 'case-insensitive (uppercase pattern)', url: 'https://example.com/page', pattern: 'EXAMPLE.COM', expected: true },
  { name: 'no match - different domain', url: 'https://example.com/page', pattern: 'google.com', expected: false },
  { name: 'trims whitespace from pattern', url: 'https://example.com/page', pattern: '  example.com  ', expected: true },

  // Wildcard matching
  { name: 'single wildcard matches domain', url: 'https://example.com/page', pattern: 'https://*.com/page', expected: true },
  { name: 'wildcard prefix for subdomain', url: 'https://sub.example.com/page', pattern: '*example.com*', expected: true },
  { name: 'wildcard suffix for path', url: 'https://example.com/app/dashboard', pattern: 'https://example.com/app/*', expected: true },
  { name: 'wildcards around domain', url: 'https://api.github.com/users/test', pattern: '*github.com*', expected: true },
  { name: 'complex wildcard pattern', url: 'https://sub.example.com/app/page', pattern: '*://*.example.com/*/page', expected: true },
  { name: 'wildcard pattern no match', url: 'https://example.com/page', pattern: 'https://google.com/*', expected: false },
  { name: 'multiple wildcards with deep nesting', url: 'https://a.b.c.example.com/x/y/z', pattern: '*example.com*', expected: true },
  { name: 'escapes regex special chars', url: 'https://example.com/path?query=1', pattern: '*example.com/path?query=*', expected: true },
  { name: 'wildcard at URL start', url: 'https://example.com', pattern: '*//*', expected: true },

  // Real-world patterns
  { name: 'GitHub repo', url: 'https://github.com/user/repo', pattern: '*github.com*', expected: true },
  { name: 'GitHub user path', url: 'https://github.com/user/repo/issues', pattern: '*github.com/user/*', expected: true },
  { name: 'Google Mail', url: 'https://mail.google.com/mail/u/0/', pattern: '*google.com*', expected: true },
  { name: 'Google Docs', url: 'https://docs.google.com/document/d/123', pattern: '*docs.google.com*', expected: true },
  { name: 'localhost with port (substring)', url: 'http://localhost:3000/api', pattern: 'localhost:3000', expected: true },
  { name: 'localhost with wildcard', url: 'http://localhost:8080/app', pattern: '*localhost*', expected: true },
  { name: 'file URL', url: 'file:///C:/Users/test/file.html', pattern: 'file://*', expected: true },
];

/**
 * @typedef {Object} MatchAnyPatternTestCase
 * @property {string} name - Test case description
 * @property {*} url - URL to test
 * @property {*} patternList - Comma-separated pattern list
 * @property {boolean} expected - Expected result
 */

/** @type {MatchAnyPatternTestCase[]} */
const MATCHES_ANY_PATTERN_CASES = [
  // Edge cases
  { name: 'null url', url: null, patternList: 'example.com, google.com', expected: false },
  { name: 'undefined url', url: undefined, patternList: 'example.com, google.com', expected: false },
  { name: 'null patternList', url: 'https://example.com', patternList: null, expected: false },
  { name: 'undefined patternList', url: 'https://example.com', patternList: undefined, expected: false },
  { name: 'empty patternList', url: 'https://example.com', patternList: '', expected: false },
  { name: 'only commas', url: 'https://example.com', patternList: ',,,', expected: false },
  { name: 'whitespace entries', url: 'https://example.com', patternList: '  ,  ,  ', expected: false },

  // Single pattern
  { name: 'single pattern match', url: 'https://example.com', patternList: 'example.com', expected: true },
  { name: 'single pattern no match', url: 'https://example.com', patternList: 'google.com', expected: false },

  // Multiple patterns
  { name: 'matches first pattern', url: 'https://example.com', patternList: 'example.com, google.com', expected: true },
  { name: 'matches second pattern', url: 'https://google.com', patternList: 'example.com, google.com', expected: true },
  { name: 'matches middle of list', url: 'https://twitter.com/home', patternList: 'facebook.com, twitter.com, instagram.com, linkedin.com', expected: true },
  { name: 'no match in list', url: 'https://example.com', patternList: 'facebook.com, twitter.com, instagram.com', expected: false },
  { name: 'mixed wildcard and substring', url: 'https://github.com/user/repo', patternList: 'example.com, *github.com/*, google.com', expected: true },
  { name: 'trims whitespace around patterns', url: 'https://example.com', patternList: '  example.com  ,  google.com  ', expected: true },
  { name: 'ignores empty patterns', url: 'https://example.com', patternList: 'google.com,,example.com,', expected: true },

  // Real-world pattern lists
  { name: 'social media - Facebook', url: 'https://www.facebook.com/profile', patternList: '*facebook.com*, *twitter.com*, *instagram.com*, *linkedin.com*', expected: true },
  { name: 'social media - Twitter', url: 'https://mobile.twitter.com/home', patternList: '*facebook.com*, *twitter.com*, *instagram.com*, *linkedin.com*', expected: true },
  { name: 'social media - no match', url: 'https://example.com', patternList: '*facebook.com*, *twitter.com*, *instagram.com*, *linkedin.com*', expected: false },
  { name: 'dev URLs - localhost', url: 'http://localhost:3000/', patternList: 'localhost, 127.0.0.1, *.local, *:3000*, *:8080*', expected: true },
  { name: 'dev URLs - 127.0.0.1', url: 'http://127.0.0.1:8080/api', patternList: 'localhost, 127.0.0.1, *.local, *:3000*, *:8080*', expected: true },
  { name: 'dev URLs - .local domain', url: 'http://myapp.local/dashboard', patternList: '.local', expected: true },
  { name: 'dev URLs - production no match', url: 'https://production.com', patternList: 'localhost, 127.0.0.1, *.local, *:3000*, *:8080*', expected: false },
];

// ============================================================================
// Parameterized Test Execution
// ============================================================================

describe('matchesPattern', () => {
  for (const { name, url, pattern, expected } of MATCHES_PATTERN_CASES) {
    it(`${name}: matchesPattern(${JSON.stringify(url)}, ${JSON.stringify(pattern)}) === ${expected}`, () => {
      assert.equal(matchesPattern(url, pattern), expected);
    });
  }
});

describe('matchesAnyPattern', () => {
  for (const { name, url, patternList, expected } of MATCHES_ANY_PATTERN_CASES) {
    const shortPatternList = patternList?.length > 40
      ? `${patternList.slice(0, 37)}...`
      : patternList;
    it(`${name}: matchesAnyPattern(${JSON.stringify(url)}, ${JSON.stringify(shortPatternList)}) === ${expected}`, () => {
      assert.equal(matchesAnyPattern(url, patternList), expected);
    });
  }
});
