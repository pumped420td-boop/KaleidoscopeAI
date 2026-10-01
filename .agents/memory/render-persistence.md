---
name: Render state persistence
description: The deployment storage requirement for preserving the trading bot state across Render redeploys.
---

The bot's JSON state snapshots are durable across Render redeploys only when the service has a mounted persistent disk and `DATA_DIR` points to that mount (the project convention is `/data`).

The user reported on 2026-10-01 that Render's persistent disk is mounted at `/data` and that settings restore across deployments. Settings and learning cycles share the same `bot-state.json`; the learning-cycle counter advances when a trade closes and strategy weights are updated, not on every scan.

**Why:** Render's ordinary service filesystem is ephemeral; code-level atomic writes protect against interrupted writes but cannot preserve files on a new instance without durable storage.

**How to apply:** Keep market prices out of persisted state and refetch them after startup. For Render, check startup logs for `dataDir: /data` and `Bot state restored` with the expected cycle count; compare `/api/strategies` or `/api/bot/status` after redeployment. If settings restore but cycles appear reset, check whether any trades closed and whether the production process is serving the updated build before changing the storage location.