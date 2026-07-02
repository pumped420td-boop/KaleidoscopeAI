import { store } from "./store.js";
import { COINS } from "./coins.js";
import { analyzeCoins } from "./voting.js";
import { updateTickerCache, fetchUsdBalance, placeMarketBuy, placeMarketSell } from "./kraken.js";
import { encodePattern, recordPatternOutcome } from "./strategies/ml.js";
import { saveMlState } from "./persistence.js";
import { logger } from "./logger.js";
import type { StoredTrade } from "./store.js";

const SCAN_INTERVAL_MS = 30_000; // 30 seconds
const VOTES_REFRESH_MS = 30_000; // background votes refresh interval

let scanInterval: ReturnType<typeof setInterval> | null = null;
let votesInterval: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function openTrade(
  symbol: string,
  pair: string,
  name: string,
  price: number,
  winningStrategies: string[],
  entryConfidence = 0
): Promise<void> {
  const openTrades = store.getOpenTrades();
  if (openTrades.length >= store.settings.maxConcurrentTrades) return;

  const available = store.getAvailableForTrade();
  const perTrade = available / (store.settings.maxConcurrentTrades - openTrades.length);
  if (perTrade < 10) {
    logger.warn({ symbol }, "Insufficient balance to open trade");
    return;
  }

  const quantity = perTrade / price;

  if (store.settings.mode === "live") {
    try {
      await placeMarketBuy(pair, quantity.toFixed(8));
    } catch (err) {
      logger.error({ err, symbol }, "Failed to place live buy order");
      return;
    }
  }

  if (store.settings.mode === "paper") {
    store.paperBalance -= perTrade;
  }

  const trade: StoredTrade = {
    id: generateId(),
    symbol,
    pair,
    name,
    entryPrice: price,
    currentPrice: price,
    quantity,
    investedUsd: perTrade,
    profitPercent: 0,
    profitUsd: 0,
    status: "open",
    strategy: "Voting Consensus",
    winningStrategies,
    openedAt: new Date().toISOString(),
    closedAt: null,
    paperMode: store.settings.mode === "paper",
    highestPrice: price,
    trailingActive: false,
    entryConfidence,
    closeReason: null,
  };

  store.trades.push(trade);
  logger.info({ symbol, price, perTrade, mode: store.settings.mode }, "Trade opened");
}

export async function closeTrade(trade: StoredTrade, reason: "profit" | "stop" | "sell_signal" | "manual" | "swapped"): Promise<void> {
  const price = store.marketCache[trade.symbol]?.price ?? trade.currentPrice;

  if (store.settings.mode === "live") {
    try {
      await placeMarketSell(trade.pair, trade.quantity.toFixed(8));
    } catch (err) {
      logger.error({ err, symbol: trade.symbol }, "Failed to place live sell order");
      return;
    }
  }

  const exitValue = trade.quantity * price;
  const profitUsd = exitValue - trade.investedUsd;
  const profitPercent = (profitUsd / trade.investedUsd) * 100;

  trade.currentPrice = price;
  trade.profitUsd = profitUsd;
  trade.profitPercent = profitPercent;
  trade.status = reason === "stop" ? "stopped" : "closed";
  trade.closedAt = new Date().toISOString();
  trade.closeReason = reason;

  if (store.settings.mode === "paper") {
    store.paperBalance += exitValue;
  }

  // Feed results into ML learning — keyed by strategy-combo + candle pattern
  const candles = store.ohlcCache[trade.pair]?.candles ?? [];
  if (candles.length >= 10) {
    const closes = candles.map((c) => c.close);
    const pattern = encodePattern(closes);
    const success = profitPercent > 0;
    // Use the strategies that voted buy when the trade was opened as the combo key
    const strategyCombo = [...trade.winningStrategies].sort().join("|");
    recordPatternOutcome(strategyCombo, pattern, success, profitPercent);
  }

  // Update strategy weights based on which strategies voted for this trade
  for (const stratId of trade.winningStrategies) {
    store.updateStrategyWeight(stratId, profitPercent > 0, profitPercent);
  }

  logger.info(
    { symbol: trade.symbol, profitPercent: profitPercent.toFixed(2), reason, mode: store.settings.mode },
    "Trade closed"
  );

  // Persist immediately so balance/ML data survive a crash between 5-min saves
  saveMlState();
}

