---
name: Render state persistence
description: The deployment storage requirement for preserving the trading bot state across Render redeploys.
---

The state file is intentionally stored under the relative `./data` directory after the user reported `EACCES` creating `/data` on Render. The path ignores `DATA_DIR` so an absolute `/data` override cannot reintroduce the error.

**Why:** Render denied permission to create `/data`; the user explicitly requested a relative path. A relative directory avoids that permission error but may not survive Render restarts or redeploys.

**How to apply:** Keep writes relative to the app working directory unless the user changes this decision. The state filename remains `bot-state.json`; create its parent directory with recursive `mkdirSync` before writing. Warn that relative Render storage can be ephemeral.

At startup, `LIVE_MODE` overrides the mode restored from the state file: only the exact value `"true"` selects live mode; missing or any other value selects paper mode.

**Why:** The user confirmed that the environment setting must take precedence and approved live auto-start behavior.

**How to apply:** Apply the environment mode immediately after loading persisted state. `index.ts` auto-starts the bot, so `LIVE_MODE=true` can place real Binance.US orders after a restart.