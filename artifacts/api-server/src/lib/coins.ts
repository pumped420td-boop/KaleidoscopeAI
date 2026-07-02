export interface Coin {
  symbol: string;
  /** Binance.US trading pair symbol, e.g. "BTCUSD" */
  krakenPair: string;
  name: string;
  category: "crypto" | "meme";
}

export const COINS: Coin[] = [
  // ── Major Crypto ────────────────────────────────────────────────────────
  { symbol: "BTC",    krakenPair: "BTCUSD",    name: "Bitcoin",             category: "crypto" },
  { symbol: "ETH",    krakenPair: "ETHUSD",    name: "Ethereum",            category: "crypto" },
  { symbol: "SOL",    krakenPair: "SOLUSD",    name: "Solana",              category: "crypto" },
  { symbol: "XRP",    krakenPair: "XRPUSD",    name: "XRP",                 category: "crypto" },
  { symbol: "ADA",    krakenPair: "ADAUSD",    name: "Cardano",             category: "crypto" },
  { symbol: "AVAX",   krakenPair: "AVAXUSD",   name: "Avalanche",           category: "crypto" },
  { symbol: "DOT",    krakenPair: "DOTUSD",    name: "Polkadot",            category: "crypto" },
  { symbol: "LINK",   krakenPair: "LINKUSD",   name: "Chainlink",           category: "crypto" },
  { symbol: "LTC",    krakenPair: "LTCUSD",    name: "Litecoin",            category: "crypto" },
  { symbol: "MATIC",  krakenPair: "MATICUSD",  name: "Polygon",             category: "crypto" },
  { symbol: "UNI",    krakenPair: "UNIUSD",    name: "Uniswap",             category: "crypto" },
  { symbol: "ATOM",   krakenPair: "ATOMUSD",   name: "Cosmos",              category: "crypto" },
  { symbol: "XLM",    krakenPair: "XLMUSD",    name: "Stellar",             category: "crypto" },
  { symbol: "ALGO",   krakenPair: "ALGOUSD",   name: "Algorand",            category: "crypto" },
  { symbol: "NEAR",   krakenPair: "NEARUSD",   name: "NEAR Protocol",       category: "crypto" },
  { symbol: "FIL",    krakenPair: "FILUSD",    name: "Filecoin",            category: "crypto" },
  { symbol: "ETC",    krakenPair: "ETCUSD",    name: "Ethereum Classic",    category: "crypto" },
  { symbol: "BCH",    krakenPair: "BCHUSD",    name: "Bitcoin Cash",        category: "crypto" },
  { symbol: "AAVE",   krakenPair: "AAVEUSD",   name: "Aave",                category: "crypto" },
  { symbol: "MKR",    krakenPair: "MKRUSD",    name: "Maker",               category: "crypto" },
  { symbol: "COMP",   krakenPair: "COMPUSD",   name: "Compound",            category: "crypto" },
  { symbol: "GRT",    krakenPair: "GRTUSD",    name: "The Graph",           category: "crypto" },
  { symbol: "BAT",    krakenPair: "BATUSD",    name: "Basic Attention",     category: "crypto" },
  { symbol: "SNX",    krakenPair: "SNXUSD",    name: "Synthetix",           category: "crypto" },
  { symbol: "ZRX",    krakenPair: "ZRXUSD",    name: "0x Protocol",         category: "crypto" },
  { symbol: "1INCH",  krakenPair: "1INCHUSD",  name: "1inch",               category: "crypto" },
  { symbol: "CRV",    krakenPair: "CRVUSD",    name: "Curve DAO",           category: "crypto" },
  { symbol: "SUSHI",  krakenPair: "SUSHIUSD",  name: "SushiSwap",           category: "crypto" },
  { symbol: "HBAR",   krakenPair: "HBARUSD",   name: "Hedera",              category: "crypto" },
  { symbol: "ENS",    krakenPair: "ENSUSD",    name: "Ethereum Name Svc",   category: "crypto" },
  // ── Meme / Alt ──────────────────────────────────────────────────────────
  { symbol: "DOGE",   krakenPair: "DOGEUSD",   name: "Dogecoin",            category: "meme" },
  { symbol: "SHIB",   krakenPair: "SHIBUSD",   name: "Shiba Inu",           category: "meme" },
  { symbol: "PEPE",   krakenPair: "PEPEUSD",   name: "Pepe",                category: "meme" },
  { symbol: "TRX",    krakenPair: "TRXUSD",    name: "TRON",                category: "meme" },
  { symbol: "ANKR",   krakenPair: "ANKRUSD",   name: "Ankr",                category: "meme" },
  { symbol: "CHZ",    krakenPair: "CHZUSD",    name: "Chiliz",              category: "meme" },
  { symbol: "SAND",   krakenPair: "SANDUSD",   name: "The Sandbox",         category: "meme" },
  { symbol: "MANA",   krakenPair: "MANAUSD",   name: "Decentraland",        category: "meme" },
  { symbol: "GALA",   krakenPair: "GALAUSD",   name: "Gala",                category: "meme" },
  { symbol: "ENJ",    krakenPair: "ENJUSD",    name: "Enjin Coin",          category: "meme" },
  { symbol: "LRC",    krakenPair: "LRCUSD",    name: "Loopring",            category: "meme" },
  { symbol: "BAL",    krakenPair: "BALUSD",    name: "Balancer",            category: "meme" },
  { symbol: "STORJ",  krakenPair: "STORJUSD",  name: "Storj",               category: "meme" },
  { symbol: "BAND",   krakenPair: "BANDUSD",   name: "Band Protocol",       category: "meme" },
  { symbol: "YFI",    krakenPair: "YFIUSD",    name: "yearn.finance",       category: "meme" },
  { symbol: "OMG",    krakenPair: "OMGUSD",    name: "OMG Network",         category: "meme" },
  { symbol: "KAVA",   krakenPair: "KAVAUSD",   name: "Kava",                category: "meme" },
  { symbol: "XTZ",    krakenPair: "XTZUSD",    name: "Tezos",               category: "meme" },
  { symbol: "REN",    krakenPair: "RENUSD",    name: "Ren",                 category: "meme" },
  { symbol: "CELR",   krakenPair: "CELRUSD",   name: "Celer Network",       category: "meme" },
  { symbol: "OGN",    krakenPair: "OGNUSD",    name: "Origin Protocol",     category: "meme" },
];

export function getCoinBySymbol(symbol: string): Coin | undefined {
  return COINS.find((c) => c.symbol === symbol);
}

export function getCoinByPair(pair: string): Coin | undefined {
  return COINS.find((c) => c.krakenPair === pair);
}
