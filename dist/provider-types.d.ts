import type { Address, PsbtBase64, Utxo } from './types.js';
/** Payload for {@link IDedooProvider.createTx}. */
export interface CreateTxPayload {
    to: Address;
    /** Amount in satoshis (1 JKC = 100,000,000 sats). */
    amount: number;
    /**
     * Accepted for `wojak-sdk` compatibility. The wallet always funds the fee
     * from the sender's change output, so this flag is ignored.
     */
    receiverToPayFee?: boolean;
    /** Sat/vbyte. The wallet uses its own estimate when omitted. */
    feeRate?: number;
    /**
     * Optional `OP_RETURN` payload. With `opReturnIsHex: true` the value is
     * decoded as hex, producing the script `6a<hex>`; otherwise it is encoded
     * as UTF-8 text.
     */
    opReturn?: string;
    /** Treat {@link CreateTxPayload.opReturn} as hex instead of UTF-8. Default `false`. */
    opReturnIsHex?: boolean;
    /** Enable BIP125 replace-by-fee. Default `true` unless the wallet says otherwise. */
    rbf?: boolean;
    /** Spend exactly these UTXOs instead of letting the wallet pick. */
    selected?: Utxo[];
}
/**
 * Options for {@link DedooClient.sendBitcoin}.
 *
 * `memo` / `memos` are a `wojak-sdk` convention this wallet does not implement;
 * they are forwarded but may be ignored. Use
 * {@link sendBitcoinWithOpReturn} when the payload has to land on chain.
 */
export interface SendBitcoinOptions {
    feeRate?: number;
    memo?: string;
    memos?: string[];
}
/** Options for {@link sendBitcoinWithOpReturn}. */
export interface SendWithOpReturnOptions {
    /** Sat/vbyte fee rate. The wallet picks its default when omitted. */
    feeRate?: number;
    /**
     * Electrs-compatible base URL. When present the SDK broadcasts the signed
     * hex itself and the user only approves the *build* step. Without it the
     * wallet broadcasts through its own `sendTx` (a second approval).
     */
    electrsUrl?: string;
}
interface BaseUserToSignInput {
    index: number;
    sighashTypes?: number[];
    disableTweakSigner?: boolean;
}
export interface AddressUserToSignInput extends BaseUserToSignInput {
    address: Address;
}
export interface PublicKeyUserToSignInput extends BaseUserToSignInput {
    publicKey: string;
}
export type UserToSignInput = AddressUserToSignInput | PublicKeyUserToSignInput;
/** Options for {@link IDedooProvider.signPsbt} / {@link DedooClient.signPsbt}. */
export interface SignPsbtOptions {
    /**
     * Finalise every input before returning. Accepts both this spelling and the
     * `wojak-sdk` spelling `autoFinalized`.
     */
    autoFinalize?: boolean;
    /** Alias of {@link SignPsbtOptions.autoFinalize} (the `wojak-sdk` spelling). */
    autoFinalized?: boolean;
    /** Restrict signing to these inputs; every input is signed when omitted. */
    toSignInputs?: (number | UserToSignInput)[];
}
/** One item of a {@link DedooClient.multiPsbtSign} batch. */
export interface MultiSignPsbtOptions {
    psbtBase64: PsbtBase64;
    options?: SignPsbtOptions;
}
export {};
//# sourceMappingURL=provider-types.d.ts.map