import { Router } from "express";
import { store } from "../lib/store.js";
import { hasBinanceCredentials } from "../lib/binance.js";

const router = Router();

router.get("/keys/status", (_req, res) => {
  res.json({
    configured: hasBinanceCredentials(),
    paperMode: store.settings.mode === "paper",
  });
});

router.post("/keys", (_req, res) => {
  res.status(400).json({
    error: "Configure BINANCE_API_KEY and BINANCE_SECRET in the API server environment.",
  });
});

router.delete("/keys", (_req, res) => {
  res.status(400).json({
    error: "Remove BINANCE_API_KEY and BINANCE_SECRET from the API server environment.",
  });
});

export default router;
