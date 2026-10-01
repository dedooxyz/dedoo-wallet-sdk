import type { AccountInfo, ActiveChain, Address, AddressesResult, Balance, ChainId, ConnectResult, CreateTxResult, DedooEvent, FeeRates, ListedChain, NetworkType, ProviderState, RawTxHex, PsbtBase64, SendTxResult, SignMessageResult, Txid } from './types.js';
import type { AnyProvider, WalletBrand } from './provider.js';
import type { CreateTxPayload, MultiSignPsbtOptions, SendBitcoinOptions, SendWithOpReturnOptions, SignPsbtOptions } from './provider-types.js';
/** BIP234/policy cap on a single `OP_RETURN` payload, in bytes. */
export declare const MAX_OP_RETURN_BYTES = 80;
export interface DedooClientOptions {
    /** Which brand the provider was detected under (cosmetic; affects nothing). */
    brand?: WalletBrand;
}
export interface EnsureChainOptions {
    /**
     * Throw a {@link ChainMismatchError} instead of returning the wrong chain when
     * the user declines the switch. Default `false`, so a caller can decide
     * whether a mismatch is fatal.
     */
    throwOnMismatch?: boolean;
}
/**
 * The wallet is on a chain the caller did not ask for.
 *
 * Thrown by {@link DedooClient.ensureChain} when the switch was refused, so a
 * caller can tell "the user said no" apart from a transport failure.
 */
export declare class ChainMismatchError extends Error {
    /** The chain the caller required. */
    readonly expected: ChainId;
    /** The chain the wallet is actually on, when it reports one. */
    readonly actual: ChainId | undefined;
    readonly code = "CHAIN_MISMATCH";
    constructor(
    /** The chain the caller required. */
    expected: ChainId, 
    /** The chain the wallet is actually on, when it reports one. */
    actual: ChainId | undefined);
}
/**
 * A normalised view over a wallet provider.
 *
 * Every signing/money method resolves with a *scalar* where one exists —
 * `signMessage()` gives you the signature, `createTx()` the hex, `sendTx()` the
 * txid — mirroring the `wojak-sdk` surface so dapps written against it keep
 * working. The un-normalised objects stay available as `client.provider` and
 * through the `*Info()` methods.
 */
