import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { store } from "./store.js";
import type { StoredTrade, StoredSettings } from "./store.js";
import { getPatternHistory, setPatternHistory } from "./strategies/ml.js";
import { logger } from "./logger.js";

// DATA_DIR can be overridden by env var — set DATA_DIR=/data on Render when using a persistent disk
const DATA_DIR = process.env["DATA_DIR"] ?? join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "bot-state.json");
const STATE_VERSION = 2;

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
  trades: StoredTrade[];
  settings: StoredSettings;
  // Bot state
  botRunning?: boolean;
  // ML learning
  learningCycles: number;
  strategyStats: PersistedStratStat[];
  patternHistory: Record<string, { wins: number; losses: number; totalProfit: number }>;
}

export function saveMlState(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const state: BotState = {
      version: STATE_VERSION,
      savedAt: new Date().toISOString(),
      paperBalance: store.paperBalance,
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
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
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
      if (Array.isArray(state.trades)) {
        store.trades = state.trades;
      }
      if (state.settings) {
        // Restore everything except live mode — always start in paper for safety.
        // Use nullish coalescing for fields added after the state file was created
        // so that undefined values from old saves don't overwrite fresh defaults.
        store.settings = {
          ...store.settings,
          ...state.settings,
          stopLossPercent: state.settings.stopLossPercent ?? store.settings.stopLossPercent,
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

    // Return whether the bot should auto-start (only safe for paper mode)
    return state.botRunning === true && store.settings.mode === "paper";
  } catch (err) {
    logger.warn({ err }, "Failed to load bot state — starting fresh");
    return false;
  }
}

