export interface Coin {
  symbol: string;
  /** Binance.US spot trading pair, e.g. "BTCUSD" */
  pair: string;
  name: string;
  category: "crypto" | "meme";
}

// All 52 real Binance.US USD spot-trading pairs (TRADING status, isSpotTradingAllowed).
// Source: GET https://api.binance.us/api/v3/exchangeInfo — queried 2026-07-02.
// Excludes USDCUSD and USDTUSD (stablecoins).
export const COINS: Coin[] = [
  // ── Major Crypto ────────────────────────────────────────────────────────────
  { symbol: "BTC",    pair: "BTCUSD",    name: "Bitcoin",            category: "crypto" },
  { symbol: "ETH",    pair: "ETHUSD",    name: "Ethereum",           category: "crypto" },
  { symbol: "SOL",    pair: "SOLUSD",    name: "Solana",             category: "crypto" },
  { symbol: "XRP",    pair: "XRPUSD",    name: "XRP",                category: "crypto" },
  { symbol: "BNB",    pair: "BNBUSD",    name: "BNB",                category: "crypto" },
  { symbol: "ADA",    pair: "ADAUSD",    name: "Cardano",            category: "crypto" },
  { symbol: "AVAX",   pair: "AVAXUSD",   name: "Avalanche",          category: "crypto" },
  { symbol: "DOT",    pair: "DOTUSD",    name: "Polkadot",           category: "crypto" },
  { symbol: "LINK",   pair: "LINKUSD",   name: "Chainlink",          category: "crypto" },
  { symbol: "LTC",    pair: "LTCUSD",    name: "Litecoin",           category: "crypto" },
  { symbol: "UNI",    pair: "UNIUSD",    name: "Uniswap",            category: "crypto" },
  { symbol: "ATOM",   pair: "ATOMUSD",   name: "Cosmos",             category: "crypto" },
  { symbol: "XLM",    pair: "XLMUSD",    name: "Stellar",            category: "crypto" },
  { symbol: "ALGO",   pair: "ALGOUSD",   name: "Algorand",           category: "crypto" },
  { symbol: "NEAR",   pair: "NEARUSD",   name: "NEAR Protocol",      category: "crypto" },
  { symbol: "ICP",    pair: "ICPUSD",    name: "Internet Computer",  category: "crypto" },
  { symbol: "OP",     pair: "OPUSD",     name: "Optimism",           category: "crypto" },
  { symbol: "SUI",    pair: "SUIUSD",    name: "Sui",                category: "crypto" },
  { symbol: "HBAR",   pair: "HBARUSD",   name: "Hedera",             category: "crypto" },
  { symbol: "RENDER", pair: "RENDERUSD", name: "Render",             category: "crypto" },
  { symbol: "FET",    pair: "FETUSD",    name: "Fetch.ai",           category: "crypto" },
  { symbol: "GRT",    pair: "GRTUSD",    name: "The Graph",          category: "crypto" },
  { symbol: "ENS",    pair: "ENSUSD",    name: "Ethereum Name Svc",  category: "crypto" },
  { symbol: "AAVE",   pair: "AAVEUSD",   name: "Aave",               category: "crypto" },
  { symbol: "CRV",    pair: "CRVUSD",    name: "Curve DAO",          category: "crypto" },
  { symbol: "SUSHI",  pair: "SUSHIUSD",  name: "SushiSwap",          category: "crypto" },
  { symbol: "THETA",  pair: "THETAUSD",  name: "Theta Network",      category: "crypto" },
  { symbol: "ZEC",    pair: "ZECUSD",    name: "Zcash",              category: "crypto" },
  { symbol: "POL",    pair: "POLUSD",    name: "Polygon",            category: "crypto" },
  { symbol: "LPT",    pair: "LPTUSD",    name: "Livepeer",           category: "crypto" },
  { symbol: "JUP",    pair: "JUPUSD",    name: "Jupiter",            category: "crypto" },
  { symbol: "ETC",    pair: "ETCUSD",    name: "Ethereum Classic",   category: "crypto" },
  { symbol: "BCH",    pair: "BCHUSD",    name: "Bitcoin Cash",       category: "crypto" },
  // ── Meme / Alt ──────────────────────────────────────────────────────────────
  { symbol: "DOGE",   pair: "DOGEUSD",   name: "Dogecoin",           category: "meme" },
  { symbol: "SHIB",   pair: "SHIBUSD",   name: "Shiba Inu",          category: "meme" },
  { symbol: "PEPE",   pair: "PEPEUSD",   name: "Pepe",               category: "meme" },
  { symbol: "FLOKI",  pair: "FLOKIUSD",  name: "Floki",              category: "meme" },
  { symbol: "BONK",   pair: "BONKUSD",   name: "Bonk",               category: "meme" },
  { symbol: "TRUMP",  pair: "TRUMPUSD",  name: "Official Trump",     category: "meme" },
  { symbol: "TRX",    pair: "TRXUSD",    name: "TRON",               category: "meme" },
  { symbol: "GALA",   pair: "GALAUSD",   name: "Gala",               category: "meme" },
  { symbol: "SAND",   pair: "SANDUSD",   name: "The Sandbox",        category: "meme" },
  { symbol: "VET",    pair: "VETUSD",    name: "VeChain",            category: "meme" },
  { symbol: "VTHO",   pair: "VTHOUSD",   name: "VeThor",             category: "meme" },
  { symbol: "IOTA",   pair: "IOTAUSD",   name: "IOTA",               category: "meme" },
  { symbol: "RVN",    pair: "RVNUSD",    name: "Ravencoin",          category: "meme" },
  { symbol: "ZIL",    pair: "ZILUSD",    name: "Zilliqa",            category: "meme" },
  { symbol: "ONE",    pair: "ONEUSD",    name: "Harmony",            category: "meme" },
  { symbol: "DGB",    pair: "DGBUSD",    name: "DigiByte",           category: "meme" },
  { symbol: "HYPE",   pair: "HYPEUSD",   name: "Hyperliquid",        category: "meme" },
  { symbol: "S",      pair: "SUSD",      name: "Sonic",              category: "meme" },
  { symbol: "ME",     pair: "MEUSD",     name: "Magic Eden",         category: "meme" },
];

export function getCoinBySymbol(symbol: string): Coin | undefined {
  return COINS.find((c) => c.symbol === symbol);
}

export function getCoinByPair(pair: string): Coin | undefined {
  return COINS.find((c) => c.pair === pair);
}
