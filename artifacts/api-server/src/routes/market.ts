import { Router } from "express";
import { store } from "../lib/store.js";
import { COINS } from "../lib/coins.js";
import { updateTickerCache } from "../lib/binance.js";

const router = Router();

// Single warmup promise — reused by all requests so we never double-fetch on startup
let warmupPromise: Promise<void> | null = null;

function ensureWarmup(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = updateTickerCache(COINS.map((c) => c.pair))
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
    const cached = store.marketCache[c.symbol];
    return !cached || now - cached.lastUpdated > 20_000; // matches 20s scan interval
  });
  if (stale) ensureWarmup();

  const tickers = COINS.map((coin) => {
    const cached = store.marketCache[coin.symbol];
    return {
      symbol: coin.symbol,
      pair: coin.pair,
      name: coin.name,
      price: cached?.price ?? 0,
      change24h: cached?.change24h ?? 0,
      volume24h: cached?.volume24h ?? 0,
      high24h: cached?.high24h ?? 0,
      low24h: cached?.low24h ?? 0,
      category: coin.category,
    };
  }).filter((t) => t.price > 0);

  res.json({ tickers, lastUpdated: new Date().toISOString() });
});

export default router;
