/**
 * Unit tests for js/options/dom.js
 * Tests DOM utilities (debounce function only - others require DOM)
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../../js/options/dom.js';

describe('debounce', () => {
  it('should delay function execution', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 50);

    debounced();
    assert.equal(fn.mock.callCount(), 0);

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(fn.mock.callCount(), 1);
  });

  it('should only call function once for rapid calls', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 50);

    debounced();
    debounced();
    debounced();
    debounced();

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(fn.mock.callCount(), 1);
  });

  it('should pass arguments to the debounced function', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 50);

    debounced('arg1', 'arg2');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(fn.mock.callCount(), 1);
    assert.deepEqual(fn.mock.calls[0].arguments, ['arg1', 'arg2']);
  });

  it('should use the last arguments when called multiple times', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 50);

    debounced('first');
    debounced('second');
    debounced('third');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(fn.mock.callCount(), 1);
    assert.deepEqual(fn.mock.calls[0].arguments, ['third']);
  });

  it('should allow multiple executions with sufficient delay', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 30);

    debounced('first');
    await new Promise(resolve => setTimeout(resolve, 40));

    debounced('second');
    await new Promise(resolve => setTimeout(resolve, 40));

    assert.equal(fn.mock.callCount(), 2);
    assert.deepEqual(fn.mock.calls[0].arguments, ['first']);
    assert.deepEqual(fn.mock.calls[1].arguments, ['second']);
  });

  it('should reset timer on each call', async () => {
    const fn = mock.fn();
    const debounced = debounce(fn, 50);

    debounced();
    await new Promise(resolve => setTimeout(resolve, 30));

    debounced(); // Reset timer
    await new Promise(resolve => setTimeout(resolve, 30));

    // Should not have been called yet (30 + 30 = 60ms, but timer reset at 30ms)
    assert.equal(fn.mock.callCount(), 0);

    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(fn.mock.callCount(), 1);
  });
});
