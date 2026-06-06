export interface StoredTrade {
  id: string;
  symbol: string;
  krakenPair: string;
  name: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  investedUsd: number;
  profitPercent: number;
  profitUsd: number;
  status: "open" | "closed" | "stopped";
  strategy: string;
  winningStrategies: string[];
  openedAt: string;
  closedAt: string | null;
  paperMode: boolean;
  highestPrice: number;
  trailingActive: boolean;
  entryConfidence: number;
  closeReason: "profit" | "stop" | "sell_signal" | "manual" | "swapped" | null;
}

export interface StoredSettings {
  allocation: number;
  mode: "paper" | "live";
  profitTarget: number;
  trailingStop: number;
  /** Hard stop loss: close trade immediately if price drops this % below entry */
  stopLossPercent: number;
  maxConcurrentTrades: number;
  voteThreshold: number;
}

export interface StrategyStats {
  id: string;
  name: string;
  description: string;
  weight: number;
  totalSignals: number;
  successfulSignals: number;
  profitContribution: number;
  currentSignal: "buy" | "sell" | "hold" | "inactive";
}

export interface MarketEntry {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: number;
}

export interface OHLCCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
}

class Store {
  apiKey: string | null = null;
  apiSecret: string | null = null;

  settings: StoredSettings = {
    allocation: 50,
    mode: "paper",
    profitTarget: 5,
    trailingStop: 2,
    stopLossPercent: 7,
    maxConcurrentTrades: 2,
    voteThreshold: 4,
  };

  trades: StoredTrade[] = [];
  paperBalance = 100;
  liveBalance = 0;

  strategyStats: StrategyStats[] = [
    {
      id: "rsi",
      name: "RSI",
      description: "Relative Strength Index — identifies overbought/oversold momentum",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "macd",
      name: "MACD",
      description: "Moving Average Convergence Divergence — trend momentum crossovers",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "bollinger",
      name: "Bollinger Bands",
      description: "Volatility envelope — price breakout and mean reversion signals",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "ema",
      name: "EMA Crossover",
      description: "9/21 exponential moving average crossover — trend alignment",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "vwap",
      name: "VWAP",
      description: "Volume Weighted Average Price — institutional fair value benchmark",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "momentum",
      name: "Momentum",
      description: "Rate of change oscillator — measures raw price velocity",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
    {
      id: "ml",
      name: "ML Pattern",
      description: "Machine learning pattern recognition — adapts from trade outcomes",
      weight: 1.0,
      totalSignals: 0,
      successfulSignals: 0,
      profitContribution: 0,
      currentSignal: "inactive",
    },
  ];

  marketCache: Record<string, MarketEntry> = {};
  ohlcCache: Record<string, { candles: OHLCCandle[]; lastUpdated: number }> = {};

  // Pre-computed votes cache — updated in background, served instantly from GET /strategies/votes
  votesCache: import("./voting.js").VoteResult[] = [];
  votesCachedAt: string | null = null;

  learningCycles = 0;
  lastScanAt: string | null = null;
  running = false;

  getOpenTrades(): StoredTrade[] {
    return this.trades.filter((t) => t.status === "open");
  }

  getBalance(): number {
    return this.settings.mode === "paper" ? this.paperBalance : this.liveBalance;
  }

  /**
   * Total portfolio value: cash + money currently tied up in open trades.
   * For paper mode this keeps allocation stable as trades open/close — the
   * cash balance drops when a trade opens but the in-trade value rises by the
   * same amount, so the total stays constant and allocation percentages work
   * correctly across multiple concurrent trades.
   */
  getTotalPortfolioValue(): number {
    return this.settings.mode === "paper"
      ? this.paperBalance + this.getAmountInTrades()
      : this.liveBalance;
  }

  getAllocatedAmount(): number {
    return (this.getTotalPortfolioValue() * this.settings.allocation) / 100;
  }

  getAmountInTrades(): number {
    return this.getOpenTrades().reduce((sum, t) => sum + t.investedUsd, 0);
  }

  getAvailableForTrade(): number {
    return Math.max(0, this.getAllocatedAmount() - this.getAmountInTrades());
  }

  updateStrategyWeight(id: string, success: boolean, profitPercent: number): void {
    const stat = this.strategyStats.find((s) => s.id === id);
    if (!stat) return;
    stat.totalSignals++;
    if (success) {
      stat.successfulSignals++;
      stat.profitContribution += profitPercent;
    }
    const winRate = stat.totalSignals > 5 ? stat.successfulSignals / stat.totalSignals : 0.5;
    stat.weight = Math.max(0.2, Math.min(2.5, 0.3 + winRate * 2.2));
    this.learningCycles++;
  }

  getWinRate(): number {
    const closed = this.trades.filter((t) => t.status !== "open");
    if (!closed.length) return 0;
    const wins = closed.filter((t) => t.profitPercent > 0).length;
    return (wins / closed.length) * 100;
  }

  getTotalPnl(): number {
    return this.trades.filter((t) => t.status !== "open").reduce((sum, t) => sum + t.profitUsd, 0);
  }
}

export const store = new Store();
