import type { DetectedProvider, IDedooProvider, ICompatProvider, WalletBrand } from './provider.js';
import type { DedooClient } from './client.js';
export * from './types.js';
export * from './provider-types.js';
export type { AnyProvider, DetectedProvider, IDedooProvider, ICompatProvider, WalletBrand, } from './provider.js';
export { createDedooClient, broadcastRawTx, MAX_OP_RETURN_BYTES, ChainMismatchError } from './client.js';
export type { DedooClient, DedooClientOptions, EnsureChainOptions } from './client.js';
/** Global the Dedoo Extension Wallet injects into every page. */
export declare const PROVIDER_GLOBAL = "dedoo";
/** Event fired (on `window` and `document`) once the provider is ready. */
export declare const PROVIDER_EVENT = "dedoo#initialized";
/** The provider API version; it tracks the wallet release. */
export declare const PROVIDER_VERSION: string;
/** Detected brands, in preference order. */
export declare const WALLET_BRANDS: readonly {
    brand: WalletBrand;
    global: string;
    event: string;
}[];
/** Legacy global names this SDK still detects. */
export declare const LEGACY_GLOBALS: readonly ["junkext", "junkcoin", "wojak"];
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
/**
 * Find a provider synchronously.
 *
 * @param preferredBrand Look for that brand first; without it the first
 *   registered brand that exists wins.
 */
export declare function detectProvider(preferredBrand?: WalletBrand): DetectedProvider | undefined;
/** Every provider currently injected, in preference order. */
export declare function getAllProviders(): DetectedProvider[];
/**
 * Wait for a wallet to inject its provider.
 *
 * @param timeout ms to wait before rejecting (default 5000)
 * @param preferredBrand brand to prefer when several wallets appear
 */
export declare function getAnyProvider(timeout?: number, preferredBrand?: WalletBrand): Promise<DetectedProvider>;
/**
 * Wait for the Dedoo Extension Wallet and return a normalised client.
 *
 * ```ts
 * const dedoo = await initDedoo();
 * const address = await dedoo.connect();
 * ```
 */
export declare function initDedoo(timeout?: number, preferredBrand?: WalletBrand): Promise<DedooClient>;
/**
 * Resolve a wallet URI scheme (`junkcoin:`, `ded:`, `wojak:`, …) to the brand
 * it belongs to. Unknown schemes give `undefined`.
 */
export declare function uriSchemeToBrand(scheme: string): WalletBrand | undefined;
/** Detect + wrap in one call. Returns `undefined` when nothing is injected. */
export declare function initDedooSync(preferredBrand?: WalletBrand): DedooClient | undefined;
//# sourceMappingURL=index.d.ts.map