// Bundles the Electron main process (ESM) and preload (CJS, required for
// sandboxed preloads). Dependencies stay external and ship in node_modules.
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  external: ['electron'],
  logLevel: 'info',
};

const configs = [
  { ...shared, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.mjs', format: 'esm' },
  { ...shared, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', format: 'cjs' },
];

if (watch) {
  for (const c of configs) await (await context(c)).watch();
} else {
  await Promise.all(configs.map((c) => build(c)));
}
