// modules/dom-manager.js - Optimized DOM Query System
export class DOMManager {
  constructor() {
    this.cache = new Map();
    this.observer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // Mutation observer for cache invalidation
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class']
    });

    this.initialized = true;
  }

  // Cached DOM queries - Single point of access
  get(selector) {
    if (!this.cache.has(selector)) {
      const element = document.querySelector(selector);
      if (element) {
        this.cache.set(selector, element);
      }
    }
    return this.cache.get(selector) || null;
  }

  getAll(selector) {
    const cacheKey = `all:${selector}`;
    if (!this.cache.has(cacheKey)) {
      const elements = document.querySelectorAll(selector);
      this.cache.set(cacheKey, elements);
    }
    return this.cache.get(cacheKey);
  }

  // Cache invalidation
  handleMutations(mutations) {
    let shouldClear = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        shouldClear = true;
        break;
      }
    }

    if (shouldClear) {
      this.cache.clear();
    }
  }

  // Memory cleanup
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.cache.clear();
  }
}

// Singleton instance
export const domManager = new DOMManager();