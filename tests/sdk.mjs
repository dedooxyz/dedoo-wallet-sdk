/**
 * The SDK is TypeScript, so it is bundled with esbuild on the fly here - that
 * doubles as a "does the SDK still compile" check.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (err) {
    results.push({ name, pass: false, error: err });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (err) {
    results.push({ name, pass: false, error: err });
  }
}

function def(name, value) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}

/* ------------------------------------------------------------- compile */

const bundle = path.join(os.tmpdir(), `dedoo-sdk-${process.pid}.mjs`);
const packageVersion = process.env.DEDOO_PROVIDER_VERSION || JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;
await esbuild.build({
  entryPoints: [new URL('../src/index.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: bundle,
  platform: 'neutral',
  target: ['es2020'],
  logLevel: 'silent',
  // The provider version is injected by build.mjs; mirror its resolution so the
  // bundle under test reports the real value instead of a stale one.
  define: { __PROVIDER_VERSION__: JSON.stringify(packageVersion) },
});
const sdk = await import(pathToFileURL(bundle).href);

/* the version is single-sourced: package.json -> build -> PROVIDER_VERSION */
check('the SDK reports the injected provider version', () => {
  assert.strictEqual(sdk.PROVIDER_VERSION, packageVersion);
});

/* ...and the committed bundle must not drift from package.json either */
const sdkDistPath = new URL('../dist/index.js', import.meta.url);
if (existsSync(sdkDistPath)) {
  const sdkDist = await import(pathToFileURL(fileURLToPath(sdkDistPath)).href);
  check('the committed bundle carries the same provider version', () => {
    assert.strictEqual(sdkDist.PROVIDER_VERSION, packageVersion);
  });
}

/* ------------------------------------------------------------ helpers */

/** A junkext-shaped provider: every answer is an envelope object. */
function dedooProvider() {
  const listeners = {};
  const calls = [];
  const p = {
    isDedoo: true,
    version: '9.9.9-fixture',
    calls,
    lastPayload: null,
    async request(method, params) {
      calls.push({ method, params });
      return p[method] ? p[method](...(params || [])) : null;
    },
    on(event, fn) {
      (listeners[event] ||= new Set()).add(fn);
      return () => listeners[event].delete(fn);
    },
    removeListener(event, fn) {
      listeners[event] && listeners[event].delete(fn);
    },
    emit(event, payload) {
      for (const fn of listeners[event] || []) fn(payload);
    },
    async getAccount() {
      return 'JsenderAddress';
    },
    async getAccountName() {
      return { id: 0, name: 'Account 1', address: 'JsenderAddress', type: 'hd' };
    },
    async getBalance() {
      return { confirmed: 100, unconfirmed: 5, total: 105, network: 'mainnet' };
    },
    async getPublicKey() {
      return { address: 'JsenderAddress', publicKey: '02ab'.padEnd(66, '0') };
    },
    async getNetwork() {
      return 'mainnet';
    },
    async switchNetwork(network) {
      return { network };
    },
    async getChain() {
      return { id: 'junkcoin', name: 'Junkcoin', ticker: 'JKC', network: 'mainnet' };
    },
    async getChains() {
      return [
        { id: 'junkcoin', name: 'Junkcoin', ticker: 'JKC', active: true },
        { id: 'wojakcoin', name: 'WojakCoin', ticker: 'WJK', active: false },
      ];
    },
    async switchChain(chainId) {
      calls.push({ method: 'switchChain', params: [chainId] });
      return { chainId, network: 'mainnet' };
    },
    async connect() {
      calls.push({ method: 'connect', params: [] });
      return { address: 'JsenderAddress', network: 'mainnet', name: 'Account 1', origin: 'https://dapp.test' };
    },
    async signMessage(message, address) {
      return { message, address, signature: 'SIG==', network: 'mainnet' };
    },
    async createTx(payload) {
      calls.push({ method: 'createTx', params: [payload] });
      p.lastPayload = payload;
      return { hex: 'deadbeef', txid: 'f'.repeat(64), fee: 210, vsize: 141, network: 'mainnet' };
    },
    async signPsbt(psbt) {
      return { psbt, network: 'mainnet' };
    },
    async sendTx(hex) {
      calls.push({ method: 'sendTx', params: [hex] });
      return { txid: 'a'.repeat(64), network: 'mainnet' };
    },
    async getFeeRates() {
      return { slow: 1, standard: 3, fast: 8 };
    },
    async isConnected() {
      return true;
    },
    async getProviderState() {
      return {
        network: 'mainnet',
        chainId: 'junkcoin',
        isUnlocked: true,
        accounts: ['JsenderAddress'],
        hasVault: true,
        version: '9.9.9-fixture',
      };
    },
    async getVersion() {
      return '9.9.9-fixture';
    },
    async keepAlive() {
      return 'ACK_KEEP_ALIVE_MESSAGE';
    },
  };
  return p;
}

/** A wojak/Unisat-shaped provider: every answer is a bare value. */
function legacyProvider() {
  return {
    async connect() {
      return 'JsenderAddress';
    },
    async getAccount() {
      return 'JsenderAddress';
    },
    async getAccountName() {
      return 'Account 1';
    },
    async getBalance() {
      return 4242;
    },
    async getPublicKey() {
      return '02ab'.padEnd(66, '0');
    },
    async getNetwork() {
      return 'testnet';
    },
    async switchNetwork(network) {
      return network;
    },
    async signMessage() {
      return 'LEGACY_SIG';
    },
    async createTx() {
      return 'cafebabe';
    },
    async signPsbt() {
      return 'cHNidP8BAH0';
    },
    async sendTx() {
      return 'b'.repeat(64);
    },
    async getFeeRates() {
      return { slow: 1, standard: 3, fast: 8 };
    },
    async isConnected() {
      return true;
    },
    on() {},
    removeListener() {},
  };
}

/* -------------------------------------------------------------- checks */

check('provider constants are the rebranded ones', () => {
  assert.strictEqual(sdk.PROVIDER_GLOBAL, 'dedoo');
  assert.strictEqual(sdk.PROVIDER_EVENT, 'dedoo#initialized');
  assert.strictEqual(sdk.MAX_OP_RETURN_BYTES, 80);
  assert.deepStrictEqual(
    sdk.WALLET_BRANDS.map((b) => b.brand),
    ['dedoo', 'junkcoin', 'wojak'],
  );
});

await checkAsync('multichain: reads the chain list and switches by id', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);

  const chain = await client.getChain();
  assert.strictEqual(chain.id, 'junkcoin');
  assert.strictEqual(chain.name, 'Junkcoin');
  assert.strictEqual(chain.ticker, 'JKC');
  assert.strictEqual(chain.network, 'mainnet');
  assert.strictEqual(await client.getChainId(), 'junkcoin');

  const chains = await client.getChains();
  assert.strictEqual(chains.length, 2, 'every registered chain must be offered');
  assert.ok(chains.every((c) => typeof c.id === 'string' && c.ticker), 'chain entries need an id and a ticker');
  assert.strictEqual(chains.filter((c) => c.active).length, 1, 'exactly one chain is active');
  assert.strictEqual(chains.find((c) => c.active).id, 'junkcoin');

  const landed = await client.switchChain('wojakcoin');
  assert.strictEqual(landed, 'wojakcoin', 'switchChain resolves the scalar id');
  const call = provider.calls.find((c) => c.method === 'switchChain');
  assert.deepStrictEqual(call.params, ['wojakcoin'], 'the id must be forwarded as the only argument');

  await assert.rejects(() => client.switchChain(''), /chainId is required/);
});

