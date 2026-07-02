import { Router } from "express";
import { store } from "../lib/store.js";
import { saveMlState } from "../lib/persistence.js";

const router = Router();

router.get("/settings", (_req, res) => {
  res.json(store.settings);
});

router.put("/settings", (req, res) => {
  const body = req.body as Partial<typeof store.settings>;
  if (body.allocation !== undefined) store.settings.allocation = Math.max(1, Math.min(100, Number(body.allocation)));
  if (body.mode !== undefined && (body.mode === "paper" || body.mode === "live")) {
    // Only allow live mode if keys are configured
    if (body.mode === "live" && !store.apiKey) {
      res.status(400).json({ error: "API keys required for live mode" });
      return;
    }
    store.settings.mode = body.mode;
  }
  if (body.profitTarget !== undefined) store.settings.profitTarget = Math.max(1, Math.min(50, Number(body.profitTarget)));
  if (body.trailingStop !== undefined) store.settings.trailingStop = Math.max(0.5, Math.min(10, Number(body.trailingStop)));
  if (body.stopLossPercent !== undefined) store.settings.stopLossPercent = Math.max(1, Math.min(50, Number(body.stopLossPercent)));
  if (body.maxConcurrentTrades !== undefined) store.settings.maxConcurrentTrades = Math.max(1, Math.min(5, Number(body.maxConcurrentTrades)));
  if (body.voteThreshold !== undefined) store.settings.voteThreshold = Math.max(1, Math.min(7, Number(body.voteThreshold)));
  saveMlState();
  res.json(store.settings);
});

export default router;
