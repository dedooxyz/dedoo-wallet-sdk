/**
 * Builds the Dedoo SDK: ESM + CJS bundles through esbuild, then the .d.ts files
 * through tsc.
 *
 * The provider API version is injected at build time (`__PROVIDER_VERSION__`)
 * so the source never repeats it. Resolution order:
 *
 *   1. `DEDOO_PROVIDER_VERSION` — an explicit override (CI, release tooling)
 *   2. the parent package, when this checkout lives inside the wallet monorepo
 *      (`<wallet>/sdk`), because there the wallet is the source of truth
 *   3. this package's own version — the standalone repository case
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

/** The wallet package that owns this SDK inside the monorepo. */
const WALLET_PACKAGE = 'dedoo-extension-wallet';

async function resolveProviderVersion() {
  if (process.env.DEDOO_PROVIDER_VERSION) return process.env.DEDOO_PROVIDER_VERSION;
  try {
    const parent = JSON.parse(await fs.readFile(path.join(root, '..', 'package.json'), 'utf8'));
    // Only trust it when it really is the wallet: an unrelated parent
    // package.json must not silently decide the provider version.
    if (parent && parent.name === WALLET_PACKAGE && typeof parent.version === 'string') {
      return parent.version;
    }
  } catch {
    /* standalone checkout — there is no parent package */
  }
  return pkg.version;
}

const PROVIDER_VERSION = await resolveProviderVersion();

const common = {
  entryPoints: [path.join(root, 'src/index.ts')],
  bundle: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  target: ['es2020'],
  banner: { js: `/*! ${pkg.name} v${pkg.version} */` },
  define: { __PROVIDER_VERSION__: JSON.stringify(PROVIDER_VERSION) },
};

await esbuild.build({
  ...common,
  format: 'esm',
  platform: 'neutral',
  outfile: path.join(root, 'dist/index.js'),
});

await esbuild.build({
  ...common,
  format: 'cjs',
  platform: 'node',
  outfile: path.join(root, 'dist/index.cjs'),
});

let tsc;
try {
  tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
} catch {
  throw new Error('typescript is not installed — run `npm install` before building the SDK');
}
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });

console.log(
  `✔ ${pkg.name} v${pkg.version} (provider v${PROVIDER_VERSION}) → dist/index.js, dist/index.cjs, dist/index.d.ts`,
);