async function updateActiveTrades(): Promise<void> {
  const open = store.getOpenTrades();
  for (const trade of open) {
    const cached = store.marketCache[trade.symbol];
    if (!cached) continue;

    const price = cached.price;
    trade.currentPrice = price;
    trade.profitPercent = ((price - trade.entryPrice) / trade.entryPrice) * 100;
    trade.profitUsd = trade.quantity * price - trade.investedUsd;

    // Track highest price for trailing stop
    if (price > trade.highestPrice) {
      trade.highestPrice = price;
    }

    // Hard stop loss — fires immediately if price drops X% below entry, no matter what
    const hardDropPct = ((trade.entryPrice - price) / trade.entryPrice) * 100;
    if (hardDropPct >= store.settings.stopLossPercent) {
      logger.info({ symbol: trade.symbol, hardDropPct: hardDropPct.toFixed(2) }, "Hard stop loss triggered");
      await closeTrade(trade, "stop");
      continue;
    }

    // Activate trailing stop once profit target is hit
    if (trade.profitPercent >= store.settings.profitTarget && !trade.trailingActive) {
      trade.trailingActive = true;
      logger.info({ symbol: trade.symbol, profit: trade.profitPercent }, "Trailing stop activated");
    }

    // Check trailing stop loss
    if (trade.trailingActive) {
      const trailingDropPct = ((trade.highestPrice - price) / trade.highestPrice) * 100;
      if (trailingDropPct >= store.settings.trailingStop) {
        await closeTrade(trade, "stop");
        continue;
      }
    }
  }
}

/** Recompute votes for all coins and stash result in store — never blocks HTTP handlers */
async function refreshVotesCache(): Promise<void> {
  try {
    const coins = COINS.filter((c) => store.marketCache[c.symbol]);
    if (coins.length === 0) return;
    const results = await analyzeCoins(coins);
    store.votesCache = results;
    store.votesCachedAt = new Date().toISOString();
  } catch (err) {
    logger.warn({ err }, "Votes cache refresh failed");
  }
}

