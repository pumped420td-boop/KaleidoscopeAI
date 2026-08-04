import { Router } from "express";
import { store } from "../lib/store.js";
import { startBot, stopBot, SCAN_INTERVAL_MS } from "../lib/trader.js";
import { COINS } from "../lib/coins.js";

const router = Router();

function buildStatus() {
  const now = Date.now();
  const cached = COINS.map((c) => store.marketCache[c.symbol]).filter(Boolean);
  const priceFeedFresh = cached.length > 0 && cached.every((e) => now - e!.lastUpdated < 30_000);

  return {
    running: store.running,
    mode: store.settings.mode,
    activeTradeCount: store.getOpenTrades().length,
    activeTrades: store.getOpenTrades(),
    balance: store.getBalance(),
    allocatedBalance: store.getAllocatedAmount(),
    lastScanAt: store.lastScanAt,
    scanIntervalSeconds: SCAN_INTERVAL_MS / 1000,
    priceFeedFresh,
  };
}

router.post("/bot/start", async (_req, res) => {
  await startBot();
  res.json(buildStatus());
});

router.post("/bot/stop", async (_req, res) => {
  await stopBot();
  res.json(buildStatus());
});

router.get("/bot/status", (_req, res) => {
  res.json(buildStatus());
});

export default router;
