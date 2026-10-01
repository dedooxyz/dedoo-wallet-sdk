/*! dedoo-wallet-sdk v0.1.0 */

// src/client.ts
var MAX_OP_RETURN_BYTES = 80;
var ChainMismatchError = class extends Error {
  constructor(expected, actual) {
    super(
      actual ? `Wallet is on chain "${actual}", expected "${expected}"` : `Wallet chain is unknown, expected "${expected}"`
    );
    this.expected = expected;
    this.actual = actual;
    this.code = "CHAIN_MISMATCH";
    this.name = "ChainMismatchError";
  }
};
async function call(provider, method, args = []) {
  const fn = provider[method];
  if (typeof fn === "function") return fn.apply(provider, args);
  if (typeof provider.request === "function") return provider.request(method, args);
  throw new Error(`Wallet does not implement ${method}`);
}
function unwrap(value, key) {
  if (value === null || typeof value !== "object") return value;
  if (key && Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  return value;
}
function toBalance(value) {
  if (typeof value === "number") return { confirmed: value, unconfirmed: 0, total: value };
  if (value && typeof value === "object") {
    const confirmed = Number(value.confirmed || 0);
    const unconfirmed = Number(value.unconfirmed || 0);
    const total = value.total === void 0 ? confirmed + unconfirmed : Number(value.total);
    return { confirmed, unconfirmed, total, network: value.network };
  }
  return { confirmed: 0, unconfirmed: 0, total: 0 };
}
function assertOpReturn(payload, isHex) {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("opReturn payload must be a non-empty string");
  }
  if (isHex) {
    if (payload.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(payload)) {
      throw new Error("opReturn payload must be valid hex when payloadIsHex is set");
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
function createDedooClient(provider, options = {}) {
  if (!provider) throw new Error("createDedooClient: provider is required");
  const client = {
    provider,
    brand: options.brand,
    async connect(connectOptions) {
      return unwrap(await call(provider, "connect", connectOptions ? [connectOptions] : []), "address");
    },
    async connectInfo(connectOptions) {
      return unwrap(await call(provider, "connect", connectOptions ? [connectOptions] : []));
    },
    async isConnected() {
      return !!await call(provider, "isConnected", []);
    },
    async getProviderState() {
      return unwrap(await call(provider, "getProviderState", []));
    },
    async getVersion() {
      return String(await call(provider, "getVersion", []) || "");
    },
    async getNetwork() {
      return unwrap(await call(provider, "getNetwork", []), "network");
    },
    async switchNetwork(network) {
      return unwrap(await call(provider, "switchNetwork", [network]), "network");
    },
    async getChain() {
      return unwrap(await call(provider, "getChain", []));
    },
    async getChainId() {
      const chain = await client.getChain();
      return chain && chain.id ? chain.id : "";
    },
    async getChains() {
      const chains = await call(provider, "getChains", []);
      return Array.isArray(chains) ? chains : [];
    },
    async switchChain(chainId) {
      if (typeof chainId !== "string" || !chainId) throw new Error("switchChain: chainId is required");
      return unwrap(await call(provider, "switchChain", [chainId]), "chainId");
    },
    async ensureChain(chainId, ensureOptions = {}) {
      if (typeof chainId !== "string" || !chainId) throw new Error("ensureChain: chainId is required");
      let current;
      try {
        current = await client.getChainId();
      } catch {
        return void 0;
      }
      if (!current) return void 0;
      if (current === chainId) return current;
      try {
        await client.switchChain(chainId);
      } catch {
        const actual = await client.getChainId().catch(() => current);
        if (ensureOptions.throwOnMismatch) throw new ChainMismatchError(chainId, actual);
        return actual || current;
      }
      const after = await client.getChainId().catch(() => void 0);
      if (after && after !== chainId && ensureOptions.throwOnMismatch) {
        throw new ChainMismatchError(chainId, after);
      }
      return after || chainId;
    },
    async keepAlive() {
      return await call(provider, "keepAlive", []) || false;
    },
    async getAccount() {
      return unwrap(await call(provider, "getAccount", []), "address");
    },
    async getAccountInfo() {
      const name = await call(provider, "getAccountName", []);
      if (name && typeof name === "object" && "address" in name) return name;
      const address = await call(provider, "getAccount", []);
      return {
        id: 0,
        name: typeof name === "string" ? name : "",
        address: unwrap(address, "address"),
        type: "hd"
      };
    },
    async getAccountName() {
      return unwrap(await call(provider, "getAccountName", []), "name");
    },
    async getPublicKey() {
      return unwrap(await call(provider, "getPublicKey", []), "publicKey");
    },
    async getAddresses() {
      return unwrap(await call(provider, "getAddresses", []));
    },
    async getBalance() {
      return toBalance(await call(provider, "getBalance", []));
    },
    async getFeeRates() {
      return unwrap(await call(provider, "getFeeRates", []));
    },
    async signMessage(message, address) {
      return unwrap(await call(provider, "signMessage", address ? [message, address] : [message]), "signature");
    },
    async signMessageInfo(message, address) {
      return unwrap(await call(provider, "signMessage", address ? [message, address] : [message]));
    },
    async createTx(payload) {
      return unwrap(await call(provider, "createTx", [payload]), "hex");
    },
    async createTxInfo(payload) {
      return unwrap(await call(provider, "createTx", [payload]));
    },
    async signPsbt(psbtBase64, signOptions) {
      return unwrap(await call(provider, "signPsbt", [psbtBase64, signOptions]), "psbt");
    },
    async sendTx(rawTxHex) {
      return unwrap(await call(provider, "sendTx", [rawTxHex]), "txid");
    },
    async sendTxInfo(rawTxHex) {
      return unwrap(await call(provider, "sendTx", [rawTxHex]));
    },
    async sendBitcoin(toAddress, satoshis, sendOptions = {}) {
      const hex = await client.createTx({
        to: toAddress,
        amount: satoshis,
        feeRate: sendOptions.feeRate
      });
      return client.sendTx(hex);
    },
    async sendWithOpReturn(toAddress, satoshis, payload, sendOptions = {}) {
      const payloadIsHex = sendOptions.payloadIsHex === true;
      assertOpReturn(payload, payloadIsHex);
      const native = provider.sendWithOpReturn;
      if (payloadIsHex && typeof native === "function") {
        const txid = await call(provider, "sendWithOpReturn", [
          toAddress,
          satoshis,
          payload,
          { feeRate: sendOptions.feeRate }
        ]);
        return unwrap(txid, "txid");
      }
      const hex = await client.createTx({
        to: toAddress,
        amount: satoshis,
        feeRate: sendOptions.feeRate,
        opReturn: payload,
        opReturnIsHex: payloadIsHex
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
      const p = provider;
      if (typeof p.on !== "function") throw new Error("Wallet does not emit events");
      const token = p.on(event, handler);
      if (typeof token === "function") return token;
      return () => {
        if (typeof p.removeListener === "function") p.removeListener(event, handler);
      };
    },
    removeListener(event, handler) {
      const p = provider;
      if (typeof p.removeListener === "function") p.removeListener(event, handler);
      else if (typeof p.off === "function") p.off(event, handler);
    }
  };
  return client;
}
async function broadcastRawTx(electrsUrl, rawTxHex) {
  if (!electrsUrl) throw new Error("broadcastRawTx: electrsUrl is required");
  if (typeof rawTxHex !== "string" || !rawTxHex) throw new Error("broadcastRawTx: rawTxHex is required");
  const url = `${electrsUrl.replace(/\/+$/, "")}/tx`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: rawTxHex
  });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`Broadcast failed (${res.status}): ${text}`);
  return text.split(/\s+/)[0] || text;
}

// src/index.ts
var PROVIDER_GLOBAL = "dedoo";
var PROVIDER_EVENT = "dedoo#initialized";
var PROVIDER_VERSION = "0.1.0";
var WALLET_BRANDS = [
  { brand: "dedoo", global: "dedoo", event: "dedoo#initialized" },
  { brand: "junkcoin", global: "junkcoin", event: "junkcoin#initialized" },
  { brand: "wojak", global: "wojak", event: "wojak#initialized" }
];
var LEGACY_GLOBALS = ["junkext", "junkcoin", "wojak"];
function win() {
  return typeof window !== "undefined" ? window : void 0;
}
function detectProvider(preferredBrand) {
  const w = win();
  if (!w) return void 0;
  const ordered = preferredBrand ? [...WALLET_BRANDS].sort((a, b) => a.brand === preferredBrand ? -1 : b.brand === preferredBrand ? 1 : 0) : [...WALLET_BRANDS];
  for (const entry of ordered) {
    const provider = w[entry.global];
    if (provider) return { provider, brand: entry.brand };
  }
  if (w.junkext) return { provider: w.junkext, brand: "dedoo" };
  return void 0;
}
function getAllProviders() {
  const w = win();
  if (!w) return [];
  const found = [];
  for (const entry of WALLET_BRANDS) {
    const provider = w[entry.global];
    if (provider && !found.some((d) => d.provider === provider)) found.push({ provider, brand: entry.brand });
  }
  if (w.junkext && !found.some((d) => d.provider === w.junkext)) {
    found.push({ provider: w.junkext, brand: "dedoo" });
  }
  return found;
}
function getAnyProvider(timeout = 5e3, preferredBrand) {
  const immediate = detectProvider(preferredBrand) || getAllProviders()[0];
  if (immediate) return Promise.resolve(immediate);
  return new Promise((resolve, reject) => {
    const w = win();
    if (!w) {
      reject(new Error("Not a browser environment: no provider to detect"));
      return;
    }
    let settled = false;
    const finish = (value) => {
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
async function initDedoo(timeout = 5e3, preferredBrand = "dedoo") {
  const { provider, brand } = await getAnyProvider(timeout, preferredBrand);
  return createDedooClient(provider, { brand });
}
function uriSchemeToBrand(scheme) {
  const key = String(scheme).toLowerCase().replace(/^https?:\/\//, "").replace(/^\/\//, "").replace(/:.*$/, "").replace(/\/.*$/, "");
  switch (key) {
    case "dedoo":
    case "ded":
    case "dedooext":
    case "junkext":
    case "junkcoin":
    case "jkc":
      return "dedoo";
    case "wojak":
    case "wojakcoin":
      return "wojak";
    case "junkcoinext":
      return "junkcoin";
    default:
      return void 0;
  }
}
function initDedooSync(preferredBrand = "dedoo") {
  const detected = detectProvider(preferredBrand);
  return detected ? createDedooClient(detected.provider, { brand: detected.brand }) : void 0;
}
export {
  ChainMismatchError,
  LEGACY_GLOBALS,
  MAX_OP_RETURN_BYTES,
  PROVIDER_EVENT,
  PROVIDER_GLOBAL,
  PROVIDER_VERSION,
  WALLET_BRANDS,
  broadcastRawTx,
  createDedooClient,
  detectProvider,
  getAllProviders,
  getAnyProvider,
  initDedoo,
  initDedooSync,
  uriSchemeToBrand
};
//# sourceMappingURL=index.js.map
