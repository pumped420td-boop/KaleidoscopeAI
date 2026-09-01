---
name: Binance.US active universe
description: Binance.US market-status and ticker behavior used to keep the configured USD trading universe valid.
---

The configured universe must be limited to pairs whose Binance.US `exchangeInfo` status is `TRADING` and whose current `ticker/24hr` `lastPrice` is greater than zero. A symbol can remain listed as `TRADING` while having no trades and a zero last price.

**Why:** Keeping a zero-price ticker in the configured universe leaves an old cache value behind or creates false stale-feed warnings, and can expose inactive markets to signal generation.

**How to apply:** Revalidate the USD pair list against both endpoints after Binance.US market changes. Treat non-TRADING and zero-price symbols as unavailable; do not use their previous cached prices.