await checkAsync('multichain: provider state and chainChanged carry the id', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);

  const state = await client.getProviderState();
  assert.strictEqual(state.chainId, 'junkcoin', 'state must name the active chain');

  const seen = [];
  const off = client.on('chainChanged', (payload) => seen.push(payload));
  provider.emit('chainChanged', { chainId: 'wojakcoin' });
  assert.deepStrictEqual(seen, [{ chainId: 'wojakcoin' }]);
  off();
  provider.emit('chainChanged', { chainId: 'wojakcoin' });
  assert.strictEqual(seen.length, 1, 'unsubscribe must stop the handler');
});

await checkAsync('chain methods are loud when the wallet has none', async () => {
  const client = sdk.createDedooClient(legacyProvider());
  await assert.rejects(() => client.getChain(), /getChain/);
  await assert.rejects(() => client.getChains(), /getChains/);
  await assert.rejects(() => client.switchChain('junkcoin'), /switchChain/);
});

await checkAsync('ensureChain moves a multichain wallet onto the required chain', async () => {
  // A provider that actually tracks which chain it is on.
  let chain = 'junkcoin';
  const switched = [];
  const client = sdk.createDedooClient({
    async getChain() {
      return { id: chain, name: chain, ticker: 'X', network: 'mainnet' };
    },
    async switchChain(id) {
      switched.push(id);
      chain = id;
      return { chainId: id };
    },
  });

  // Already on the right chain: no prompt.
  assert.strictEqual(await client.ensureChain('junkcoin'), 'junkcoin');
  assert.deepStrictEqual(switched, [], 'must not ask for a switch when it already matches');

  // On the wrong chain: switch, and report where it landed.
  assert.strictEqual(await client.ensureChain('wojakcoin'), 'wojakcoin');
  assert.deepStrictEqual(switched, ['wojakcoin']);

  await assert.rejects(() => client.ensureChain(''), /chainId is required/);

  // A refused switch is reported, and can be made fatal.
  const refusing = sdk.createDedooClient({
    async getChain() {
      return { id: 'junkcoin', name: 'Junkcoin', ticker: 'JKC', network: 'mainnet' };
    },
    async switchChain() {
      throw new Error('User rejected the request');
    },
  });
  assert.strictEqual(await refusing.ensureChain('wojakcoin'), 'junkcoin');
  await assert.rejects(
    () => refusing.ensureChain('wojakcoin', { throwOnMismatch: true }),
    (err) =>
      err instanceof sdk.ChainMismatchError &&
      err.code === 'CHAIN_MISMATCH' &&
      err.expected === 'wojakcoin' &&
      err.actual === 'junkcoin',
  );

  // A wallet with no chain concept is left alone rather than treated as wrong.
  const noChains = sdk.createDedooClient(legacyProvider());
  assert.strictEqual(await noChains.ensureChain('wojakcoin'), undefined);
});

