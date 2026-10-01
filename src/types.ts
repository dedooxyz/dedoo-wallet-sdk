/** An address on whatever chain the wallet is on — `jc1…`/`W…`/`J…`, etc. */
export type Address = string;

/** A transaction id (hex). */
export type Txid = string;

/** A fully signed, not-yet-broadcast transaction (hex). */
export type RawTxHex = string;

/** A PSBT serialized as base64. */
export type PsbtBase64 = string;

/** Networks the wallet exposes to dapps. */
export type NetworkType = 'mainnet' | 'testnet';

/**
 * A chain id as the wallet names it (`'junkcoin'`, `'wojakcoin'`, …).
 *
 * Ids are wallet-defined: read them from {@link DedooClient.getChains} rather
 * than hardcoding, so a wallet that registers another chain just works.
 */
export type ChainId = string;

/** A chain the wallet can switch to. */
export interface ChainInfo {
  id: ChainId;
  name: string;
  ticker: string;
}

/** The chain the wallet is currently on, plus the network under it. */
export interface ActiveChain extends ChainInfo {
  network: NetworkType;
}

/** {@link ChainInfo} as reported by {@link DedooClient.getChains}. */
export interface ListedChain extends ChainInfo {
  /** True for the chain the wallet is on right now. */
  active: boolean;
}

/** Events emitted by the provider. */
export type DedooEvent =
  | 'connect'
  | 'disconnect'
  | 'close'
  | 'accountsChanged'
  | 'networkChanged'
  | 'chainChanged';

/** Handler registered through {@link IDedooProvider.on}. */
export type EventHandler = (payload: any) => void;

/** Account id — numeric for HD/imported accounts, whatever the wallet reports. */
export type AccountId = number | string;

/** Confirmed / pending / total balances, all in satoshis. */
export interface Balance {
  confirmed: number;
  unconfirmed: number;
  /** `confirmed + unconfirmed`. */
  total: number;
  network?: NetworkType;
}

/** Sat/vbyte fee estimates for the three speed tiers. */
export interface FeeRates {
  slow: number;
  standard: number;
  fast: number;
}

/** What the wallet reports about its current session to a dapp. */
export interface ProviderState {
  network: NetworkType;
  /** The wallet's active chain. Absent on wallets that predate multichain. */
  chainId?: ChainId;
  isUnlocked: boolean;
  /** Only populated once the site has connected. */
  accounts: Address[];
  hasVault: boolean;
  version: string | null;
}

/** The connected account as the wallet describes it. */
export interface AccountInfo {
  id: AccountId;
  name: string;
  address: Address;
  type: 'hd' | 'imported';
}

/** Receive/change addresses the wallet is willing to hand out to this origin. */
export interface AddressesResult {
  address: Address | null;
  receive: Address[];
  change: Address[];
}

/** Resolved by {@link IDedooProvider.connect} after the user approves. */
export interface ConnectResult {
  address: Address;
  network: NetworkType;
  chainId?: ChainId;
  name: string;
  origin: string;
}

/** Resolved by {@link IDedooProvider.signMessage}. */
export interface SignMessageResult {
  message: string;
  address: Address;
  /** 65-byte recovery signature, base64. */
  signature: string;
  network: NetworkType;
  chainId?: ChainId;
}

/** Resolved by {@link IDedooProvider.createTx} — built and signed, not broadcast. */
export interface CreateTxResult {
  hex: RawTxHex;
  txid: Txid;
  fee: number;
  vsize: number;
  estimatedFeeRate?: number;
  network: NetworkType;
  chainId?: ChainId;
}

/** Resolved by {@link IDedooProvider.signPsbt}. */
export interface SignPsbtResult {
  /** The PSBT, finalised when `autoFinalize` was not disabled. */
  psbt: PsbtBase64;
  network: NetworkType;
  chainId?: ChainId;
}

/** Resolved by {@link IDedooProvider.sendTx}. */
export interface SendTxResult {
  txid: Txid;
  network: NetworkType;
  chainId?: ChainId;
}

/** A UTXO as dapps model it (the provider does not serve UTXOs directly). */
export interface Utxo {
  txid: Txid;
  vout: number;
  /** Value in satoshis. */
  satoshis: number;
  address?: Address;
  scriptPubKey?: string;
  /** Confirmations; 0 while still in the mempool. */
  confirmations?: number;
  height?: number | null;
}
