import type { AccountInfo, ActiveChain, Address, AddressesResult, Balance, ChainId, ConnectResult, CreateTxResult, FeeRates, DedooEvent, ListedChain, NetworkType, ProviderState, SendTxResult, SignMessageResult, SignPsbtResult } from './types.js';
import type { CreateTxPayload, SendBitcoinOptions, SendWithOpReturnOptions, SignPsbtOptions } from './provider-types.js';
/**
 * The provider injected by the Dedoo Extension Wallet as `window.dedoo`.
 * Every method that moves funds or signs data opens a prompt in the wallet and
 * only resolves once the user approves.
 *
 * Shapes here are the *raw* ones the extension returns; most callers want the
 * normalised {@link DedooClient} from `createDedooClient()` instead.
 */
export interface IDedooProvider {
    /** Always `true` on the extension's own provider. */
    isDedoo: true;
    version: string;
    /** Low-level EIP-1193 style entry point. Prefer the wrappers below. */
    request(method: string, params?: unknown[]): Promise<unknown>;
    /**
     * Subscribe to a provider event. Returns an unsubscribe function (the
     * `wojak-sdk` interface returns `void`, so also keep the token if you
     * support both).
     */
    on(event: DedooEvent, handler: (payload: any) => void): () => void;
    removeListener(event: DedooEvent, handler: (payload: any) => void): void;
    getProviderState(): Promise<ProviderState>;
    getVersion(): Promise<string>;
    getNetwork(): Promise<NetworkType>;
    isConnected(): Promise<boolean>;
    keepAlive(): Promise<string>;
    /** The chain the wallet is on: `{id, name, ticker, network}`. */
    getChain(): Promise<ActiveChain>;
    /** Every chain the wallet can switch to, the active one flagged. */
    getChains(): Promise<ListedChain[]>;
    /** Ask the user to switch chain. Resolves with `{chainId}`. */
    switchChain(chainId: ChainId): Promise<{
        chainId: ChainId;
    }>;
    connect(options?: {
        name?: string;
        icon?: string;
    }): Promise<ConnectResult>;
    getAccount(): Promise<Address>;
    getAccountName(): Promise<AccountInfo>;
    getBalance(): Promise<Balance>;
    getPublicKey(): Promise<{
        address: Address;
        publicKey: string;
    }>;
    getAddresses(): Promise<AddressesResult>;
    getFeeRates(): Promise<FeeRates>;
    signMessage(message: string, address?: Address): Promise<SignMessageResult>;
    createTx(payload: CreateTxPayload): Promise<CreateTxResult>;
    signPsbt(psbtBase64: string, options?: SignPsbtOptions): Promise<SignPsbtResult>;
    sendTx(rawTxHex: string): Promise<SendTxResult>;
    switchNetwork(network: NetworkType): Promise<{
        network: NetworkType;
    }>;
}
/**
 * The smaller surface exposed by Unisat-style wallets (`window.junkcoin`,
 * `window.wojak`). Method names line up with {@link IDedooProvider} but return
 * scalars instead of envelopes, which is why {@link createDedooClient}
 * normalises both.
 */
export interface ICompatProvider {
    connect?: (...args: any[]) => Promise<any>;
    isConnected?: (...args: any[]) => Promise<any>;
    getAccount?: (...args: any[]) => Promise<any>;
    getAccountName?: (...args: any[]) => Promise<any>;
    getPublicKey?: (...args: any[]) => Promise<any>;
    getBalance?: (...args: any[]) => Promise<any>;
    getNetwork?: (...args: any[]) => Promise<any>;
    switchNetwork?: (...args: any[]) => Promise<any>;
    getChain?: (...args: any[]) => Promise<any>;
    getChains?: (...args: any[]) => Promise<any>;
    switchChain?: (...args: any[]) => Promise<any>;
    getVersion?: (...args: any[]) => Promise<any>;
    getProviderState?: (...args: any[]) => Promise<any>;
    getAddresses?: (...args: any[]) => Promise<any>;
    getFeeRates?: (...args: any[]) => Promise<any>;
    signMessage?: (...args: any[]) => Promise<any>;
    createTx?: (...args: any[]) => Promise<any>;
    signPsbt?: (...args: any[]) => Promise<any>;
    sendTx?: (...args: any[]) => Promise<any>;
    sendBitcoin?: (toAddress: string, satoshis: number, options?: SendBitcoinOptions) => Promise<string>;
    sendWithOpReturn?: (toAddress: string, satoshis: number, opReturnPayload: string, options?: SendWithOpReturnOptions) => Promise<string>;
    on?: (event: string, handler: (payload: any) => void) => any;
    removeListener?: (event: string, handler: (payload: any) => void) => void;
    request?: (method: string, params?: any[]) => Promise<any>;
    [key: string]: any;
}
/** Anything the SDK will talk to. */
export type AnyProvider = IDedooProvider | ICompatProvider;
/** Which extension brand injected the provider. */
export type WalletBrand = 'dedoo' | 'junkcoin' | 'wojak';
/** A detected wallet: which global it came from, and the provider itself. */
export interface DetectedProvider {
    provider: AnyProvider;
    brand: WalletBrand;
}
//# sourceMappingURL=provider.d.ts.map