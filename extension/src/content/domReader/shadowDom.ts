/**
 * @file shadowDom.ts
 * Deep Shadow DOM traversal, open shadow-root discovery, and boundary-piercing queries.
 * Handles modern frameworks (Angular 20, Lit, Web Components) with nested shadow roots.
 */

import { escapeCss } from './utils.js';

export type DOMQueryRoot = Document | ShadowRoot | Element;

/**
 * Traverses the DOM tree starting from root using Depth-First Search (DFS),
 * collecting all Document, Element, and open ShadowRoot instances in exact visual document flow order.
 */
export function getAllDOMRoots(root: Node = document): DOMQueryRoot[] {
  const roots: DOMQueryRoot[] = [];

  const isQueryable = (node: unknown): node is DOMQueryRoot => {
    return (
      Boolean(node) &&
      typeof node === 'object' &&
      'querySelectorAll' in node &&
      typeof (node as { querySelectorAll?: unknown }).querySelectorAll === 'function'
    );
  };

  if (isQueryable(root)) {
    roots.push(root);
  }

  function walk(node: Node) {
    if (node instanceof Element) {
      if (node.shadowRoot && isQueryable(node.shadowRoot)) {
        if (!roots.includes(node.shadowRoot)) {
          roots.push(node.shadowRoot);
        }
        // Traverse inside shadow root in document order
        const shadowChildren = node.shadowRoot.children;
        if (shadowChildren) {
          for (let i = 0; i < shadowChildren.length; i++) {
            walk(shadowChildren[i]);
          }
        }
      }
    }

    const children = (node as Element).children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walk(children[i]);
      }
    }
  }

  walk(root);
  return roots;
}

/**
 * Queries all provided roots with a CSS selector, maintaining natural document flow order.
 */
export function querySelectorAllAcrossRoots<T extends Element = Element>(
  roots: DOMQueryRoot[],
  selector: string,
): T[] {
  const results: T[] = [];
  const seen = new Set<Element>();

  for (const r of roots) {
    try {
      const matches = r.querySelectorAll<T>(selector);
      for (let i = 0; i < matches.length; i++) {
        const el = matches[i];
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    } catch {
      // Ignore invalid or unsupported CSS selectors in specific root scopes
    }
  }

  return results;
}

/**
 * Deep query selector that pierces all open shadow roots starting from root.
 */
export function deepQuerySelectorAll<T extends Element = Element>(
  root: Node = document,
  selector: string,
): T[] {
  const roots = getAllDOMRoots(root);
  return querySelectorAllAcrossRoots<T>(roots, selector);
}

/**
 * Returns the first element matching selector across all open shadow roots in document order.
 */
export function deepQuerySelector<T extends Element = Element>(
  root: Node = document,
  selector: string,
): T | null {
  const roots = getAllDOMRoots(root);
  for (const r of roots) {
    try {
      const match = r.querySelector<T>(selector);
      if (match) return match;
    } catch {
      // Ignore selector errors
    }
  }
  return null;
}

/**
 * Searches for an element by ID across the document and all open shadow roots.
 */
export function deepGetElementById(id: string, root: Node = document): Element | null {
  const roots = getAllDOMRoots(root);
  for (const r of roots) {
    try {
      if ('getElementById' in r && typeof (r as Document).getElementById === 'function') {
        const el = (r as Document).getElementById(id);
        if (el) return el;
      } else {
        const el = r.querySelector(`#${escapeCss(id)}`);
        if (el) return el;
      }
    } catch {
      // Ignore lookup error
    }
  }
  return null;
}

/**
 * Walks up the DOM tree, piercing shadow boundaries via (root as ShadowRoot).host.
 * Enables finding question containers or form wrappers that enclose an element inside shadow DOM.
 */
export function deepClosest(el: Element | null, selector: string): Element | null {
  let current: Element | null = el;

  while (current) {
    try {
      const match = current.closest(selector);
      if (match) return match;
    } catch {
      // Ignore selector errors
    }

    // Step across shadow boundary if at root of shadow tree
    const rootNode = current.getRootNode();
    const isShadow =
      (typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot) ||
      Boolean(rootNode && typeof rootNode === 'object' && 'host' in rootNode);

    if (isShadow && (rootNode as ShadowRoot).host) {
      current = (rootNode as ShadowRoot).host;
    } else {
      current = current.parentElement;
    }
  }

  return null;
}

/**
 * Retrieves the host element if this element is inside a ShadowRoot, or null otherwise.
 */
export function getShadowHost(el: Element): Element | null {
  const rootNode = el.getRootNode();
  const isShadow =
    (typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot) ||
    Boolean(rootNode && typeof rootNode === 'object' && 'host' in rootNode);

  if (isShadow && (rootNode as ShadowRoot).host) {
    return (rootNode as ShadowRoot).host;
  }
  return null;
}

/**
 * Verifies if an element is currently connected to the live document tree,
 * correctly handling elements inside Shadow DOM.
 */
export function isElementConnected(el: Element): boolean {
  if (typeof el.isConnected === 'boolean') {
    return el.isConnected;
  }
  let current: Node | null = el;
  while (current) {
    if (current.nodeType === Node.DOCUMENT_NODE) return true;
    const root = current.getRootNode ? current.getRootNode() : null;
    if (root && root !== current && 'host' in root) {
      current = (root as ShadowRoot).host;
    } else {
      current = current.parentNode;
    }
  }
  return false;
}
