import { store } from "./store.js";
import { COINS, getUsdtPair } from "./coins.js";
import { analyzeCoins } from "./voting.js";
import { updateTickerCache, fetchUsdBalance, fetchUsdtBalance, placeMarketBuy, placeMarketSell, fetchSymbolPrice } from "./binance.js";
import { encodePattern, recordPatternOutcome } from "./strategies/ml.js";
import { saveMlState } from "./persistence.js";
import { logger } from "./logger.js";
import type { QuoteAsset, StoredTrade } from "./store.js";

const SCAN_INTERVAL_MS = 20_000;    // 20 seconds
const VOTES_REFRESH_MS = 20_000;    // background votes refresh when bot is off
const MARKET_REFRESH_MS = 20_000;   // background market cache refresh when bot is off
const MIN_VOLUME_USD = 500;

let scanInterval: ReturnType<typeof setInterval> | null = null;
let votesInterval: ReturnType<typeof setInterval> | null = null;
let marketInterval: ReturnType<typeof setInterval> | null = null;
let scanInProgress = false;

async function refreshMarketCache(): Promise<void> {
  try {
    await updateTickerCache(COINS.flatMap((c) => [c.pair, getUsdtPair(c)]));
  } catch {
    // ignore — will retry next cycle
  }
}

interface SelectedMarket {
  pair: string;
  quoteAsset: QuoteAsset;
  price: number;
}

function selectMarket(symbol: string): SelectedMarket | null {
  const coin = COINS.find((c) => c.symbol === symbol);
  if (!coin) return null;

  const usd = store.marketCache[symbol];
  if (usd && usd.volume24h >= MIN_VOLUME_USD) {
    return { pair: coin.pair, quoteAsset: "USD", price: usd.price };
  }

  const usdt = store.usdtMarketCache[symbol];
  if (usdt && usdt.volume24h >= MIN_VOLUME_USD) {
    return { pair: getUsdtPair(coin), quoteAsset: "USDT", price: usdt.price };
  }

  return null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function openTrade(
  symbol: string,
  pair: string,
  quoteAsset: QuoteAsset,
  name: string,
  price: number,
  winningStrategies: string[],
  entryConfidence = 0
): Promise<void> {
  if (store.isBanned(symbol)) {
    logger.debug({ symbol }, "Trade entry rejected — symbol is on cooldown");
    return;
  }

  const openTrades = store.getOpenTrades();
  if (openTrades.length >= store.settings.maxConcurrentTrades) return;

  const available = store.getAvailableForTrade(quoteAsset);
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
    if (quoteAsset === "USDT") store.paperUsdtBalance -= perTrade;
    else store.paperBalance -= perTrade;
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
    quoteAsset,
    highestPrice: price,
    trailingActive: false,
    entryConfidence,
    closeReason: null,
  };

  store.trades.push(trade);
  logger.info({ symbol, price, perTrade, mode: store.settings.mode }, "Trade opened");
}

