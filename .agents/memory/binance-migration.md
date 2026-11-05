---
name: Binance.US migration
description: Exchange replaced from Kraken to Binance.US; key differences in API shape and signing.
---

## What changed
- `artifacts/api-server/src/lib/kraken.ts` fully rewritten to call `https://api.binance.us`. File name kept to avoid touching all importers.
- `artifacts/api-server/src/lib/coins.ts` — 50 USD pairs (not USDT/USDC), Binance.US symbols stored in the `krakenPair` field (e.g. `BTCUSD`).

## API differences vs Kraken
- Ticker batch: `GET /api/v3/ticker/24hr?symbols=["BTCUSD","ETHUSD"]` → returns array of `{ symbol, lastPrice, openPrice, highPrice, lowPrice, volume, quoteVolume }`.
- OHLC: `GET /api/v3/klines?symbol=BTCUSD&interval=1h&limit=100` → row[0] is openTime in **milliseconds** (divide by 1000 for store).
- Private signing: HMAC-SHA256 of the URL query string (not Kraken's two-step SHA256+HMAC-SHA512). Header is `X-MBX-APIKEY`.
- Account balance: `GET /api/v3/account` → `{ balances: [{ asset, free, locked }] }`. USD key is `"USD"`.
- Market buy uses `quoteOrderQty` (spend X dollars). Market sell uses `quantity` (sell X units).

## Live trade sizing

For live buys, store Binance's returned `executedQty` as the trade quantity rather than retaining the estimated amount. For live sells, submit 99.5% of that filled quantity, floored to the applicable exchange step size.

**Why:** Trading fees can reduce the available base-asset balance below the gross executed buy quantity.

**How to apply:** Keep sell submissions at or below the reported buy fill. Treat this as execution sizing; do not alter voting, trailing-stop, or scan behavior unless explicitly requested.

## Credentials

Private Binance.US requests read only `process.env.BINANCE_API_KEY` and `process.env.BINANCE_SECRET`. Credentials must be configured in the API server environment; there is no app-submitted, local `.env`, or hardcoded fallback.

**Why:** The user explicitly requested environment-only credentials after Render reported that API keys were not configured.

**How to apply:** If Binance reports missing credentials, verify those exact variable names in Render and redeploy/restart the API. Never ask for or print their values.

## On migration
Delete `artifacts/api-server/data/bot-state.json` — saved trades reference old Kraken pair names and will fail lookups.

**Why:** Binance.US pair symbols (BTCUSD) differ from Kraken's (XXBTZUSD). Old state is incompatible.