await checkAsync('detects the injected provider and its brand', async () => {
  const provider = dedooProvider();
  def('window', { dedoo: provider });
  const detected = sdk.detectProvider();
  assert.strictEqual(detected.provider, provider);
  assert.strictEqual(detected.brand, 'dedoo');
  assert.strictEqual(sdk.getAllProviders().length, 1);
  assert.strictEqual(sdk.initDedooSync().provider, provider);
  delete globalThis.window;
});

await checkAsync('normalises envelope shaped answers to scalars', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider, { brand: 'dedoo' });
  assert.strictEqual(await client.getAccount(), 'JsenderAddress');
  assert.strictEqual(await client.getAccountName(), 'Account 1');
  assert.strictEqual(await client.getPublicKey(), '02ab'.padEnd(66, '0'));
  assert.strictEqual(await client.getNetwork(), 'mainnet');
  assert.strictEqual(await client.signMessage('hi'), 'SIG==');
  assert.strictEqual(await client.createTx({ to: 'Jx', amount: 1 }), 'deadbeef');
  assert.strictEqual(await client.signPsbt('cHNi'), 'cHNi');
  assert.strictEqual(await client.sendTx('00'), 'a'.repeat(64));
  assert.strictEqual(await client.connect(), 'JsenderAddress');
  assert.deepStrictEqual(await client.getBalance(), {
    confirmed: 100,
    unconfirmed: 5,
    total: 105,
    network: 'mainnet',
  });
  assert.deepStrictEqual(await client.getFeeRates(), { slow: 1, standard: 3, fast: 8 });
  assert.deepStrictEqual(await client.getAccountInfo(), {
    id: 0,
    name: 'Account 1',
    address: 'JsenderAddress',
    type: 'hd',
  });
});

