/**
 * Unit tests for js/options/forms.js
 * Tests form setup utilities
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';
import { JSDOM } from 'jsdom';

// Install chrome mock
const chromeMock = installChromeMock();

// Setup minimal DOM with info-message element that flashMessage needs
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="info-message" data-visible="false"></div></body></html>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.HTMLElement = dom.window.HTMLElement;

// Import module under test
const { ensurePermissions, setupCheckbox, setupDropdown, setupTextarea } = await import('../../js/options/forms.js');

/**
 * Helper to setup the DOM with required elements for form controls
 * @param {string} html The inner HTML to add after info-message
 */
function setupDOM(html) {
  document.body.innerHTML = '<div id="info-message" data-visible="false"></div>' + html;
}

describe('ensurePermissions', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should return true when no permissions are required', async () => {
    const result = await ensurePermissions('nonExistentSetting', true);
    assert.equal(result, true);
  });

  it('should return true when setting is being disabled', async () => {
    const result = await ensurePermissions('reloadAllMatched', false);
    assert.equal(result, true);
  });

  it('should return true when setting is empty string', async () => {
    const result = await ensurePermissions('reloadAllMatched', '');
    assert.equal(result, true);
  });

  it('should return true when permissions are already granted', async () => {
    chromeMock._addPermission('tabs');
    const result = await ensurePermissions('reloadAllMatched', 'example.com');
    assert.equal(result, true);
  });

  it('should request permissions when not granted', async () => {
    const requestSpy = mock.fn(() => Promise.resolve(true));
    chromeMock.permissions.request = requestSpy;

    const result = await ensurePermissions('reloadAllMatched', 'example.com');

    assert.equal(requestSpy.mock.callCount(), 1);
    assert.equal(result, true);
  });

  it('should return false when permission request is denied', async () => {
    chromeMock.permissions.request = async () => false;
    chromeMock.permissions.contains = async () => false;

    const result = await ensurePermissions('reloadAllMatched', 'example.com');

    assert.equal(result, false);
  });

  it('should request tabs permission for reloadSkipMatched', async () => {
    const requestSpy = mock.fn(() => Promise.resolve(true));
    chromeMock.permissions.request = requestSpy;

    await ensurePermissions('reloadSkipMatched', 'example.com');

    assert.ok(requestSpy.mock.calls[0].arguments[0].permissions.includes('tabs'));
  });

  it('should request tabGroups permission for reloadGroupedOnly', async () => {
    const requestSpy = mock.fn(() => Promise.resolve(true));
    chromeMock.permissions.request = requestSpy;

    await ensurePermissions('reloadGroupedOnly', true);

    assert.ok(requestSpy.mock.calls[0].arguments[0].permissions.includes('tabGroups'));
  });
});

describe('setupCheckbox', () => {
  let checkbox;

  beforeEach(() => {
    resetChromeMock(chromeMock);
    setupDOM('<input type="checkbox" id="testCheckbox">');
    checkbox = document.getElementById('testCheckbox');
  });

  it('should set initial checked state from stored value', async () => {
    await setupCheckbox('testCheckbox', true);
    assert.equal(checkbox.checked, true);
  });

  it('should use default value when stored value is undefined', async () => {
    await setupCheckbox('testCheckbox', undefined, true);
    assert.equal(checkbox.checked, true);
  });

  it('should save default value to storage when not stored', async () => {
    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    await setupCheckbox('testCheckbox', undefined, true);

    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testCheckbox: true });
  });

  it('should save checked state on change', async () => {
    await setupCheckbox('testCheckbox', false);

    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change'));

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testCheckbox: true });
  });
});

describe('setupDropdown', () => {
  let dropdown;

  beforeEach(() => {
    resetChromeMock(chromeMock);
    setupDOM(`
      <select id="testDropdown">
        <option value="">Select</option>
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
      </select>
    `);
    dropdown = document.getElementById('testDropdown');
  });

  it('should set initial value from stored value', async () => {
    await setupDropdown('testDropdown', 'option1');
    assert.equal(dropdown.value, 'option1');
  });

  it('should use default value when stored value is undefined', async () => {
    await setupDropdown('testDropdown', undefined, 'option2');
    assert.equal(dropdown.value, 'option2');
  });

  it('should save default value to storage when not stored', async () => {
    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    await setupDropdown('testDropdown', undefined, 'option1');

    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testDropdown: 'option1' });
  });

  it('should save selected value on change', async () => {
    await setupDropdown('testDropdown', '');

    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    dropdown.value = 'option1';
    dropdown.dispatchEvent(new dom.window.Event('change'));

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testDropdown: 'option1' });
  });
});

describe('setupTextarea', () => {
  let textarea;

  beforeEach(() => {
    resetChromeMock(chromeMock);
    setupDOM('<textarea id="testTextarea"></textarea>');
    textarea = document.getElementById('testTextarea');
  });

  it('should set initial value from stored value', async () => {
    await setupTextarea('testTextarea', 'stored value');
    assert.equal(textarea.value, 'stored value');
  });

  it('should use default value when stored value is undefined', async () => {
    await setupTextarea('testTextarea', undefined, 'default value');
    assert.equal(textarea.value, 'default value');
  });

  it('should save default value to storage when not stored', async () => {
    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    await setupTextarea('testTextarea', undefined, 'default');

    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testTextarea: 'default' });
  });

  it('should debounce saves on input', async () => {
    await setupTextarea('testTextarea', '');

    const setSpy = mock.fn(() => Promise.resolve());
    chromeMock.storage.sync.set = setSpy;

    // Rapid input changes
    textarea.value = 'a';
    textarea.dispatchEvent(new dom.window.Event('input'));
    textarea.value = 'ab';
    textarea.dispatchEvent(new dom.window.Event('input'));
    textarea.value = 'abc';
    textarea.dispatchEvent(new dom.window.Event('input'));

    // Should not save immediately
    assert.equal(setSpy.mock.callCount(), 0);

    // Wait for debounce (300ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 400));

    // Should save only once with final value
    assert.equal(setSpy.mock.callCount(), 1);
    assert.deepEqual(setSpy.mock.calls[0].arguments[0], { testTextarea: 'abc' });
  });
});
