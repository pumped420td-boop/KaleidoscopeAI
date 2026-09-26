import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { store } from "./store.js";
import type { StoredTrade, StoredSettings, BalanceSnapshot } from "./store.js";
import { getPatternHistory, setPatternHistory } from "./strategies/ml.js";
import { logger } from "./logger.js";

// Render's persistent disk convention is /data. DATA_DIR remains overrideable
// for local development or another mounted persistent volume.
const DATA_DIR = process.env["DATA_DIR"] ??
  (process.env["RENDER_EXTERNAL_URL"] ? "/data" : join(process.cwd(), "data"));
const STATE_FILE = join(DATA_DIR, "bot-state.json");
const STATE_VERSION = 4;

interface PersistedStratStat {
  id: string;
  weight: number;
  totalSignals: number;
  successfulSignals: number;
  profitContribution: number;
}

interface BotState {
  version: number;
  savedAt: string;
  // Paper trading
  paperBalance: number;
  paperUsdtBalance?: number;
  trades: StoredTrade[];
  settings: StoredSettings;
  // Bot state
  botRunning?: boolean;
  // ML learning
  learningCycles: number;
  strategyStats: PersistedStratStat[];
  patternHistory: Record<string, { wins: number; losses: number; totalProfit: number }>;
  // Balance history graph
  balanceHistory?: BalanceSnapshot[];
  usdtBalanceHistory?: BalanceSnapshot[];
  // Consecutive low-vote exit state
  voteBelowThresholdScans?: Record<string, number>;
  // Temporary entry protection state
  stopBannedUntil?: Record<string, number>;
  swapBannedUntil?: Record<string, number>;
}

export function saveMlState(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const state: BotState = {
      version: STATE_VERSION,
      savedAt: new Date().toISOString(),
      paperBalance: store.paperBalance,
      paperUsdtBalance: store.paperUsdtBalance,
      // Persist ALL trades (open + closed). Open trades are restored on restart
      // so their investedUsd stays accounted for in paperBalance correctly.
      trades: store.trades,
      settings: { ...store.settings },
      botRunning: store.running,
      learningCycles: store.learningCycles,
      strategyStats: store.strategyStats.map((s) => ({
        id: s.id,
        weight: s.weight,
        totalSignals: s.totalSignals,
        successfulSignals: s.successfulSignals,
        profitContribution: s.profitContribution,
      })),
      patternHistory: getPatternHistory(),
      balanceHistory: store.balanceHistory,
      usdtBalanceHistory: store.usdtBalanceHistory,
      voteBelowThresholdScans: store.voteBelowThresholdScans,
      stopBannedUntil: store.stopBannedUntil,
      swapBannedUntil: store.swapBannedUntil,
    };
    const tempFile = `${STATE_FILE}.tmp`;
    writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
    renameSync(tempFile, STATE_FILE);
  } catch (err) {
    logger.warn({ err }, "Failed to save bot state");
  }
}

/** Returns true if the bot was running when state was last saved and should auto-resume. */
export function loadMlState(): boolean {
  // Also try legacy filename from v1
  const legacyFile = join(DATA_DIR, "ml-state.json");

  let raw: string | null = null;
  if (existsSync(STATE_FILE)) {
    raw = readFileSync(STATE_FILE, "utf8");
  } else if (existsSync(legacyFile)) {
    raw = readFileSync(legacyFile, "utf8");
    logger.info("Loading from legacy ml-state.json");
  }

  if (!raw) {
    logger.info("No saved bot state found — starting fresh");
    return false;
  }

  try {
    const state = JSON.parse(raw) as BotState;

    // --- ML weights (both v1 and v2) ---
    for (const saved of state.strategyStats ?? []) {
      const stat = store.strategyStats.find((s) => s.id === saved.id);
      if (stat) {
        stat.weight = saved.weight;
        stat.totalSignals = saved.totalSignals;
        stat.successfulSignals = saved.successfulSignals;
        stat.profitContribution = saved.profitContribution;
      }
    }
    store.learningCycles = state.learningCycles ?? 0;
    if (state.patternHistory) setPatternHistory(state.patternHistory);

    // --- Balance, trades, settings (v2 only) ---
    if (state.version >= 2) {
      if (typeof state.paperBalance === "number") {
        store.paperBalance = state.paperBalance;
      }
      if (typeof state.paperUsdtBalance === "number") {
        store.paperUsdtBalance = state.paperUsdtBalance;
      }
      if (Array.isArray(state.trades)) {
        store.trades = state.trades.map((trade) => ({
          ...trade,
          // Existing persisted trades were all USD trades.
          quoteAsset: trade.quoteAsset ?? "USD",
        }));
      }
      if (state.settings) {
        // Restore everything except live mode — always start in paper for safety.
        // Use nullish coalescing for fields added after the state file was created
        // so that undefined values from old saves don't overwrite fresh defaults.
        store.settings = {
          ...store.settings,
          ...state.settings,
          allocation: state.settings.allocation ?? store.settings.allocation,
          profitTarget: state.settings.profitTarget ?? store.settings.profitTarget,
          trailingStop: state.settings.trailingStop ?? store.settings.trailingStop,
          stopLossPercent: state.settings.stopLossPercent ?? store.settings.stopLossPercent,
          maxConcurrentTrades: state.settings.maxConcurrentTrades ?? store.settings.maxConcurrentTrades,
          voteThreshold: state.settings.voteThreshold ?? store.settings.voteThreshold,
          mode: "paper", // never auto-restore live mode; user must re-enable
        };
      }
    }

    const patternCount = Object.keys(state.patternHistory ?? {}).length;
    logger.info(
      {
        cycles: store.learningCycles,
        patterns: patternCount,
        paperBalance: store.paperBalance,
        tradeHistory: store.trades.length,
        botRunning: state.botRunning ?? false,
        savedAt: state.savedAt,
      },
      "Bot state restored"
    );

    if (Array.isArray(state.balanceHistory)) {
      store.balanceHistory = state.balanceHistory;
    }
    if (Array.isArray(state.usdtBalanceHistory)) {
      store.usdtBalanceHistory = state.usdtBalanceHistory;
    }
    if (state.voteBelowThresholdScans && typeof state.voteBelowThresholdScans === "object") {
      store.voteBelowThresholdScans = state.voteBelowThresholdScans;
    }
    if (state.stopBannedUntil && typeof state.stopBannedUntil === "object") {
      store.stopBannedUntil = state.stopBannedUntil;
    }
    if (state.swapBannedUntil && typeof state.swapBannedUntil === "object") {
      store.swapBannedUntil = state.swapBannedUntil;
    }

    // Return whether the bot should auto-start (only safe for paper mode)
    return state.botRunning === true && store.settings.mode === "paper";
  } catch (err) {
    logger.warn({ err }, "Failed to load bot state — starting fresh");
    return false;
  }
}