export interface DedooClient {
    /** The provider this client wraps. */
    readonly provider: AnyProvider;
    /** Brand the provider was detected under, when detection was used. */
    readonly brand?: WalletBrand;
    /** Ask the user to connect. Resolves with the connected address. */
    connect(options?: {
        name?: string;
        icon?: string;
    }): Promise<Address>;
    /** Same as `connect`, but keeps the wallet's `{address, network, name, origin}`. */
    connectInfo(options?: {
        name?: string;
        icon?: string;
    }): Promise<ConnectResult>;
    isConnected(): Promise<boolean>;
    getProviderState(): Promise<ProviderState>;
    getVersion(): Promise<string>;
    getNetwork(): Promise<NetworkType>;
    /** Ask the user to switch network. Resolves with the new network. */
    switchNetwork(network: NetworkType): Promise<NetworkType>;
    /** Chain the wallet is on: `{id, name, ticker, network}`. */
    getChain(): Promise<ActiveChain>;
    /** Chain id only — what you compare against, and what `chainChanged` emits. */
    getChainId(): Promise<ChainId>;
    /** Every chain the wallet can switch to; the active one has `active: true`. */
    getChains(): Promise<ListedChain[]>;
    /** Ask the user to switch chain. Resolves with the new chain id. */
    switchChain(chainId: ChainId): Promise<ChainId>;
    /**
     * Make sure the wallet is on `chainId`, asking it to switch when it is not.
     *
     * This is the dapp-side guard: a multichain wallet can hold several chains, so
     * a dapp that only works on one must move the wallet there *before* it reads
     * chain-specific state (balance, receive address) or signs anything.
     *
     * ```ts
     * await client.ensureChain('wojakcoin', { throwOnMismatch: true });
     * const balance = await client.getBalance();   // now definitely WojakCoin
     * ```
     *
     * Resolves with the chain the wallet ended up on, or `undefined` when the
     * wallet has no chain concept at all (Unisat-style providers) — such a wallet
     * is left untouched rather than treated as mismatched.
     */
    ensureChain(chainId: ChainId, options?: EnsureChainOptions): Promise<ChainId | undefined>;
    /** Extension keep-alive ping. Resolves with `"ACK_KEEP_ALIVE_MESSAGE"`. */
    keepAlive(): Promise<string | boolean>;
    /** Connected account address. */
    getAccount(): Promise<Address>;
    /** `{id, name, address, type}` for the connected account. */
    getAccountInfo(): Promise<AccountInfo>;
    /** Display name of the connected account. */
    getAccountName(): Promise<string>;
    /** 33-byte compressed public key, hex. */
    getPublicKey(): Promise<string>;
    /** Receive/change addresses exposed to this origin. */
    getAddresses(): Promise<AddressesResult>;
    /** Balances in satoshis. */
    getBalance(): Promise<Balance>;
    /** Sat/vbyte fee estimates: `{slow, standard, fast}`. */
    getFeeRates(): Promise<FeeRates>;
    /** Sign a message. Resolves with the base64 signature. */
    signMessage(message: string, address?: Address): Promise<string>;
    /** Same as `signMessage`, but keeps `{message, address, signature, network}`. */
    signMessageInfo(message: string, address?: Address): Promise<SignMessageResult>;
    /** Build and sign a transaction. Resolves with the signed hex. */
    createTx(payload: CreateTxPayload): Promise<RawTxHex>;
    /** Same as `createTx`, but keeps `{hex, txid, fee, vsize, estimatedFeeRate}`. */
    createTxInfo(payload: CreateTxPayload): Promise<CreateTxResult>;
    /** Sign a PSBT. Resolves with the base64 PSBT. */
    signPsbt(psbtBase64: PsbtBase64, options?: SignPsbtOptions): Promise<PsbtBase64>;
    /** Broadcast a signed transaction through the wallet. Resolves with the txid. */
    sendTx(rawTxHex: RawTxHex): Promise<Txid>;
    /** Same as `sendTx`, but keeps `{txid, network}`. */
    sendTxInfo(rawTxHex: RawTxHex): Promise<SendTxResult>;
    /**
     * Build, sign and broadcast a transfer — two prompts (build, then broadcast).
     * Resolves with the txid.
     */
    sendBitcoin(toAddress: Address, satoshis: number, options?: SendBitcoinOptions): Promise<Txid>;
    /**
     * Like `sendBitcoin`, but the transfer carries an `OP_RETURN` payload.
     *
     * With `options.electrsUrl` the SDK broadcasts the signed hex itself so the
     * user only approves the build step; otherwise the wallet broadcasts too
     * (second prompt).
     */
    sendWithOpReturn(toAddress: Address, satoshis: number, payload: string, options?: SendWithOpReturnOptions & {
        payloadIsHex?: boolean;
    }): Promise<Txid>;
    /** Broadcast a signed hex through an Electrs/esplora `POST /tx` endpoint. */
    broadcastTx(rawTxHex: RawTxHex, electrsUrl: string): Promise<Txid>;
    /** Sign several PSBTs in one prompt. Resolves with the signed base64 PSBTs. */
    multiPsbtSign(batch: MultiSignPsbtOptions[]): Promise<PsbtBase64[]>;
    on(event: DedooEvent, handler: (payload: any) => void): () => void;
    removeListener(event: DedooEvent, handler: (payload: any) => void): void;
}
/**
 * Wrap any Junkcoin/Unisat style provider in the normalised client.
 *
 * ```ts
 * const provider = window.dedoo;
 * const client = createDedooClient(provider);
 * const address = await client.connect();   // "J…"
 * const txid    = await client.sendBitcoin(address, 10_000);
 * ```
 */
export declare function createDedooClient(provider: AnyProvider, options?: DedooClientOptions): DedooClient;
/**
 * Broadcast a signed transaction through an Electrs/esplora endpoint
 * (`POST {electrsUrl}/tx` with the raw hex body).
 *
 * Used when you want the user to approve only the *build* step.
 */
export declare function broadcastRawTx(electrsUrl: string, rawTxHex: RawTxHex): Promise<Txid>;
//# sourceMappingURL=client.d.ts.map