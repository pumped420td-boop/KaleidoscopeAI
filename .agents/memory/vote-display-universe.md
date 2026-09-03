---
name: Vote display universe
description: Separation between the market/vote display set and the trading eligibility set.
---

Live Votes should include every valid current market pair so its count matches the Market tab. The trading engine may still apply liquidity thresholds when selecting entries, swaps, or other executable opportunities.

**Why:** A liquidity filter used for trading was previously reused for the votes cache, making the UI appear to lose coins even though the markets were valid.

**How to apply:** Compute votes from the complete cached active universe, then filter the results separately for trade-opening and swap decisions. Preserve missing-data behavior for exit logic.