async function scan(): Promise<void> {
  if (!store.running) return;

  try {
    // Refresh market data
    const pairs = COINS.map((c) => c.pair);
    await updateTickerCache(pairs);

    // Update live balance if needed
    if (store.settings.mode === "live" && store.apiKey && store.apiSecret) {
      try {
        store.liveBalance = await fetchUsdBalance();
      } catch {
        // ignore
      }
    }

    // Update open trade prices + check exits
    await updateActiveTrades();

    // Analyze ALL coins once — share the result for both trading decisions and the votes cache.
    // This avoids the previous pattern of calling analyzeCoins twice per scan.
    const allCoins = COINS.filter((c) => store.marketCache[c.symbol]);
    const allVoteResults = await analyzeCoins(allCoins);

    // Persist votes cache for the Signals tab
    store.votesCache = allVoteResults;
    store.votesCachedAt = new Date().toISOString();

    // Find new trade opportunities using the results we just computed
    const openTrades = store.getOpenTrades();
    if (openTrades.length < store.settings.maxConcurrentTrades) {
      const activeSymbols = new Set(openTrades.map((t) => t.symbol));
      // Trust the weighted voting engine's decision — no secondary raw-count gate.
      // voteThreshold is now a minimum confidence % (scaled: threshold/7) so the
      // setting still gives users control without blocking every weighted buy signal.
      const minConfidence = store.settings.voteThreshold / 14; // 4/14 ≈ 0.29 default
      const buySignals = allVoteResults
        .filter((r) => !activeSymbols.has(r.symbol))
        .filter((r) => r.decision === "buy" && r.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence);

      for (const signal of buySignals) {
        if (store.getOpenTrades().length >= store.settings.maxConcurrentTrades) break;
        const winningStrategies = signal.votes
          .filter((v) => v.vote === "buy")
          .map((v) => v.strategyId);
        await openTrade(signal.symbol, COINS.find((c) => c.symbol === signal.symbol)!.pair, signal.name, signal.price, winningStrategies, signal.confidence);
      }
    }

    store.lastScanAt = new Date().toISOString();

    // Swap logic: if all trade slots are full, check whether any idle coin now has
    // significantly higher vote confidence than the weakest current trade.
    // Trades with trailingActive=true are NEVER swapped — let them run to their
    // trailing stop. Only non-trailing trades are candidates for early replacement.
    const SWAP_MIN_ADVANTAGE = 0.05; // new signal must beat current trade by ≥5%
    const currentOpen = store.getOpenTrades();
    if (currentOpen.length >= store.settings.maxConcurrentTrades) {
      const activeSymbols = new Set(currentOpen.map((t) => t.symbol));

      // Only consider trades that are NOT currently trailing (trailing trades keep running)
      const swappableTrades = currentOpen.filter((t) => !t.trailingActive);

      if (swappableTrades.length > 0) {
        const swappableVotes = allVoteResults.filter((r) =>
          swappableTrades.some((t) => t.symbol === r.symbol)
        );
        const weakestVote = swappableVotes.sort((a, b) => a.confidence - b.confidence)[0];
        const weakestTrade = weakestVote
          ? swappableTrades.find((t) => t.symbol === weakestVote.symbol)
          : undefined;

        if (weakestTrade && weakestVote) {
          const bestSwap = allVoteResults
            .filter((r) => !activeSymbols.has(r.symbol))
            .filter((r) => r.decision === "buy" && r.confidence >= store.settings.voteThreshold / 14)
            .sort((a, b) => b.confidence - a.confidence)[0];

          if (bestSwap && bestSwap.confidence >= weakestVote.confidence + SWAP_MIN_ADVANTAGE) {
            logger.info(
              {
                closing: weakestTrade.symbol,
                closingConfidence: weakestVote.confidence.toFixed(3),
                opening: bestSwap.symbol,
                openingConfidence: bestSwap.confidence.toFixed(3),
                trailingProtected: currentOpen.filter((t) => t.trailingActive).map((t) => t.symbol),
              },
              "Swapping trade for higher-confidence opportunity"
            );
            await closeTrade(weakestTrade, "swapped");
            const swapCoin = COINS.find((c) => c.symbol === bestSwap.symbol)!;
            const swapStrategies = bestSwap.votes.filter((v) => v.vote === "buy").map((v) => v.strategyId);
            await openTrade(bestSwap.symbol, swapCoin.pair, bestSwap.name, bestSwap.price, swapStrategies, bestSwap.confidence);
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Scan error");
  }
}

export async function startBot(): Promise<void> {
  if (store.running) return;
  store.running = true;
  logger.info({ mode: store.settings.mode }, "Bot started");

  // Stop standalone votes timer — the scan loop now handles refreshes
  if (votesInterval) {
    clearInterval(votesInterval);
    votesInterval = null;
  }

  // Initial market data load
  try {
    await updateTickerCache(COINS.map((c) => c.pair));
  } catch {
    // ignore on startup
  }

  await scan();
  scanInterval = setInterval(scan, SCAN_INTERVAL_MS);
}

export async function stopBot(): Promise<void> {
  if (!store.running) return;
  store.running = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  logger.info("Bot stopped");

  // Keep votes fresh even while bot is off (market cache still has data)
  if (!votesInterval) {
    votesInterval = setInterval(refreshVotesCache, VOTES_REFRESH_MS);
  }
}

/**
 * Start a background votes-cache timer for use before the bot is ever started.
 * Called once at server startup so the Signals tab works immediately.
 */
export function startVotesCacheTimer(): void {
  if (votesInterval || store.running) return;
  votesInterval = setInterval(refreshVotesCache, VOTES_REFRESH_MS);
}

export { SCAN_INTERVAL_MS, refreshVotesCache };
