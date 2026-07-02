import { fetchOHLC } from "./kraken.js";
import { store } from "./store.js";
import { rsiStrategy } from "./strategies/rsi.js";
import { macdStrategy } from "./strategies/macd.js";
import { bollingerStrategy } from "./strategies/bollinger.js";
import { emaStrategy } from "./strategies/ema.js";
import { vwapStrategy } from "./strategies/vwap.js";
import { momentumStrategy } from "./strategies/momentum.js";
import { mlStrategy } from "./strategies/ml.js";
import type { StrategySignal } from "./strategies/base.js";
import type { Coin } from "./coins.js";

// Non-ML strategies run first so their votes can be passed to ML as context
const BASE_STRATEGIES = [
  rsiStrategy,
  macdStrategy,
  bollingerStrategy,
  emaStrategy,
  vwapStrategy,
  momentumStrategy,
];

export interface VoteResult {
  symbol: string;
  name: string;
  price: number;
  buyScore: number;
  sellScore: number;
  holdScore: number;
  totalWeightedVotes: number;
  decision: "buy" | "sell" | "hold";
  confidence: number;
  votes: (StrategySignal & { weight: number })[];
}

const OHLC_FETCH_CONCURRENCY = 5;

export async function analyzeCoins(coins: Coin[]): Promise<VoteResult[]> {
  const results: VoteResult[] = [];

  // Fetch all OHLC data concurrently (max 5 at a time) so cache misses don't
  // queue up as 40 sequential network round-trips.
  const ohlcMap = new Map<string, ReturnType<typeof fetchOHLC> extends Promise<infer T> ? T : never>();
  for (let i = 0; i < coins.length; i += OHLC_FETCH_CONCURRENCY) {
    const batch = coins.slice(i, i + OHLC_FETCH_CONCURRENCY);
    const fetched = await Promise.all(batch.map((c) => fetchOHLC(c.pair).catch(() => [] as Awaited<ReturnType<typeof fetchOHLC>>)));
    batch.forEach((c, idx) => ohlcMap.set(c.pair, fetched[idx]!));
  }

  for (const coin of coins) {
    const cached = store.marketCache[coin.symbol];
    if (!cached) continue;

    const price = cached.price;
    const candles = ohlcMap.get(coin.pair) ?? [];
    if (candles.length < 10) continue;

    const votes: (StrategySignal & { weight: number })[] = [];
    let buyScore = 0;
    let sellScore = 0;
    let holdScore = 0;
    let totalWeight = 0;

    // Run base strategies first so we know which ones vote "buy" before calling ML
    const buyVoterIds: string[] = [];
    for (const strategy of BASE_STRATEGIES) {
      const stat = store.strategyStats.find((s) => s.id === strategy.id);
      const weight = stat?.weight ?? 1.0;

      let signal: StrategySignal;
      try {
        signal = strategy.analyze({ symbol: coin.symbol, candles, currentPrice: price });
      } catch {
        signal = { strategyId: strategy.id, strategyName: strategy.name, vote: "hold", confidence: 0.1 };
      }

      if (signal.vote === "buy") {
        buyScore += signal.confidence * weight;
        buyVoterIds.push(strategy.id);
      } else if (signal.vote === "sell") {
        sellScore += signal.confidence * weight;
      } else {
        holdScore += signal.confidence * weight;
      }

      totalWeight += weight;
      votes.push({ ...signal, weight });
      if (stat) stat.currentSignal = signal.vote;
    }

    // Run ML last — pass buy voter IDs so it can use combo + pattern learning
    {
      const stat = store.strategyStats.find((s) => s.id === mlStrategy.id);
      const weight = stat?.weight ?? 1.0;
      let signal: StrategySignal;
      try {
        signal = mlStrategy.analyze({ symbol: coin.symbol, candles, currentPrice: price, otherVotes: buyVoterIds });
      } catch {
        signal = { strategyId: mlStrategy.id, strategyName: mlStrategy.name, vote: "hold", confidence: 0.1 };
      }

      if (signal.vote === "buy") buyScore += signal.confidence * weight;
      else if (signal.vote === "sell") sellScore += signal.confidence * weight;
      else holdScore += signal.confidence * weight;

      totalWeight += weight;
      votes.push({ ...signal, weight });
      if (stat) stat.currentSignal = signal.vote;
    }

    const maxScore = Math.max(buyScore, sellScore, holdScore);
    const decision = maxScore === buyScore ? "buy" : maxScore === sellScore ? "sell" : "hold";
    const confidence = totalWeight > 0 ? maxScore / totalWeight : 0;

    results.push({
      symbol: coin.symbol,
      name: coin.name,
      price,
      buyScore,
      sellScore,
      holdScore,
      totalWeightedVotes: totalWeight,
      decision,
      confidence,
      votes,
    });
  }

  return results;
}

export function countBuyVotes(votes: StrategySignal[]): number {
  return votes.filter((v) => v.vote === "buy").length;
}
