import type { DetectedProvider, IDedooProvider, ICompatProvider, WalletBrand } from './provider.js';
import type { DedooClient } from './client.js';
import { createDedooClient } from './client.js';

/* ------------------------------------------------------------- exports */

export * from './types.js';
export * from './provider-types.js';
export type {
  AnyProvider,
  DetectedProvider,
  IDedooProvider,
  ICompatProvider,
  WalletBrand,
} from './provider.js';
export { createDedooClient, broadcastRawTx, MAX_OP_RETURN_BYTES, ChainMismatchError } from './client.js';
export type { DedooClient, DedooClientOptions, EnsureChainOptions } from './client.js';

/* -------------------------------------------------------- constants */

/**
 * Injected by `sdk/build.mjs` from the wallet's `package.json`, which is the
 * single source of truth. There is deliberately no fallback: this package is
 * only ever consumed through its build, so a missing injection is a broken
 * build rather than something to paper over with a literal.
 */
declare const __PROVIDER_VERSION__: string;

/** Global the Dedoo Extension Wallet injects into every page. */
export const PROVIDER_GLOBAL = 'dedoo';
/** Event fired (on `window` and `document`) once the provider is ready. */
export const PROVIDER_EVENT = 'dedoo#initialized';
/** The provider API version; it tracks the wallet release. */
export const PROVIDER_VERSION = __PROVIDER_VERSION__;

/** Detected brands, in preference order. */
export const WALLET_BRANDS: readonly { brand: WalletBrand; global: string; event: string }[] = [
  { brand: 'dedoo', global: 'dedoo', event: 'dedoo#initialized' },
  { brand: 'junkcoin', global: 'junkcoin', event: 'junkcoin#initialized' },
  { brand: 'wojak', global: 'wojak', event: 'wojak#initialized' },
] as const;

/** Legacy global names this SDK still detects. */
export const LEGACY_GLOBALS = ['junkext', 'junkcoin', 'wojak'] as const;

declare global {
  interface Window {
    dedoo?: IDedooProvider;
    /** Unisat-style junkcoin extensions. */
    junkcoin?: ICompatProvider;
    /** Unisat-style wojak extensions. */
    wojak?: ICompatProvider;
    /** Pre-rebrand name of this extension. */
    junkext?: IDedooProvider;
  }
}

function win(): any {
  return typeof window !== 'undefined' ? window : undefined;
}

/* ---------------------------------------------------------- detection */

/**
 * Find a provider synchronously.
 *
 * @param preferredBrand Look for that brand first; without it the first
 *   registered brand that exists wins.
 */
export function detectProvider(preferredBrand?: WalletBrand): DetectedProvider | undefined {
  const w = win();
  if (!w) return undefined;
  const ordered = preferredBrand
    ? [...WALLET_BRANDS].sort((a, b) => (a.brand === preferredBrand ? -1 : b.brand === preferredBrand ? 1 : 0))
    : [...WALLET_BRANDS];
  for (const entry of ordered) {
    const provider = w[entry.global];
    if (provider) return { provider, brand: entry.brand };
  }
  // pre-rebrand global, always maps to this wallet
  if (w.junkext) return { provider: w.junkext, brand: 'dedoo' };
  return undefined;
}

/** Every provider currently injected, in preference order. */
export function getAllProviders(): DetectedProvider[] {
  const w = win();
  if (!w) return [];
  const found: DetectedProvider[] = [];
  for (const entry of WALLET_BRANDS) {
    const provider = w[entry.global];
    if (provider && !found.some((d) => d.provider === provider)) found.push({ provider, brand: entry.brand });
  }
  if (w.junkext && !found.some((d) => d.provider === w.junkext)) {
    found.push({ provider: w.junkext, brand: 'dedoo' });
  }
  return found;
}

/**
 * Wait for a wallet to inject its provider.
 *
 * @param timeout ms to wait before rejecting (default 5000)
 * @param preferredBrand brand to prefer when several wallets appear
 */
export function getAnyProvider(
  timeout = 5000,
  preferredBrand?: WalletBrand,
): Promise<DetectedProvider> {
  const immediate = detectProvider(preferredBrand) || getAllProviders()[0];
  if (immediate) return Promise.resolve(immediate);

  return new Promise<DetectedProvider>((resolve, reject) => {
    const w = win();
    if (!w) {
      reject(new Error('Not a browser environment: no provider to detect'));
      return;
    }
    let settled = false;
    const finish = (value?: DetectedProvider) => {
      if (settled || !value) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onEvent = () => finish(detectProvider(preferredBrand) || getAllProviders()[0]);
    const cleanup = () => {
      for (const entry of WALLET_BRANDS) w.removeEventListener(entry.event, onEvent);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      settled = true;
      cleanup();
      reject(new Error(`No wallet provider detected within ${timeout}ms`));
    }, timeout);
    for (const entry of WALLET_BRANDS) w.addEventListener(entry.event, onEvent);
  });
}

/**
 * Wait for the Dedoo Extension Wallet and return a normalised client.
 *
 * ```ts
 * const dedoo = await initDedoo();
 * const address = await dedoo.connect();
 * ```
 */
export async function initDedoo(timeout = 5000, preferredBrand: WalletBrand = 'dedoo'): Promise<DedooClient> {
  const { provider, brand } = await getAnyProvider(timeout, preferredBrand);
  return createDedooClient(provider, { brand });
}

/**
 * Resolve a wallet URI scheme (`junkcoin:`, `ded:`, `wojak:`, …) to the brand
 * it belongs to. Unknown schemes give `undefined`.
 */
export function uriSchemeToBrand(scheme: string): WalletBrand | undefined {
  const key = String(scheme)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^\/\//, '')
    .replace(/:.*$/, '')
    .replace(/\/.*$/, '');
  switch (key) {
    case 'dedoo':
    case 'ded':
    case 'dedooext':
    case 'junkext':
    case 'junkcoin':
    case 'jkc':
      return 'dedoo';
    case 'wojak':
    case 'wojakcoin':
      return 'wojak';
    case 'junkcoinext':
      return 'junkcoin';
    default:
      return undefined;
  }
}

/** Detect + wrap in one call. Returns `undefined` when nothing is injected. */
export function initDedooSync(preferredBrand: WalletBrand = 'dedoo'): DedooClient | undefined {
  const detected = detectProvider(preferredBrand);
  return detected ? createDedooClient(detected.provider, { brand: detected.brand }) : undefined;
}
