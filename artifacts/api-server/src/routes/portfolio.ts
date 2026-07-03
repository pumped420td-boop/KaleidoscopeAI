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

  res.json({
    totalBalance,
    availableBalance: Math.max(0, availableBalance),
    allocatedBalance,
    allocatedInTrades,
    totalPnl,
    totalPnlPercent,
    winRate: store.getWinRate(),
    totalTrades: store.trades.filter((t) => t.status !== "open").length,
    paperMode: store.settings.mode === "paper",
    balanceHistory: store.balanceHistory,
  });
});

export default router;
