---
name: Trade-signal churn
description: The intended guard against repeated sell-and-reopen cycles near a vote threshold.
---

Trade entries and vote-based exits must use the same weighted buy eligibility rule. After a vote-based sell, keep that symbol out of new entries for five minutes, including across a server restart.

**Why:** Different entry and exit rules let an open position close while the same scan still labeled it a buy, creating repeated trades at nearly identical prices.

**How to apply:** When changing trade-signal thresholds or cooldown behavior, keep the entry/exit rule symmetric and preserve the cooldown in durable bot state.