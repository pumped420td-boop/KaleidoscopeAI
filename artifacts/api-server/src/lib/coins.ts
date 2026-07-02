export interface Coin {
  symbol: string;
  /** Binance.US trading pair symbol, e.g. "BTCUSD" */
  pair: string;
  name: string;
  category: "crypto" | "meme";
}

export const COINS: Coin[] = [
  // ── Major Crypto ────────────────────────────────────────────────────────
  { symbol: "BTC",    pair: "BTCUSD",    name: "Bitcoin",             category: "crypto" },
  { symbol: "ETH",    pair: "ETHUSD",    name: "Ethereum",            category: "crypto" },
  { symbol: "SOL",    pair: "SOLUSD",    name: "Solana",              category: "crypto" },
  { symbol: "XRP",    pair: "XRPUSD",    name: "XRP",                 category: "crypto" },
  { symbol: "ADA",    pair: "ADAUSD",    name: "Cardano",             category: "crypto" },
  { symbol: "AVAX",   pair: "AVAXUSD",   name: "Avalanche",           category: "crypto" },
  { symbol: "DOT",    pair: "DOTUSD",    name: "Polkadot",            category: "crypto" },
  { symbol: "LINK",   pair: "LINKUSD",   name: "Chainlink",           category: "crypto" },
  { symbol: "LTC",    pair: "LTCUSD",    name: "Litecoin",            category: "crypto" },
  { symbol: "MATIC",  pair: "MATICUSD",  name: "Polygon",             category: "crypto" },
  { symbol: "UNI",    pair: "UNIUSD",    name: "Uniswap",             category: "crypto" },
  { symbol: "ATOM",   pair: "ATOMUSD",   name: "Cosmos",              category: "crypto" },
  { symbol: "XLM",    pair: "XLMUSD",    name: "Stellar",             category: "crypto" },
  { symbol: "ALGO",   pair: "ALGOUSD",   name: "Algorand",            category: "crypto" },
  { symbol: "NEAR",   pair: "NEARUSD",   name: "NEAR Protocol",       category: "crypto" },
  { symbol: "FIL",    pair: "FILUSD",    name: "Filecoin",            category: "crypto" },
  { symbol: "ETC",    pair: "ETCUSD",    name: "Ethereum Classic",    category: "crypto" },
  { symbol: "BCH",    pair: "BCHUSD",    name: "Bitcoin Cash",        category: "crypto" },
  { symbol: "AAVE",   pair: "AAVEUSD",   name: "Aave",                category: "crypto" },
  { symbol: "MKR",    pair: "MKRUSD",    name: "Maker",               category: "crypto" },
  { symbol: "COMP",   pair: "COMPUSD",   name: "Compound",            category: "crypto" },
  { symbol: "GRT",    pair: "GRTUSD",    name: "The Graph",           category: "crypto" },
  { symbol: "BAT",    pair: "BATUSD",    name: "Basic Attention",     category: "crypto" },
  { symbol: "SNX",    pair: "SNXUSD",    name: "Synthetix",           category: "crypto" },
  { symbol: "ZRX",    pair: "ZRXUSD",    name: "0x Protocol",         category: "crypto" },
  { symbol: "1INCH",  pair: "1INCHUSD",  name: "1inch",               category: "crypto" },
  { symbol: "CRV",    pair: "CRVUSD",    name: "Curve DAO",           category: "crypto" },
  { symbol: "SUSHI",  pair: "SUSHIUSD",  name: "SushiSwap",           category: "crypto" },
  { symbol: "HBAR",   pair: "HBARUSD",   name: "Hedera",              category: "crypto" },
  { symbol: "ENS",    pair: "ENSUSD",    name: "Ethereum Name Svc",   category: "crypto" },
  // ── Meme / Alt ──────────────────────────────────────────────────────────
  { symbol: "DOGE",   pair: "DOGEUSD",   name: "Dogecoin",            category: "meme" },
  { symbol: "SHIB",   pair: "SHIBUSD",   name: "Shiba Inu",           category: "meme" },
  { symbol: "PEPE",   pair: "PEPEUSD",   name: "Pepe",                category: "meme" },
  { symbol: "TRX",    pair: "TRXUSD",    name: "TRON",                category: "meme" },
  { symbol: "ANKR",   pair: "ANKRUSD",   name: "Ankr",                category: "meme" },
  { symbol: "CHZ",    pair: "CHZUSD",    name: "Chiliz",              category: "meme" },
  { symbol: "SAND",   pair: "SANDUSD",   name: "The Sandbox",         category: "meme" },
  { symbol: "MANA",   pair: "MANAUSD",   name: "Decentraland",        category: "meme" },
  { symbol: "GALA",   pair: "GALAUSD",   name: "Gala",                category: "meme" },
  { symbol: "ENJ",    pair: "ENJUSD",    name: "Enjin Coin",          category: "meme" },
  { symbol: "LRC",    pair: "LRCUSD",    name: "Loopring",            category: "meme" },
  { symbol: "BAL",    pair: "BALUSD",    name: "Balancer",            category: "meme" },
  { symbol: "STORJ",  pair: "STORJUSD",  name: "Storj",               category: "meme" },
  { symbol: "BAND",   pair: "BANDUSD",   name: "Band Protocol",       category: "meme" },
  { symbol: "YFI",    pair: "YFIUSD",    name: "yearn.finance",       category: "meme" },
  { symbol: "OMG",    pair: "OMGUSD",    name: "OMG Network",         category: "meme" },
  { symbol: "KAVA",   pair: "KAVAUSD",   name: "Kava",                category: "meme" },
  { symbol: "XTZ",    pair: "XTZUSD",    name: "Tezos",               category: "meme" },
  { symbol: "REN",    pair: "RENUSD",    name: "Ren",                 category: "meme" },
  { symbol: "CELR",   pair: "CELRUSD",   name: "Celer Network",       category: "meme" },
  { symbol: "OGN",    pair: "OGNUSD",    name: "Origin Protocol",     category: "meme" },
];

export function getCoinBySymbol(symbol: string): Coin | undefined {
  return COINS.find((c) => c.symbol === symbol);
}

export function getCoinByPair(pair: string): Coin | undefined {
  return COINS.find((c) => c.pair === pair);
}
