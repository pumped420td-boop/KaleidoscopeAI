import { Router } from "express";
import { store } from "../lib/store.js";
import { fetchBalance, hasBinanceCredentials } from "../lib/binance.js";
import { logger } from "../lib/logger.js";

const router = Router();
const BALANCE_REFRESH_TTL_MS = 15_000;
let lastBalanceRefreshAt = 0;
let balanceRefreshInFlight: Promise<void> | null = null;

async function refreshLiveBalancesIfNeeded(): Promise<void> {
  if (store.settings.mode !== "live" || !hasBinanceCredentials()) return;
  if (balanceRefreshInFlight) {
    await balanceRefreshInFlight;
    return;
  }
  if (Date.now() - lastBalanceRefreshAt < BALANCE_REFRESH_TTL_MS) return;

  const refresh = (async () => {
    try {
      const balances = await fetchBalance();
      const usd = Number.parseFloat(balances.USD ?? "0");
      const usdt = Number.parseFloat(balances.USDT ?? "0");
      store.liveBalance = Number.isFinite(usd) ? usd : 0;
      store.liveUsdtBalance = Number.isFinite(usdt) ? usdt : 0;
    } catch (err) {
      logger.warn({ err }, "Live Binance.US balance refresh failed");
    } finally {
      lastBalanceRefreshAt = Date.now();
      balanceRefreshInFlight = null;
    }
  })();
  balanceRefreshInFlight = refresh;
  await refresh;
}

router.get("/portfolio", async (_req, res) => {
  await refreshLiveBalancesIfNeeded();

  const totalBalance = store.getBalance();
  const allocatedBalance = store.getAllocatedAmount();
  const allocatedInTrades = store.getAmountInTrades();
  const availableBalance = totalBalance - allocatedInTrades;
  const totalPnl = store.getTotalPnl();
  const initialBalance = store.settings.mode === "paper" ? 10000 : totalBalance - totalPnl;
  const totalPnlPercent = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;
  const usdtInvested = store.getAmountInTrades("USDT");
  const usdtAvailable = store.getBalance("USDT");
  const usdtCurrentBalance = store.getTotalPortfolioValue("USDT");
  const usdtRealizedPnl = store.getRealizedPnl("USDT");
  const usdtUnrealizedPnl = store.getUnrealizedPnl("USDT");

  res.json({
    totalBalance,
    availableBalance: Math.max(0, availableBalance),
    allocatedBalance,
    allocatedInTrades,
    totalPnl,
    dailyPnl: store.getDailyPnl(),
    totalPnlPercent,
    winRate: store.getWinRate(),
    totalTrades: store.getTradeCount("USD"),
    paperMode: store.settings.mode === "paper",
    balanceHistory: store.balanceHistory,
    usdtStartingBalance: 100,
    usdtCurrentBalance,
    usdtBalance: store.getBalance("USDT"),
    usdtAmountInvested: usdtInvested,
    usdtAvailableBalance: usdtAvailable,
    usdtRealizedPnl,
    usdtUnrealizedPnl,
    usdtTotalPnl: usdtRealizedPnl + usdtUnrealizedPnl,
    usdtTradeCount: store.getTradeCount("USDT"),
    usdtBalanceHistory: store.usdtBalanceHistory,
  });
});

export default router;
