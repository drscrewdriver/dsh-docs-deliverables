/**
 * Node half of the plugin — Cordis loader entry point.
 *
 * All plugin logic lives in the browser half; this half installs nothing
 * and owns no state. Adjust when your plugin adds host-side services or routes.
 */

/** Profile row identity. */
export const name = 'dsh-plugin-template';

/**
 * Host-side apply. Intentionally empty for a client-only plugin.
 *
 * When you need host-side logic, import services via ctx.inject:
 *
 * ```typescript
 * export function apply(ctx: Context): void {
 *   ctx.inject(['settings'], (settingsCtx: any) => {
 *     // register settings section
 *   })
 * }
 * ```
 */
export function apply(): void {}
