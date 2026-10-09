/**
 * @file navigationObserver.ts
 * Observes client-side SPA route changes (pushState, replaceState, popstate, hashchange)
 * and dynamic DOM mutations for multi-step job application wizards.
 */

export interface NavigationObserverOptions {
  onRouteChange?: (newUrl: string, method: string) => void;
  onFormMutated?: (mutatedNodes: Node[]) => void;
  debounceMs?: number;
}

export interface NavigationObserverHandle {
  disconnect: () => void;
}

let isHistoryPatched = false;
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;

const routeCallbacks = new Set<(newUrl: string, method: string) => void>();

function notifyRouteChange(newUrl: string, method: string) {
  routeCallbacks.forEach((cb) => {
    try {
      cb(newUrl, method);
    } catch {
      // Prevent listener errors from halting execution
    }
  });

  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(
        new CustomEvent('autofiller:routechange', {
          detail: { url: newUrl, method },
        }),
      );
    } catch {
      // Ignore CustomEvent dispatch issues
    }
  }
}

function patchHistoryIfAvailable() {
  if (isHistoryPatched || typeof window === 'undefined' || !window.history) return;

  originalPushState = window.history.pushState;
  originalReplaceState = window.history.replaceState;

  window.history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState?.apply(this, args);
    const newUrl = window.location.href;
    notifyRouteChange(newUrl, 'pushState');
    return result;
  };

  window.history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState?.apply(this, args);
    const newUrl = window.location.href;
    notifyRouteChange(newUrl, 'replaceState');
    return result;
  };

  window.addEventListener('popstate', () => {
    notifyRouteChange(window.location.href, 'popstate');
  });

  window.addEventListener('hashchange', () => {
    notifyRouteChange(window.location.href, 'hashchange');
  });

  isHistoryPatched = true;
}

/**
 * Initializes SPA route tracking and DOM form mutation observation.
 */
export function initNavigationObserver(
  options: NavigationObserverOptions = {},
  doc: Document = document,
): NavigationObserverHandle {
  const debounceMs = options.debounceMs ?? 250;
  patchHistoryIfAvailable();

  if (options.onRouteChange) {
    routeCallbacks.add(options.onRouteChange);
  }

  let mutationObserver: MutationObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingNodes: Node[] = [];

  const targetRoot = doc.body || doc.documentElement;

  if (typeof MutationObserver !== 'undefined' && targetRoot) {
    mutationObserver = new MutationObserver((mutations) => {
      let hasFormRelevantAdditions = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              // Check if the added element is or contains an interactive form element
              if (
                el.matches?.(
                  'input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"], form, [role="form"], [data-automation-id*="form"]',
                ) ||
                el.querySelector?.(
                  'input, select, textarea, [role="listbox"], [role="combobox"], [role="radiogroup"], [role="group"], form, [role="form"], [data-automation-id*="form"]',
                )
              ) {
                hasFormRelevantAdditions = true;
                pendingNodes.push(node);
              }
            }
          });
        }
      }

      if (hasFormRelevantAdditions && options.onFormMutated) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const batch = [...pendingNodes];
          pendingNodes.length = 0;
          options.onFormMutated?.(batch);
        }, debounceMs);
      }
    });

    try {
      mutationObserver.observe(targetRoot, {
        childList: true,
        subtree: true,
      });
    } catch {
      // Ignore detached root errors in test environments
    }
  }

  return {
    disconnect: () => {
      if (options.onRouteChange) {
        routeCallbacks.delete(options.onRouteChange);
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
    },
  };
}

/**
 * Utility for test teardown to restore native history methods.
 */
export function restoreHistoryForTesting(): void {
  if (!isHistoryPatched || typeof window === 'undefined' || !window.history) return;
  if (originalPushState) window.history.pushState = originalPushState;
  if (originalReplaceState) window.history.replaceState = originalReplaceState;
  routeCallbacks.clear();
  isHistoryPatched = false;
  originalPushState = null;
  originalReplaceState = null;
}
