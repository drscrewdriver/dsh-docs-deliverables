/**
 * tsdown config — client browser bundle for DSH.
 *
 * Produces `lib/client.js` as a CJS module that registers via
 * `window.__ModuleLoader__.load({ id, factory })`.
 *
 * Peer dependencies are marked as external — they are provided by DSH at runtime.
 */
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/client/index.ts'],
  outDir: 'lib',
  format: 'cjs',
  dts: true,
  dtsDir: 'lib/types/client',
  external: [],
  banner: {
    js: `// ${'__ModuleLoader__'} wrapper for DSH client module system.`,
  },
  clean: true,
  quiet: true,
});
