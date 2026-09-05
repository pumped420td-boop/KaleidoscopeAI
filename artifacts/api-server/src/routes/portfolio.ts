import { Router } from "express";
import { store } from "../lib/store.js";

const router = Router();

router.get("/portfolio", (_req, res) => {
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
