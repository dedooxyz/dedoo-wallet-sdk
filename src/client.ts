import type {
  AccountInfo,
  ActiveChain,
  Address,
  AddressesResult,
  Balance,
  ChainId,
  ConnectResult,
  CreateTxResult,
  DedooEvent,
  FeeRates,
  ListedChain,
  NetworkType,
  ProviderState,
  RawTxHex,
  PsbtBase64,
  SendTxResult,
  SignMessageResult,
  SignPsbtResult,
  Txid,
} from './types.js';
import type { AnyProvider, WalletBrand } from './provider.js';
import type {
  CreateTxPayload,
  MultiSignPsbtOptions,
  SendBitcoinOptions,
  SendWithOpReturnOptions,
  SignPsbtOptions,
} from './provider-types.js';

/** BIP234/policy cap on a single `OP_RETURN` payload, in bytes. */
export const MAX_OP_RETURN_BYTES = 80;

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
export class ChainMismatchError extends Error {
  readonly code = 'CHAIN_MISMATCH';
  constructor(
    /** The chain the caller required. */
    readonly expected: ChainId,
    /** The chain the wallet is actually on, when it reports one. */
    readonly actual: ChainId | undefined,
  ) {
    super(
      actual
        ? `Wallet is on chain "${actual}", expected "${expected}"`
        : `Wallet chain is unknown, expected "${expected}"`,
    );
    this.name = 'ChainMismatchError';
  }
}

/** Prefer a direct method, fall back to the EIP-1193 `request` bridge. */
async function call(provider: AnyProvider, method: string, args: any[] = []): Promise<any> {
  const fn = (provider as any)[method];
  if (typeof fn === 'function') return fn.apply(provider, args);
  if (typeof (provider as any).request === 'function') return (provider as any).request(method, args);
  throw new Error(`Wallet does not implement ${method}`);
}

/**
 * The Dedoo wallet answers with envelopes (`{address, network, …}`) while
 * Unisat-style wallets answer with bare values. This unwraps the envelope when
 * there is one and passes everything else straight through.
 */