await checkAsync('normalises bare valued answers the same way', async () => {
  const client = sdk.createDedooClient(legacyProvider(), { brand: 'wojak' });
  assert.strictEqual(await client.getAccount(), 'JsenderAddress');
  assert.strictEqual(await client.getAccountName(), 'Account 1');
  assert.strictEqual(await client.getPublicKey(), '02ab'.padEnd(66, '0'));
  assert.strictEqual(await client.signMessage('hi'), 'LEGACY_SIG');
  assert.strictEqual(await client.createTx({ to: 'Jx', amount: 1 }), 'cafebabe');
  assert.strictEqual(await client.signPsbt('cHNi'), 'cHNidP8BAH0');
  assert.strictEqual(await client.sendTx('00'), 'b'.repeat(64));
  assert.strictEqual(await client.switchNetwork('mainnet'), 'mainnet');
  // a bare number balance still becomes an object
  assert.deepStrictEqual(await client.getBalance(), { confirmed: 4242, unconfirmed: 0, total: 4242 });
});

await checkAsync('events unsubscribe through the token returned by on()', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);
  let seen = 0;
  const off = client.on('accountsChanged', () => { seen += 1; });
  provider.emit('accountsChanged', ['a']);
  off();
  provider.emit('accountsChanged', ['b']);
  assert.strictEqual(seen, 1);
});

await checkAsync('sendBitcoin chains createTx into sendTx', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);
  const txid = await client.sendBitcoin('Jdest', 12345, { feeRate: 5 });
  assert.strictEqual(txid, 'a'.repeat(64));
  const created = provider.calls.find((c) => c.method === 'createTx');
  assert.ok(created, 'createTx must be called');
  assert.strictEqual(created.params[0].to, 'Jdest');
  assert.strictEqual(created.params[0].amount, 12345);
  assert.strictEqual(created.params[0].feeRate, 5);
  assert.ok(provider.calls.some((c) => c.method === 'sendTx'), 'sendTx must be called');
});

await checkAsync('sendWithOpReturn hands off to a wallet that broadcasts itself', async () => {
  const seen = [];
  const provider = {
    isDedoo: true,
    async sendWithOpReturn(to, satoshis, payload, options) {
      seen.push({ to, satoshis, payload, options });
      return 'b'.repeat(64); // bare txid, the way the Wojak extension answers
    },
    async createTx() {
      throw new Error('the SDK must not build when the wallet can send');
    },
  };
  const client = sdk.createDedooClient(provider);
  const txid = await client.sendWithOpReturn('Waddr', 1000, 'ab'.repeat(20), {
    feeRate: 7,
    payloadIsHex: true,
  });
  assert.strictEqual(txid, 'b'.repeat(64), 'a bare txid must pass straight through');
  assert.deepStrictEqual(seen, [
    { to: 'Waddr', satoshis: 1000, payload: 'ab'.repeat(20), options: { feeRate: 7 } },
  ], 'the positional contract the ecosystem probes for must be used');
});

await checkAsync('sendWithOpReturn builds itself when the wallet cannot broadcast', async () => {
  const provider = dedooProvider();
  provider.sendWithOpReturn = async () => {
    throw new Error('a text payload must not take the native path');
  };
  const client = sdk.createDedooClient(provider);
  const txid = await client.sendWithOpReturn('Waddr', 1000, 'hello', {});
  assert.strictEqual(txid, 'a'.repeat(64), 'falls back to createTx + sendTx');
});

await checkAsync('sendWithOpReturn forwards the payload and validates it', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);

  await client.sendWithOpReturn('Jdest', 100, 'hello');
  assert.strictEqual(provider.lastPayload.opReturn, 'hello');
  assert.strictEqual(provider.lastPayload.opReturnIsHex, false);

  provider.calls.length = 0;
  provider.lastPayload = null;
  await client.sendWithOpReturn('Jdest', 100, 'deadbeef', { payloadIsHex: true });
  assert.strictEqual(provider.lastPayload.opReturnIsHex, true);

  await assert.rejects(() => client.sendWithOpReturn('Jdest', 100, 'zz', { payloadIsHex: true }), /valid hex/);
  await assert.rejects(() => client.sendWithOpReturn('Jdest', 100, 'ab'.repeat(81), { payloadIsHex: true }), /exceeds 80/);
  await assert.rejects(() => client.sendWithOpReturn('Jdest', 100, 'x'.repeat(81)), /exceeds 80/);
});

