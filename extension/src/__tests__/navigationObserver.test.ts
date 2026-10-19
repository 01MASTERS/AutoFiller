/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initNavigationObserver,
  restoreHistoryForTesting,
} from '../content/navigationObserver.js';

describe('Navigation & SPA Route Observer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    restoreHistoryForTesting();
    vi.useRealTimers();
  });

  it('notifies on history.pushState calls with URL and method', () => {
    const onRouteChange = vi.fn();
    const observer = initNavigationObserver({ onRouteChange }, document);

    window.history.pushState({}, 'Step 2', '/apply/step2');

    expect(onRouteChange).toHaveBeenCalledWith(expect.stringContaining('/apply/step2'), 'pushState');

    observer.disconnect();
  });

  it('notifies on history.replaceState calls', () => {
    const onRouteChange = vi.fn();
    const observer = initNavigationObserver({ onRouteChange }, document);

    window.history.replaceState({}, 'Step 3', '/apply/step3');

    expect(onRouteChange).toHaveBeenCalledWith(expect.stringContaining('/apply/step3'), 'replaceState');

    observer.disconnect();
  });

  it('notifies on popstate event', () => {
    const onRouteChange = vi.fn();
    const observer = initNavigationObserver({ onRouteChange }, document);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onRouteChange).toHaveBeenCalledWith(expect.any(String), 'popstate');

    observer.disconnect();
  });

  it('notifies on hashchange event', () => {
    const onRouteChange = vi.fn();
    const observer = initNavigationObserver({ onRouteChange }, document);

    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(onRouteChange).toHaveBeenCalledWith(expect.any(String), 'hashchange');

    observer.disconnect();
  });

  it('triggers onFormMutated when dynamic form elements are appended to the DOM', async () => {
    const onFormMutated = vi.fn();
    const observer = initNavigationObserver(
      { onFormMutated, debounceMs: 50 },
      document,
    );

    const form = document.createElement('form');
    form.innerHTML = '<input type="text" name="applicant_name" />';
    document.body.appendChild(form);

    // Drain microtasks and advance debounce timer
    await vi.advanceTimersByTimeAsync(60);

    expect(onFormMutated).toHaveBeenCalledTimes(1);
    expect(onFormMutated).toHaveBeenCalledWith(expect.arrayContaining([form]));

    observer.disconnect();
  });

  it('does not trigger onFormMutated for non-form DOM additions (e.g. tracking scripts, generic divs)', async () => {
    const onFormMutated = vi.fn();
    const observer = initNavigationObserver(
      { onFormMutated, debounceMs: 50 },
      document,
    );

    const scriptDiv = document.createElement('div');
    scriptDiv.className = 'analytics-tracker';
    scriptDiv.innerHTML = '<span>tracking</span>';
    document.body.appendChild(scriptDiv);

    vi.advanceTimersByTime(60);

    expect(onFormMutated).not.toHaveBeenCalled();

    observer.disconnect();
  });
});