function unwrap(value: any, key?: string): any {
  if (value === null || typeof value !== 'object') return value;
  if (key && Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  return value;
}

function toBalance(value: any): Balance {
  if (typeof value === 'number') return { confirmed: value, unconfirmed: 0, total: value };
  if (value && typeof value === 'object') {
    const confirmed = Number(value.confirmed || 0);
    const unconfirmed = Number(value.unconfirmed || 0);
    const total = value.total === undefined ? confirmed + unconfirmed : Number(value.total);
    return { confirmed, unconfirmed, total, network: value.network };
  }
  return { confirmed: 0, unconfirmed: 0, total: 0 };
}

function assertOpReturn(payload: string, isHex: boolean) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('opReturn payload must be a non-empty string');
  }
  if (isHex) {
    if (payload.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(payload)) {
      throw new Error('opReturn payload must be valid hex when payloadIsHex is set');
    }
    if (payload.length / 2 > MAX_OP_RETURN_BYTES) {
      throw new Error(`opReturn payload exceeds ${MAX_OP_RETURN_BYTES} bytes`);
    }
    return;
  }
  if (payload.length > MAX_OP_RETURN_BYTES) {
    throw new Error(`opReturn payload exceeds ${MAX_OP_RETURN_BYTES} bytes`);
  }
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

  /* ---------------------------------------------------- connection */

  /** Ask the user to connect. Resolves with the connected address. */
  connect(options?: { name?: string; icon?: string }): Promise<Address>;
  /** Same as `connect`, but keeps the wallet's `{address, network, name, origin}`. */
  connectInfo(options?: { name?: string; icon?: string }): Promise<ConnectResult>;
  isConnected(): Promise<boolean>;
  getProviderState(): Promise<ProviderState>;
  getVersion(): Promise<string>;
  getNetwork(): Promise<NetworkType>;
  /** Ask the user to switch network. Resolves with the new network. */
  switchNetwork(network: NetworkType): Promise<NetworkType>;

  /* ---------------------------------------------------------- chains */

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

  /* ------------------------------------------------------- account */

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

  /* -------------------------------------------------- sign and send */

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
  sendWithOpReturn(
    toAddress: Address,
    satoshis: number,
    payload: string,
    options?: SendWithOpReturnOptions & { payloadIsHex?: boolean },
  ): Promise<Txid>;
  /** Broadcast a signed hex through an Electrs/esplora `POST /tx` endpoint. */
  broadcastTx(rawTxHex: RawTxHex, electrsUrl: string): Promise<Txid>;
  /** Sign several PSBTs in one prompt. Resolves with the signed base64 PSBTs. */
  multiPsbtSign(batch: MultiSignPsbtOptions[]): Promise<PsbtBase64[]>;

  /* --------------------------------------------------------- events */

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
export function createDedooClient(provider: AnyProvider, options: DedooClientOptions = {}): DedooClient {
  if (!provider) throw new Error('createDedooClient: provider is required');

  const client: DedooClient = {
    provider,
    brand: options.brand,

    async connect(connectOptions) {
      return unwrap(await call(provider, 'connect', connectOptions ? [connectOptions] : []), 'address');
    },
    async connectInfo(connectOptions) {
      return unwrap(await call(provider, 'connect', connectOptions ? [connectOptions] : []));
    },
    async isConnected() {
      return !!(await call(provider, 'isConnected', []));
    },
    async getProviderState() {
      return unwrap(await call(provider, 'getProviderState', []));
    },
    async getVersion() {
      return String((await call(provider, 'getVersion', [])) || '');
    },
    async getNetwork() {
      return unwrap(await call(provider, 'getNetwork', []), 'network');
    },
    async switchNetwork(network) {
      return unwrap(await call(provider, 'switchNetwork', [network]), 'network');
    },
    async getChain() {
      return unwrap(await call(provider, 'getChain', []));
    },
    async getChainId() {
      const chain = await client.getChain();
      return chain && chain.id ? chain.id : '';
    },
    async getChains() {
      const chains = await call(provider, 'getChains', []);
      return Array.isArray(chains) ? chains : [];
    },
    async switchChain(chainId) {
      if (typeof chainId !== 'string' || !chainId) throw new Error('switchChain: chainId is required');
      return unwrap(await call(provider, 'switchChain', [chainId]), 'chainId');
    },
    async ensureChain(chainId, ensureOptions = {}) {
      if (typeof chainId !== 'string' || !chainId) throw new Error('ensureChain: chainId is required');
      let current: ChainId | undefined;
      try {
        current = await client.getChainId();
      } catch {
        // No chain concept on this wallet: nothing to enforce, and nothing to
        // refuse — treating it as a mismatch would break Unisat-style wallets.
        return undefined;
      }
      if (!current) return undefined;
      if (current === chainId) return current;
      try {
        await client.switchChain(chainId);
      } catch {
        // The user declined (or the wallet refused). Re-read so we report the
        // chain the wallet is really on rather than assuming either way.
        const actual = await client.getChainId().catch(() => current);
        if (ensureOptions.throwOnMismatch) throw new ChainMismatchError(chainId, actual);
        return actual || current;
      }
      const after = await client.getChainId().catch(() => undefined);
      if (after && after !== chainId && ensureOptions.throwOnMismatch) {
        throw new ChainMismatchError(chainId, after);
      }
      return after || chainId;
    },
    async keepAlive() {
      return (await call(provider, 'keepAlive', [])) || false;
    },

    async getAccount() {
      return unwrap(await call(provider, 'getAccount', []), 'address');
    },
    async getAccountInfo() {
      const name = await call(provider, 'getAccountName', []);
      if (name && typeof name === 'object' && 'address' in name) return name as AccountInfo;
      const address = await call(provider, 'getAccount', []);
      return {
        id: 0,
        name: typeof name === 'string' ? name : '',
        address: unwrap(address, 'address'),
        type: 'hd',
      } as AccountInfo;
    },
    async getAccountName() {
      return unwrap(await call(provider, 'getAccountName', []), 'name');
    },
    async getPublicKey() {
      return unwrap(await call(provider, 'getPublicKey', []), 'publicKey');
    },
    async getAddresses() {
      return unwrap(await call(provider, 'getAddresses', []));
    },
    async getBalance() {
      return toBalance(await call(provider, 'getBalance', []));
    },
    async getFeeRates() {
      return unwrap(await call(provider, 'getFeeRates', []));
    },

    async signMessage(message, address) {
      return unwrap(await call(provider, 'signMessage', address ? [message, address] : [message]), 'signature');
    },
    async signMessageInfo(message, address) {
      return unwrap(await call(provider, 'signMessage', address ? [message, address] : [message]));
    },
    async createTx(payload) {
      return unwrap(await call(provider, 'createTx', [payload]), 'hex');
    },
    async createTxInfo(payload) {
      return unwrap(await call(provider, 'createTx', [payload]));
    },
    async signPsbt(psbtBase64, signOptions) {
      return unwrap(await call(provider, 'signPsbt', [psbtBase64, signOptions]), 'psbt');
    },
    async sendTx(rawTxHex) {
      return unwrap(await call(provider, 'sendTx', [rawTxHex]), 'txid');
    },
    async sendTxInfo(rawTxHex) {
      return unwrap(await call(provider, 'sendTx', [rawTxHex]));
    },
    async sendBitcoin(toAddress, satoshis, sendOptions = {}) {
      const hex = await client.createTx({
        to: toAddress,
        amount: satoshis,
        feeRate: sendOptions.feeRate,
      });
      return client.sendTx(hex);
    },
    async sendWithOpReturn(toAddress, satoshis, payload, sendOptions: any = {}) {
      const payloadIsHex = sendOptions.payloadIsHex === true;
      assertOpReturn(payload, payloadIsHex);
      const hex = await client.createTx({
        to: toAddress,
        amount: satoshis,
        feeRate: sendOptions.feeRate,
        opReturn: payload,
        opReturnIsHex: payloadIsHex,
      });
      if (sendOptions.electrsUrl) return broadcastRawTx(sendOptions.electrsUrl, hex);
      return client.sendTx(hex);
    },
    async broadcastTx(rawTxHex, electrsUrl) {
      return broadcastRawTx(electrsUrl, rawTxHex);
    },
    async multiPsbtSign(batch) {
      return Promise.all(batch.map((item) => client.signPsbt(item.psbtBase64, item.options)));
    },

    on(event, handler) {
      const p = provider as any;
      if (typeof p.on !== 'function') throw new Error('Wallet does not emit events');
      const token = p.on(event, handler);
      if (typeof token === 'function') return token;
      return () => {
        if (typeof p.removeListener === 'function') p.removeListener(event, handler);
      };
    },
    removeListener(event, handler) {
      const p = provider as any;
      if (typeof p.removeListener === 'function') p.removeListener(event, handler);
      else if (typeof p.off === 'function') p.off(event, handler);
    },
  } as DedooClient;

  return client;
}

/**
 * Broadcast a signed transaction through an Electrs/esplora endpoint
 * (`POST {electrsUrl}/tx` with the raw hex body).
 *
 * Used when you want the user to approve only the *build* step.
 */
export async function broadcastRawTx(electrsUrl: string, rawTxHex: RawTxHex): Promise<Txid> {
  if (!electrsUrl) throw new Error('broadcastRawTx: electrsUrl is required');
  if (typeof rawTxHex !== 'string' || !rawTxHex) throw new Error('broadcastRawTx: rawTxHex is required');

  const url = `${electrsUrl.replace(/\/+$/, '')}/tx`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: rawTxHex,
  });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`Broadcast failed (${res.status}): ${text}`);
  return text.split(/\s+/)[0] || text;
}
