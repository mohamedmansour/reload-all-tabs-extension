/**
 * Unit tests for js/background/index.js
 * Tests startup behaviour
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the exported function (init() runs on import but is safe with the mock)
const { onStartup } = await import('../../js/background/index.js');

describe('onStartup', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should reload all windows when reloadOnStartup is enabled', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }, { id: 2 }];
    chromeMock.tabs.query = async ({ windowId }) => {
      if (windowId === 1) return [{ id: 1, url: 'https://a.com' }];
      if (windowId === 2) return [{ id: 2, url: 'https://b.com' }];
      return [];
    };
    chromeMock._setStorage('reloadOnStartup', true);

    await onStartup();

    assert.equal(reloadSpy.mock.callCount(), 2);
  });

  it('should not reload any tabs when reloadOnStartup is disabled', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }];
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://a.com' }];
    // reloadOnStartup defaults to false

    await onStartup();

    assert.equal(reloadSpy.mock.callCount(), 0);
  });

  it('should not reload any tabs when reloadOnStartup is explicitly false', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.windows.getAll = async () => [{ id: 1 }];
    chromeMock.tabs.query = async () => [{ id: 1, url: 'https://a.com' }];
    chromeMock._setStorage('reloadOnStartup', false);

    await onStartup();

    assert.equal(reloadSpy.mock.callCount(), 0);
  });
});
