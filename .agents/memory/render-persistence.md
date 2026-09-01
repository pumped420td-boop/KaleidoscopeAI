---
name: Render state persistence
description: The deployment storage requirement for preserving the trading bot state across Render redeploys.
---

The bot's JSON state snapshots are durable across Render redeploys only when the service has a mounted persistent disk and `DATA_DIR` points to that mount (the project convention is `/data`).

**Why:** Render's ordinary service filesystem is ephemeral; code-level atomic writes protect against interrupted writes but cannot preserve files on a new instance without durable storage.

**How to apply:** Keep market prices out of persisted state and refetch them after startup. For Render, verify the persistent disk mount and `DATA_DIR` configuration before claiming that trades, balances, or learned state survive redeployment.