import { Router } from "express";
import { store } from "../lib/store.js";
import { COINS, getUsdtPair } from "../lib/coins.js";
import { updateTickerCache } from "../lib/binance.js";

const router = Router();

// Single warmup promise — reused by all requests so we never double-fetch on startup
let warmupPromise: Promise<void> | null = null;

function ensureWarmup(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = updateTickerCache(COINS.flatMap((c) => [c.pair, getUsdtPair(c)]))
      .catch(() => {})
      .finally(() => {
        // Allow re-warmup after 20 seconds (matches scan interval)
        setTimeout(() => { warmupPromise = null; }, 20_000);
      });
  }
  return warmupPromise;
}

// Pre-warm cache immediately when server starts
ensureWarmup();

router.get("/market/ticker", (_req, res) => {
  // Trigger background warmup/refresh if needed — never block the response.
  // On first load the cache will be empty and the client polls every 15 s, so
  // data appears within one or two refetch cycles (a few seconds after startup).
  const now = Date.now();
  const stale = COINS.some((c) => {
    const usd = store.marketCache[c.symbol];
    const usdt = store.usdtMarketCache[c.symbol];
    return !usd || !usdt || now - usd.lastUpdated > 20_000 || now - usdt.lastUpdated > 20_000;
  });
  if (stale) ensureWarmup();

  const tickers = COINS.flatMap((coin) => [
    {
      symbol: coin.symbol,
      pair: coin.pair,
      quoteAsset: "USD" as const,
      name: coin.name,
      cache: store.marketCache[coin.symbol],
      category: coin.category,
    },
    {
      symbol: coin.symbol,
      pair: getUsdtPair(coin),
      quoteAsset: "USDT" as const,
      name: coin.name,
      cache: store.usdtMarketCache[coin.symbol],
      category: coin.category,
    },
  ]).map(({ cache, ...ticker }) => ({
    ...ticker,
    price: cache?.price ?? 0,
    change24h: cache?.change24h ?? 0,
    volume24h: cache?.volume24h ?? 0,
    high24h: cache?.high24h ?? 0,
    low24h: cache?.low24h ?? 0,
  })).filter((t) => t.price > 0);

  const latestCacheUpdate = tickers.reduce((latest, ticker) => {
    const cache = ticker.quoteAsset === "USDT" ? store.usdtMarketCache : store.marketCache;
    const updated = cache[ticker.symbol]?.lastUpdated ?? 0;
    return Math.max(latest, updated);
  }, 0);
  res.json({ tickers, lastUpdated: latestCacheUpdate ? new Date(latestCacheUpdate).toISOString() : null });
});

export default router;
