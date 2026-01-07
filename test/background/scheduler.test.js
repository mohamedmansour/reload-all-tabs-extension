/**
 * Unit tests for js/background/scheduler.js
 * Tests job scheduling utilities
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock, resetChromeMock } from '../mocks/chrome.js';

// Install mock before importing the module under test
const chromeMock = installChromeMock();

// Now import the module (it will use our mock)
const {
  isJobAlarm,
  getJobIdFromAlarm,
  scheduleAllJobs,
  setAllJobsEnabled,
  toggleJobEnabled,
  executeScheduledJob
} = await import('../../js/background/scheduler.js');

describe('isJobAlarm', () => {
  it('should return true for valid job alarm names', () => {
    assert.equal(isJobAlarm('reload-job:123'), true);
    assert.equal(isJobAlarm('reload-job:abc-def'), true);
    assert.equal(isJobAlarm('reload-job:'), true);
  });

  it('should return false for non-job alarm names', () => {
    assert.equal(isJobAlarm('other-alarm'), false);
    assert.equal(isJobAlarm('job:123'), false);
    assert.equal(isJobAlarm(''), false);
  });

  it('should return false for non-string values', () => {
    assert.equal(isJobAlarm(null), false);
    assert.equal(isJobAlarm(undefined), false);
    assert.equal(isJobAlarm(123), false);
    assert.equal(isJobAlarm({}), false);
  });
});

describe('getJobIdFromAlarm', () => {
  it('should extract job ID from alarm name', () => {
    assert.equal(getJobIdFromAlarm('reload-job:123'), '123');
    assert.equal(getJobIdFromAlarm('reload-job:abc-def-ghi'), 'abc-def-ghi');
  });

  it('should return empty string for prefix-only alarm name', () => {
    assert.equal(getJobIdFromAlarm('reload-job:'), '');
  });

  it('should handle UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    assert.equal(getJobIdFromAlarm(`reload-job:${uuid}`), uuid);
  });
});

describe('scheduleAllJobs', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should not schedule if alarms permission is not granted', async () => {
    const createSpy = mock.fn();
    chromeMock.alarms.create = createSpy;

    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', intervalMinutes: 5, enabled: true }
    ]);

    await scheduleAllJobs();

    assert.equal(createSpy.mock.callCount(), 0);
  });

  it('should schedule enabled jobs when alarms permission is granted', async () => {
    chromeMock._addPermission('alarms');

    const createSpy = mock.fn();
    chromeMock.alarms.create = createSpy;
    chromeMock.alarms.getAll = async () => [];

    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', intervalMinutes: 5, enabled: true }
    ]);

    await scheduleAllJobs();

    assert.equal(createSpy.mock.callCount(), 1);
    assert.equal(createSpy.mock.calls[0].arguments[0], 'reload-job:1');
  });

  it('should not schedule disabled jobs', async () => {
    chromeMock._addPermission('alarms');

    const createSpy = mock.fn();
    chromeMock.alarms.create = createSpy;
    chromeMock.alarms.getAll = async () => [];

    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', intervalMinutes: 5, enabled: false }
    ]);

    await scheduleAllJobs();

    assert.equal(createSpy.mock.callCount(), 0);
  });

  it('should skip jobs without id or domain', async () => {
    chromeMock._addPermission('alarms');

    const createSpy = mock.fn();
    chromeMock.alarms.create = createSpy;
    chromeMock.alarms.getAll = async () => [];

    chromeMock._setStorage('scheduledJobs', [
      { id: '1', intervalMinutes: 5 }, // missing domain
      { domain: 'example.com', intervalMinutes: 5 }, // missing id
      { id: '3', domain: 'valid.com', intervalMinutes: 5 } // valid
    ]);

    await scheduleAllJobs();

    assert.equal(createSpy.mock.callCount(), 1);
  });

  it('should skip jobs with invalid interval', async () => {
    chromeMock._addPermission('alarms');

    const createSpy = mock.fn();
    chromeMock.alarms.create = createSpy;
    chromeMock.alarms.getAll = async () => [];

    chromeMock._setStorage('scheduledJobs', [
      { id: '1', domain: 'example.com', intervalMinutes: 0 },
      { id: '2', domain: 'example.com', intervalMinutes: -5 },
      { id: '3', domain: 'example.com', intervalMinutes: 'invalid' },
      { id: '4', domain: 'example.com', intervalMinutes: 5 } // valid
    ]);

    await scheduleAllJobs();

    assert.equal(createSpy.mock.callCount(), 1);
    assert.equal(createSpy.mock.calls[0].arguments[0], 'reload-job:4');
  });

  it('should clear existing job alarms before scheduling', async () => {
    chromeMock._addPermission('alarms');

    const clearSpy = mock.fn(() => Promise.resolve(true));
    chromeMock.alarms.clear = clearSpy;
    chromeMock.alarms.getAll = async () => [
      { name: 'reload-job:old1' },
      { name: 'reload-job:old2' },
      { name: 'other-alarm' }
    ];

    chromeMock._setStorage('scheduledJobs', []);

    await scheduleAllJobs();

    // Should only clear job alarms, not other alarms
    assert.equal(clearSpy.mock.callCount(), 2);
  });
});

describe('setAllJobsEnabled', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should enable all jobs', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: false },
      { id: '2', domain: 'b.com', enabled: false }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await setAllJobsEnabled(true);

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].enabled, true);
    assert.equal(stored[1].enabled, true);
  });

  it('should disable all jobs', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: true },
      { id: '2', domain: 'b.com', enabled: true }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await setAllJobsEnabled(false);

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].enabled, false);
    assert.equal(stored[1].enabled, false);
  });

  it('should do nothing for empty jobs list', async () => {
    chromeMock._setStorage('scheduledJobs', []);

    await setAllJobsEnabled(true);

    // Should not throw
  });

  it('should do nothing if scheduledJobs is not an array', async () => {
    chromeMock._setStorage('scheduledJobs', 'not-an-array');

    await setAllJobsEnabled(true);

    // Should not throw
  });
});

describe('toggleJobEnabled', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should enable a disabled job', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: false },
      { id: '2', domain: 'b.com', enabled: true }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await toggleJobEnabled('1');

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].enabled, true);
    assert.equal(stored[1].enabled, true); // unchanged
  });

  it('should disable an enabled job', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: true },
      { id: '2', domain: 'b.com', enabled: true }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await toggleJobEnabled('1');

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].enabled, false);
    assert.equal(stored[1].enabled, true); // unchanged
  });

  it('should not affect other jobs', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: true, otherProp: 'test' },
      { id: '2', domain: 'b.com', enabled: false }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await toggleJobEnabled('1');

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].otherProp, 'test');
    assert.equal(stored[1].enabled, false);
  });

  it('should do nothing for non-existent job id', async () => {
    const jobs = [
      { id: '1', domain: 'a.com', enabled: true }
    ];
    chromeMock._setStorage('scheduledJobs', jobs);

    await toggleJobEnabled('non-existent');

    const stored = chromeMock._storage.get('scheduledJobs');
    assert.equal(stored[0].enabled, true); // unchanged
  });
});

describe('executeScheduledJob', () => {
  beforeEach(() => {
    resetChromeMock(chromeMock);
  });

  it('should clear alarm and return if job not found', async () => {
    const clearSpy = mock.fn(() => Promise.resolve(true));
    chromeMock.alarms.clear = clearSpy;
    chromeMock._setStorage('scheduledJobs', []);

    await executeScheduledJob('non-existent');

    assert.equal(clearSpy.mock.callCount(), 1);
  });

  it('should reload matching tabs', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://example.com/page2' },
      { id: 3, url: 'https://other.com/page' }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com' }
    ]);

    await executeScheduledJob('job1');

    assert.equal(reloadSpy.mock.callCount(), 2);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 1);
    assert.equal(reloadSpy.mock.calls[1].arguments[0], 2);
  });

  it('should skip active tabs when excludeActiveTab is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page1', active: true },
      { id: 2, url: 'https://example.com/page2', active: false }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com', excludeActiveTab: true }
    ]);

    await executeScheduledJob('job1');

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should skip audible tabs when excludeAudioTabs is set', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page1', audible: true },
      { id: 2, url: 'https://example.com/page2', audible: false }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com', excludeAudioTabs: true }
    ]);

    await executeScheduledJob('job1');

    assert.equal(reloadSpy.mock.callCount(), 1);
    assert.equal(reloadSpy.mock.calls[0].arguments[0], 2);
  });

  it('should use bypassCache from job settings', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com', bypassCache: true }
    ]);

    await executeScheduledJob('job1');

    assert.equal(reloadSpy.mock.calls[0].arguments[1].bypassCache, true);
  });

  it('should not reload if no tabs match', async () => {
    const reloadSpy = mock.fn(() => Promise.resolve());
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://other.com/page' }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com' }
    ]);

    await executeScheduledJob('job1');

    assert.equal(reloadSpy.mock.callCount(), 0);
  });

  it('should handle reload errors gracefully', async () => {
    const reloadSpy = mock.fn(() => Promise.reject(new Error('Tab not found')));
    chromeMock.tabs.reload = reloadSpy;
    chromeMock.tabs.query = async () => [
      { id: 1, url: 'https://example.com/page' }
    ];

    chromeMock._setStorage('scheduledJobs', [
      { id: 'job1', domain: 'example.com' }
    ]);

    // Should not throw
    await executeScheduledJob('job1');
  });
});
