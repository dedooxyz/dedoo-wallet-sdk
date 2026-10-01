# dedoo-sdk

TypeScript client for the **Dedoo Extension Wallet** dapp provider (`window.dedoo`), multichain aware.

It talks to the provider the extension injects into every page, and it also speaks the
Unisat-style surface exposed by `window.junkcoin` / `window.wojak`, so one client works
against all of them. Envelope answers (`{address, network, …}`) and bare scalar answers
are normalised to the same shape.

## Install

```bash
npm install github:dedooxyz/dedoo-wallet-sdk
```

## Quick start

```ts
import { initDedoo } from 'dedoo-sdk';

const dedoo = await initDedoo();          // waits for the provider to inject
const address = await dedoo.connect();    // opens the wallet's approval prompt
const txid = await dedoo.sendBitcoin(address, 10_000);
```

Detection is explicit when you would rather not wait:

```ts
import { detectProvider, getAllProviders, createDedooClient } from 'dedoo-sdk';

const detected = detectProvider();                 // { provider, brand } | undefined
const all = getAllProviders();                     // every injected wallet
if (detected) {
  const client = createDedooClient(detected.provider, { brand: detected.brand });
}
```

## Chains

Chain ids are **wallet-defined**: read them from `getChains()` rather than hardcoding,
so a wallet that registers another chain just works.

```ts
const chains = await client.getChains();   // [{ id, name, ticker, active }]
const chain  = await client.getChain();    // { id, name, ticker, network }
```

A dapp that only works on one chain should say so, and let the SDK move the wallet
before it reads chain-specific state or signs anything:

```ts
await client.ensureChain('wojakcoin', { throwOnMismatch: true });
const balance = await client.getBalance();   // now definitely WojakCoin
```

`ensureChain` never prompts when the chain already matches, leaves wallets with no
chain concept alone (it resolves `undefined`), and reports a refused switch either as
the chain the wallet stayed on or as a thrown `ChainMismatchError` when
`throwOnMismatch` is set.

## API surface

| Area | Methods |
| --- | --- |
| Connection | `connect`, `connectInfo`, `isConnected`, `disconnect` is the wallet's |
| Chains | `getChain`, `getChainId`, `getChains`, `switchChain`, `ensureChain` |
| Account | `getAccount`, `getAccountInfo`, `getAccountName`, `getPublicKey`, `getAddresses` |
| Balances | `getBalance`, `getFeeRates` |
| Sign / send | `signMessage`, `createTx`, `signPsbt`, `sendTx`, `sendBitcoin`, `sendWithOpReturn`, `multiPsbtSign` |
| Misc | `getProviderState`, `getVersion`, `keepAlive`, `broadcastTx`, `on`, `removeListener` |

Methods that move funds or sign data open an approval prompt inside the wallet and only
resolve once the user approves. `broadcastRawTx(url, hex)` is exported standalone for
pushing a signed transaction to an Electrs/esplora endpoint yourself.

## Build

```bash
npm install
npm run build      # dist/index.js (ESM), dist/index.cjs (CJS), dist/*.d.ts
npm run typecheck
```

The provider API version is injected at build time, never repeated in the source. It is
resolved from `DEDOO_PROVIDER_VERSION` if set, otherwise from the wallet package when
this checkout sits inside the wallet monorepo (`<wallet>/sdk`), otherwise from this
package's own version.

## License

Not yet specified.
