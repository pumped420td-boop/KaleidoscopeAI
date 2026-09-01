import { createHmac } from "node:crypto";
import { store } from "./store.js";
import { logger } from "./logger.js";
import type { OHLCCandle } from "./store.js";

// ── Binance.US REST API client ───────────────────────────────────────────────

const BASE_URL = "https://api.binance.us";
const OHLC_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function sign(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

async function publicGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "BinanceTradingBot/1.0" },
    signal: withTimeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Binance.US public request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function privateRequest<T>(
  path: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" | "DELETE" = "GET"
): Promise<T> {
  if (!store.apiKey || !store.apiSecret) throw new Error("API keys not configured");
  const timestamp = Date.now().toString();
  const allParams = { ...params, timestamp };
  const queryString = new URLSearchParams(allParams).toString();
  const signature = sign(queryString, store.apiSecret);
  const url = `${BASE_URL}${path}?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": store.apiKey,
      "User-Agent": "BinanceTradingBot/1.0",
    },
    signal: withTimeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance.US ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function fetchOHLC(pair: string): Promise<OHLCCandle[]> {
  const cached = store.ohlcCache[pair];
  if (cached && Date.now() - cached.lastUpdated < OHLC_TTL_MS) {
    return cached.candles;
  }

  try {
    const data = await publicGet<(string | number)[][]>("/api/v3/klines", {
      symbol: pair,
      interval: "1h",
      limit: "100",
    });

    const candles: OHLCCandle[] = data.map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: parseFloat(String(row[1])),
      high: parseFloat(String(row[2])),
      low: parseFloat(String(row[3])),
      close: parseFloat(String(row[4])),
      vwap: parseFloat(String(row[4])),
      volume: parseFloat(String(row[5])),
    }));

    store.ohlcCache[pair] = { candles, lastUpdated: Date.now() };
    return candles;
  } catch (err) {
    logger.warn({ err, pair }, "OHLC fetch failed, using cached data");
    return store.ohlcCache[pair]?.candles ?? [];
  }
}

export async function prefetchAllOHLC(pairs: string[], concurrency = 4): Promise<void> {
  const stale = pairs.filter((p) => {
    const cached = store.ohlcCache[p];
    return !cached || Date.now() - cached.lastUpdated >= OHLC_TTL_MS - 30_000;
  });
  if (stale.length === 0) return;

  for (let i = 0; i < stale.length; i += concurrency) {
    const batch = stale.slice(i, i + concurrency);
    await Promise.all(batch.map((pair) => fetchOHLC(pair).catch(() => {})));
    if (i + concurrency < stale.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

export async function fetchBalance(): Promise<Record<string, string>> {
  const data = await privateRequest<{ balances: { asset: string; free: string }[] }>("/api/v3/account");
  return Object.fromEntries(data.balances.map((b) => [b.asset, b.free]));
}

export async function fetchUsdBalance(): Promise<number> {
  const balance = await fetchBalance();
  return parseFloat(balance["USD"] ?? "0");
}

export interface OrderResult {
  txid: string[];
  descr: { order: string };
}

export async function placeMarketBuy(pair: string, quoteQty: string): Promise<OrderResult> {
  await privateRequest("/api/v3/order", {
    symbol: pair,
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: quoteQty,
  }, "POST");
  return { txid: [`${pair}-buy-${Date.now()}`], descr: { order: `BUY $${quoteQty} of ${pair}` } };
}

export async function placeMarketSell(pair: string, quantity: string): Promise<OrderResult> {
  await privateRequest("/api/v3/order", {
    symbol: pair,
    side: "SELL",
    type: "MARKET",
    quantity,
  }, "POST");
  return { txid: [`${pair}-sell-${Date.now()}`], descr: { order: `SELL ${quantity} of ${pair}` } };
}

/** Fetch the latest traded price for a single pair directly from Binance.US. */
export async function fetchSymbolPrice(pair: string): Promise<number> {
  const data = await publicGet<{ symbol: string; price: string }>("/api/v3/ticker/price", { symbol: pair });
  const price = parseFloat(data.price);
  if (!isFinite(price) || price <= 0) throw new Error(`Invalid price for ${pair}: ${data.price}`);
  return price;
}

/** Refresh the market cache for all given Binance.US pairs in batches of 20 */
export async function updateTickerCache(pairs: string[]): Promise<void> {
  const { COINS } = await import("./coins.js");
  const BATCH = 20;

  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    try {
      const tickers = await publicGet<BinanceTicker[]>("/api/v3/ticker/24hr", {
        symbols: JSON.stringify(batch),
      });

      let updated = 0;
      const returnedPairs = new Set<string>();
      for (const t of tickers) {
        returnedPairs.add(t.symbol);
        const price = parseFloat(t.lastPrice);
        const open = parseFloat(t.openPrice);
        const coin = COINS.find((c) => c.pair === t.symbol);
        const symbol = coin?.symbol ?? t.symbol.replace(/USD$/, "");
        if (!isFinite(price) || price <= 0) {
          // Binance.US can return a zero lastPrice for an inactive market.
          // Never leave an older value in the cache as if it were current.
          delete store.marketCache[symbol];
          continue;
        }
        const change24h = open > 0 ? ((price - open) / open) * 100 : 0;

        store.marketCache[symbol] = {
          price,
          change24h,
          volume24h: parseFloat(t.quoteVolume),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          lastUpdated: Date.now(),
        };
        updated++;
      }

      // Retry missing or invalid symbols individually so one incomplete batch
      // cannot leave stale prices in the cache.
      const retryPairs = batch.filter((pair) => !returnedPairs.has(pair) ||
        !store.marketCache[COINS.find((c) => c.pair === pair)?.symbol ?? pair.replace(/USD$/, "")]);
      if (retryPairs.length > 0) {
        await Promise.all(retryPairs.map(async (pair) => {
          const coin = COINS.find((c) => c.pair === pair);
          const symbol = coin?.symbol ?? pair.replace(/USD$/, "");
          try {
            const price = await fetchSymbolPrice(pair);
            const previous = store.marketCache[symbol];
            store.marketCache[symbol] = {
              price,
              change24h: previous?.change24h ?? 0,
              volume24h: previous?.volume24h ?? 0,
              high24h: previous?.high24h ?? price,
              low24h: previous?.low24h ?? price,
              lastUpdated: Date.now(),
            };
          } catch (err) {
            delete store.marketCache[symbol];
            logger.warn({ err, symbol, pair }, "Symbol price retry failed — stale price removed");
          }
        }));
      }

      logger.debug({ batchStart: i, batchSize: batch.length, updated, retried: retryPairs.length }, "Ticker batch updated");
    } catch (err) {
      // A batch failure must not make all of its symbols wait for the next
      // scan. Retry each symbol directly from Binance.US now.
      await Promise.all(batch.map(async (pair) => {
        const coin = COINS.find((c) => c.pair === pair);
        const symbol = coin?.symbol ?? pair.replace(/USD$/, "");
        try {
          const price = await fetchSymbolPrice(pair);
          const previous = store.marketCache[symbol];
          store.marketCache[symbol] = {
            price,
            change24h: previous?.change24h ?? 0,
            volume24h: previous?.volume24h ?? 0,
            high24h: previous?.high24h ?? price,
            low24h: previous?.low24h ?? price,
            lastUpdated: Date.now(),
          };
        } catch (retryErr) {
          delete store.marketCache[symbol];
          logger.warn({ err, retryErr, symbol, pair }, "Ticker batch and symbol retry failed — stale price removed");
        }
      }));
    }

    if (i + BATCH < pairs.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