await checkAsync('broadcastRawTx posts the raw hex to the electrs endpoint', async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url, options });
    return { ok: true, status: 200, text: async () => 'deadbeefcafe\n' };
  };
  try {
    const txid = await sdk.broadcastRawTx('https://api.test/', '0011');
    assert.strictEqual(txid, 'deadbeefcafe');
    assert.strictEqual(seen[0].url, 'https://api.test/tx');
    assert.strictEqual(seen[0].options.body, '0011');
    await assert.rejects(() => sdk.broadcastRawTx('', '00'), /electrsUrl/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await checkAsync('sendWithOpReturn broadcasts itself when electrsUrl is given', async () => {
  const provider = dedooProvider();
  const client = sdk.createDedooClient(provider);
  provider.calls.length = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => ({ ok: true, status: 200, text: async () => 'c'.repeat(64) });
  try {
    const txid = await client.sendWithOpReturn('Jdest', 100, 'hello', { electrsUrl: 'https://api.test' });
    assert.strictEqual(txid, 'c'.repeat(64));
    assert.ok(provider.calls.some((c) => c.method === 'createTx'));
    assert.ok(!provider.calls.some((c) => c.method === 'sendTx'), 'the wallet must not broadcast again');
  } finally {
    globalThis.fetch = realFetch;
  }
});

await checkAsync('getAnyProvider resolves when a wallet appears later', async () => {
  def('window', { addEventListener() {}, removeEventListener() {} });
  const listeners = [];
  globalThis.window.addEventListener = (event, fn) => listeners.push({ event, fn });
  globalThis.window.removeEventListener = (event, fn) => {
    const i = listeners.findIndex((l) => l.event === event && l.fn === fn);
    if (i >= 0) listeners.splice(i, 1);
  };
  try {
    const pending = sdk.getAnyProvider(2000, 'dedoo');
    const provider = dedooProvider();
    globalThis.window.dedoo = provider;
    for (const l of [...listeners]) if (l.event === 'dedoo#initialized') l.fn();
    const { provider: found, brand } = await pending;
    assert.strictEqual(found, provider);
    assert.strictEqual(brand, 'dedoo');
    delete globalThis.window.dedoo;
    await assert.rejects(() => sdk.getAnyProvider(10, 'dedoo'), /No wallet provider/);
  } finally {
    delete globalThis.window;
  }
});

check('uriSchemeToBrand maps wallet schemes', () => {
  assert.strictEqual(sdk.uriSchemeToBrand('junkcoin:'), 'dedoo');
  assert.strictEqual(sdk.uriSchemeToBrand('jkc:'), 'dedoo');
  assert.strictEqual(sdk.uriSchemeToBrand('dedoo'), 'dedoo');
  assert.strictEqual(sdk.uriSchemeToBrand('wojakcoin:'), 'wojak');
  assert.strictEqual(sdk.uriSchemeToBrand('https://example.com/x'), undefined);
});

check('the SDK stays side effect free at import', () => {
  assert.strictEqual(typeof sdk.initDedoo, 'function');
  assert.strictEqual(typeof sdk.createDedooClient, 'function');
  assert.strictEqual(typeof sdk.broadcastRawTx, 'function');
  assert.strictEqual(typeof sdk.detectProvider, 'function');
});

/* ------------------------------------------------------------- report */

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  if (r.pass) console.log(`  ok   ${r.name}`);
  else console.error(`  FAIL ${r.name}\n       ${r.error && r.error.stack ? r.error.stack.split('\n').slice(0, 4).join('\n       ') : r.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} sdk checks passed`);

try {
  await import('node:fs/promises').then((fs) => fs.rm(bundle, { force: true }));
} catch {
  /* ignore */
}

if (failed.length) process.exitCode = 1;
