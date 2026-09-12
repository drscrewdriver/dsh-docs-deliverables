/**
 * Browser half of `dsh-plugin-template`.
 *
 * Demonstrates the standard patterns documented in the plugin-framework guides:
 * - Cordis service injection via `inject` array
 * - Lifecycle management via `ctx.effect()`
 * - Cross-version settings API (installSection / register fallback)
 * - Slot registration for settings panel card
 * - DOM anchor-based lookups (data-* attributes)
 * - Semantic CSS tokens (--dsw-alias-*)
 * - Resource cleanup on unload
 */

// ───────────────────────────────────────────
// Configuration
// ───────────────────────────────────────────

/** Plugin settings namespace (string literal, all DSH versions). */
export const PLUGIN_NS = 'plugin-template' as const;

/** Settings schema. */
export interface PluginConfig {
  enabled?: boolean;
  featureA?: boolean;  // defaults false to avoid conflict with DSH native
  featureB?: boolean;
}

export const defaultConfig: PluginConfig = {
  enabled: true,
  featureA: false,
  featureB: true,
};

// ───────────────────────────────────────────
// Cordis entry
// ───────────────────────────────────────────

/**
 * Services this plugin reads from the Cordis context.
 * Adjust when your plugin needs different services.
 */
export const inject = [] as const;

/**
 * The Cordis context, narrowed to what this plugin uses.
 *
 * This interface is also the template for the full context shape
 * that `apply` receives. When you need additional fields:
 *
 * ```typescript
 * export interface PluginContext {
 *   effect(factory: () => () => void, label: string): () => void;
 *   slots: {
 *     inject(key: string, factory: () => void): void;
 *     register(meta: any, component: any): void;
 *   };
 *   settings: any;  // when you need settings
 *   // ... other services
 * }
 * ```
 */
export interface PluginContext {
  effect(factory: () => () => void, label: string): () => void;
  slots: {
    inject(key: string, factory: () => void): void;
    register(meta: any, component: any): void;
  };
  settings?: any;
}

/**
 * Attach the plugin's browser-side behavior.
 *
 * Rules:
 * 1. All side-effects go through `ctx.effect()` — auto-cleanup on unload.
 * 2. DOM lookups use data-* semantic attributes, never hash class names.
 * 3. CSS uses --dsw-alias-* tokens, no hardcoded colors.
 * 4. Settings read via runtime detection (installSection / register fallback).
 */
export function apply(ctx: PluginContext): void {
  // ── Settings registration ──
  registerSettings(ctx);

  // ── Slot registration ──
  registerSettingsCard(ctx);

  // ── Example: CSS injection with auto-cleanup ──
  ctx.effect(() => {
    const tag = document.createElement('style');
    tag.textContent = `
      .plugin-template-container {
        color: var(--dsw-alias-label-primary, #222);
        background: var(--dsw-alias-bg-layer-3, #fff);
      }
    `;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, 'plugin-template: CSS injection');

  // ── Example: DOM observer with auto-cleanup ──
  ctx.effect(() => {
    const observer = new MutationObserver(() => {
      /* react to DOM changes */
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, 'plugin-template: DOM observer');
}

// ───────────────────────────────────────────
// Settings (cross-version compatible)
// ───────────────────────────────────────────

/**
 * Register settings via runtime-detect dual API:
 * 1. installSection (DSH 0.1.2+)
 * 2. register (all versions)
 * 3. silently skip (neither available)
 */
function registerSettings(ctx: PluginContext): void {
  if (!ctx.settings) return;

  const settings = ctx.settings;

  // DSH 0.1.2+ — installSection
  if (typeof settings?.installSection === 'function') {
    settings.installSection(null, PLUGIN_NS, null, defaultConfig, {
      setSource: () => {},
      onChange: () => {},
    });
    return;
  }

  // All versions — register
  if (typeof settings?.register === 'function') {
    settings.register(PLUGIN_NS, null, { base: defaultConfig });
    return;
  }

  // Neither available — silently skip
}

// ───────────────────────────────────────────
// Slot registration
// ───────────────────────────────────────────

/**
 * Register a settings panel card.
 * Adjust the slot key when your plugin contributes to a different area.
 */
function registerSettingsCard(ctx: PluginContext): void {
  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register(
      {
        name: 'settings.plugin.item',
        key: PLUGIN_NS,
        order: 100,
      },
      // Replace with your React component:
      // MySettingsCard,
      null,
    ),
  );
}

// ───────────────────────────────────────────
// DOM anchors (all target versions stable)
// ───────────────────────────────────────────

/** Semantic DOM anchors — stable across all target DSH versions. */
export const DOM = {
  /** Conversation scroll container */
  scroll: '[data-conversation-scroll]',
  /** Message anchor key */
  anchorKey: '[data-chat-anchor-key]',
  /** Flow kind attribute */
  flowKind: (el: Element) => el.getAttribute('data-chat-flow-kind'),
  /** Composer card */
  composer: '[data-composer-card]',
} as const;

/**
 * Find the conversation scroll container.
 */
export function findScrollContainer(): Element | null {
  return document.querySelector(DOM.scroll);
}