export async function closeTrade(
  trade: StoredTrade,
  reason: "profit" | "stop" | "sell_signal" | "manual" | "swapped",
  exitPrice?: number,
): Promise<void> {
  const quoteAsset = trade.quoteAsset ?? "USD";
  const priceCache = quoteAsset === "USDT" ? store.usdtMarketCache : store.marketCache;
  const price = exitPrice ?? priceCache[trade.symbol]?.price ?? trade.currentPrice;

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
    if (quoteAsset === "USDT") store.paperUsdtBalance += exitValue;
    else store.paperBalance += exitValue;
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

// Cached prices older than this require an emergency direct fetch before any
// exit decision can be made — stale data must never be treated as current.
const PRICE_STALE_MS = 90_000; // 90 seconds ≈ 4.5 scan cycles

async function updateActiveTrades(): Promise<void> {
  const open = store.getOpenTrades();
  for (const trade of open) {
    const quoteAsset = trade.quoteAsset ?? "USD";
    const priceCache = quoteAsset === "USDT" ? store.usdtMarketCache : store.marketCache;
    const cached = priceCache[trade.symbol];
    const coin = COINS.find((c) => c.symbol === trade.symbol);
    if (!coin) continue;

    let price: number;
    if (!cached || Date.now() - cached.lastUpdated > PRICE_STALE_MS) {
      // Missing/stale cache — fetch directly from Binance.US. Never make an
      // exit decision from an old value.
      try {
         price = await fetchSymbolPrice(trade.pair);
         priceCache[trade.symbol] = {
          ...(cached ?? { change24h: 0, volume24h: 0, high24h: price, low24h: price }),
          price,
          lastUpdated: Date.now(),
        };
        logger.info({ symbol: trade.symbol, price }, "Fresh price fetched for open position");
      } catch (err) {
        logger.warn({ err, symbol: trade.symbol }, "Fresh price fetch failed — exit decision deferred");
        continue;
      }
    } else {
      price = cached.price;
    }

    // price is now a verified fresh Binance.US price — evaluate all exits.
    trade.currentPrice = price;
    trade.profitPercent = ((price - trade.entryPrice) / trade.entryPrice) * 100;
    trade.profitUsd = trade.quantity * price - trade.investedUsd;

    // Hard stop loss
    const hardDropPct = ((trade.entryPrice - price) / trade.entryPrice) * 100;
    if (hardDropPct >= store.settings.stopLossPercent) {
      logger.info({ symbol: trade.symbol, hardDropPct: hardDropPct.toFixed(2) }, "Hard stop loss triggered — banning for 1 hour");
      store.banSymbol(trade.symbol, 3_600_000);
      // Paper mode models a stop at the configured threshold even when the
      // observed market price gaps below it. Live mode keeps the observed
      // price because the exchange determines the actual market fill.
      const paperStopPrice = trade.entryPrice * (1 - store.settings.stopLossPercent / 100);
      await closeTrade(
        trade,
        "stop",
        store.settings.mode === "paper" ? paperStopPrice : undefined,
      );
      continue;
    }

    // Track highest price for trailing stop
    if (price > trade.highestPrice) trade.highestPrice = price;

    // Activate trailing stop once profit target is hit
    if (trade.profitPercent >= store.settings.profitTarget && !trade.trailingActive) {
      trade.trailingActive = true;
      logger.info({ symbol: trade.symbol, profit: trade.profitPercent }, "Trailing stop activated");
    }

    // Check trailing stop
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
  if (!store.running || scanInProgress) return;

  scanInProgress = true;
  try {
    // Refresh market data
    const pairs = COINS.flatMap((c) => [c.pair, getUsdtPair(c)]);
    await updateTickerCache(pairs);

    // Update live balance if needed
    if (store.settings.mode === "live" && store.apiKey && store.apiSecret) {
      try {
        store.liveBalance = await fetchUsdBalance();
        // USDT is tracked independently from USD when the live account is used.
        store.liveUsdtBalance = await fetchUsdtBalance();
      } catch {
        // ignore
      }
    }

    // Update open trade prices + check exits
    await updateActiveTrades();

    // Analyze the full current market universe once. The Signals tab should
    // show every valid market pair, while the trading engine can still apply
    // its liquidity filter to entries.
    const cachedCoins = COINS.filter((c) => store.marketCache[c.symbol]);
    const allVoteResults = await analyzeCoins(cachedCoins);

    // Persist votes cache for the Signals tab
    store.votesCache = allVoteResults;
    store.votesCachedAt = new Date().toISOString();

    // Require three consecutive valid scans below the configured BUY-vote
    // threshold before closing an open trade. Missing vote results do not
    // count as a low-vote scan.
    const votesBySymbol = new Map(allVoteResults.map((result) => [result.symbol, result]));
    for (const trade of store.getOpenTrades()) {
      const voteResult = votesBySymbol.get(trade.symbol);
      if (!voteResult) continue;

      const buyVotes = voteResult.votes.filter((vote) => vote.vote === "buy").length;
      if (buyVotes < store.settings.voteThreshold) {
        const lowVoteScans = (store.voteBelowThresholdScans[trade.id] ?? 0) + 1;
        store.voteBelowThresholdScans[trade.id] = lowVoteScans;
        logger.info(
          { symbol: trade.symbol, buyVotes, threshold: store.settings.voteThreshold, lowVoteScans },
          "Open trade below vote threshold"
        );
        if (lowVoteScans >= 3) {
          logger.info(
            { symbol: trade.symbol, buyVotes, threshold: store.settings.voteThreshold },
            "Closing trade after three consecutive below-threshold scans"
          );
          await closeTrade(trade, "sell_signal");
          delete store.voteBelowThresholdScans[trade.id];
        }
      } else {
        delete store.voteBelowThresholdScans[trade.id];
      }
    }

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
        .filter((r) => !store.isBanned(r.symbol)) // skip coins banned after a hard stop
        .filter((r) => r.decision === "buy" && r.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence);

      for (const signal of buySignals) {
        if (store.getOpenTrades().length >= store.settings.maxConcurrentTrades) break;
        const winningStrategies = signal.votes
          .filter((v) => v.vote === "buy")
          .map((v) => v.strategyId);
        const selectedMarket = selectMarket(signal.symbol);
        if (!selectedMarket) {
          logger.debug({ symbol: signal.symbol }, "BUY signal rejected — neither USD nor USDT liquidity meets threshold");
          continue;
        }
        await openTrade(
          signal.symbol,
          selectedMarket.pair,
          selectedMarket.quoteAsset,
          signal.name,
          selectedMarket.price,
          winningStrategies,
          signal.confidence,
        );
      }
    }

    store.lastScanAt = new Date().toISOString();

    // Record balance snapshot for dashboard graph (cap at 432 points = 24h @ 20s)
    store.balanceHistory.push({
      ts: Date.now(),
      balance: store.getTotalPortfolioValue(),
      pnl: store.getTotalPnl(),
    });
    if (store.balanceHistory.length > 432) store.balanceHistory.shift();
    store.usdtBalanceHistory.push({
      ts: Date.now(),
      balance: store.getTotalPortfolioValue("USDT"),
      pnl: store.getTotalPnlIncludingOpen("USDT"),
    });
    if (store.usdtBalanceHistory.length > 432) store.usdtBalanceHistory.shift();

    // Persist trades, learning state, balances, and vote counters after every
    // completed scan so restarts do not discard the latest state.
    saveMlState();
  } catch (err) {
    logger.error({ err }, "Scan error");
    saveMlState();
  } finally {
    scanInProgress = false;
  }
}

export async function startBot(): Promise<void> {
  if (store.running) return;
  store.running = true;
  logger.info({ mode: store.settings.mode }, "Bot started");

  // Scan loop handles all refreshes — stop the standalone background timers
  if (votesInterval) { clearInterval(votesInterval); votesInterval = null; }
  if (marketInterval) { clearInterval(marketInterval); marketInterval = null; }

  // Initial market data load
  try {
    await updateTickerCache(COINS.flatMap((c) => [c.pair, getUsdtPair(c)]));
  } catch {
    // ignore on startup
  }

  await scan();
  scanInterval = setInterval(scan, SCAN_INTERVAL_MS);
}

export async function stopBot(): Promise<void> {
  if (!store.running) return;
  store.running = false;
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  logger.info("Bot stopped");

  // Keep market data and votes fresh while bot is off
  if (!marketInterval) marketInterval = setInterval(refreshMarketCache, MARKET_REFRESH_MS);
  if (!votesInterval)  votesInterval  = setInterval(refreshVotesCache,  VOTES_REFRESH_MS);
  saveMlState();
}

/**
 * Start background refresh timers before the bot is first started.
 * Called once at server startup so the Market and Signals tabs work immediately.
 */
export function startVotesCacheTimer(): void {
  if (store.running) return;
  if (!marketInterval) marketInterval = setInterval(refreshMarketCache, MARKET_REFRESH_MS);
  if (!votesInterval)  votesInterval  = setInterval(refreshVotesCache,  VOTES_REFRESH_MS);
}

export { SCAN_INTERVAL_MS, refreshVotesCache };
