# Copilot Instructions

## Project Overview

Chrome extension (Manifest V3) that reloads browser tabs via keyboard shortcut, context menu, toolbar button, or scheduled jobs. Uses ES modules throughout with no build step — source JS runs directly in the browser.

## Commands

```bash
pnpm test                # Run all tests (Node.js built-in test runner)
pnpm test:watch          # Run tests in watch mode
pnpm test:coverage       # Run tests with coverage
node --test test/background/reload.test.js   # Run a single test file
```

No build or lint step exists.

## Architecture

The codebase is split into three layers that mirror the extension's runtime contexts:

- **`js/background/`** — Service worker (`index.js` is the entry point). Handles tab reloading (`reload.js`), context menu construction (`context-menu.js`), and scheduled job execution (`scheduler.js`).
- **`js/options/`** — Options page UI. `dom.js` provides a `$()` helper for `getElementById`, `forms.js` binds form controls to `chrome.storage.sync`, and `jobs.js` manages the scheduled-jobs UI.
- **`js/shared/`** — Utilities imported by both background and options: `storage.js` (settings with typed defaults), `permissions.js` (optional permission helpers), and `matching.js` (URL pattern matching with wildcard support).

Settings are stored in `chrome.storage.sync`. The `getSetting()` function in `js/shared/storage.js` is the single source of truth for setting keys, default values, and type coercion — add new settings there.

## Testing Conventions

Tests use **Node.js built-in test runner** (`node:test`) with `node:assert/strict`. No external test framework.

A custom Chrome API mock lives in `test/mocks/chrome.js`. Tests follow this pattern:

```js
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';
const chromeMock = installChromeMock();          // Install before importing module under test
const { fn } = await import('../../js/module.js'); // Dynamic import so module sees the mock

describe('fn', () => {
  beforeEach(() => resetChromeMock(chromeMock));  // Reset state between tests
  // ...
});
```

Key points:
- `installChromeMock()` must be called **before** the dynamic `import()` of the module under test, so the module binds to the mock `chrome` global.
- Use `chromeMock._setStorage(key, value)` to seed settings and `chromeMock._addPermission(name)` to grant optional permissions in tests.
- Test files mirror source structure: `test/background/reload.test.js` tests `js/background/reload.js`.

## Key Patterns

- **Optional permissions**: Features like tab groups, alarms, and URL matching require runtime permissions (`tabs`, `tabGroups`, `alarms`). Always check with `hasPermission()` before using guarded APIs. The `PERMISSION_REQUIREMENTS` map in `js/shared/permissions.js` documents which settings need which permissions.
- **URL pattern matching**: `matchesAnyPattern(url, patternList)` takes a comma-separated string of patterns supporting `*` wildcards and substring matching.
- **Reload strategies**: `reloadWindow()` in `reload.js` applies a chain of filters (pinned, active, audible, left/right, matched/skipped) before reloading each tab. New filters should follow the existing pattern of checking a setting and conditionally setting `issueReload = false`.
