/**
 * Utility functions for DOM inspection, string normalization, and visibility checks.
 */

/**
 * Checks if an element is hidden or non-interactive
 */
export function isElementHidden(el: Element): boolean {
  if ((el as HTMLElement).hidden) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  if ((el as HTMLInputElement).type === 'hidden') return true;

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
    } catch {
      // In non-browser/mock environments where getComputedStyle may fail on detached elements
    }
  }

  // Check inline style fallbacks
  const htmlEl = el as HTMLElement;
  if (htmlEl.style) {
    if (htmlEl.style.display === 'none' || htmlEl.style.visibility === 'hidden') {
      return true;
    }
  }

  return false;
}

/**
 * Safe CSS escaping for environments where global CSS.escape may be unavailable (e.g. Node/jsdom)
 */
export function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/["\\]/g, '\\$&');
}

/**
 * Normalizes visible whitespace from text strings
 */
export function cleanText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Strips required asterisks and trailing marker symbols
 */
export function cleanLabelText(rawLabel: string): string {
  return cleanText(rawLabel.replace(/[\s*]+$/, '').replace(/^\s*\*+\s*/, ''));
}

/**
 * Normalizes string for case-insensitive matching
 */
export function normalize(str?: string | null): string {
  return cleanText(str).toLowerCase();
}

/**
 * Conservative placeholder heuristic detection
 */
export function isPlaceholderOption(
  text: string,
  value?: string,
  disabled?: boolean,
  selected?: boolean,
): boolean {
  const normalized = text.toLowerCase().trim();
  const isGenericPrompt =
    /^(select|choose|pick|none|\s*|please select|select one|choose one|--.*--)$/i.test(normalized);

  // If value is explicitly empty and text is a generic prompt
  if ((value === '' || value === undefined) && isGenericPrompt) {
    return true;
  }

  // If disabled and matches generic prompt
  if (disabled && isGenericPrompt) {
    return true;
  }

  // If selected by default, has no value or empty value, and looks like a prompt
  if (selected && (value === '' || value === undefined) && isGenericPrompt) {
    return true;
  }

  return false;
}
