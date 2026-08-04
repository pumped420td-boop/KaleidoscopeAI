import app from "./app";
import { logger } from "./lib/logger";
import { store } from "./lib/store";
import { refreshVotesCache, startVotesCacheTimer, startBot } from "./lib/trader";
import { loadMlState, saveMlState } from "./lib/persistence";

// Restore learned weights, balance, trades, settings — returns true if bot was running
const shouldAutoStart = loadMlState();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // After market cache warms up (~3s), do first votes computation then start background timer.
  // Also auto-resume the bot if it was running when the server last shut down (paper mode only).
  setTimeout(async () => {
    await refreshVotesCache();
    startVotesCacheTimer();
    logger.info("Votes cache initialized");

    // Always start the bot in paper mode on server start/restart/upgrade.
    // startBot() is idempotent — it no-ops if already running.
    if (!store.running) {
      await startBot();
      logger.info(shouldAutoStart ? "Bot auto-resumed from saved state" : "Bot auto-started (paper mode)");
    }
  }, 4_000);

  // Persist ML state every 5 minutes so learned weights survive restarts
  setInterval(saveMlState, 5 * 60_000);

  // Keep Render dyno alive — ping ourselves every 14 minutes so the free-tier
  // instance never hits the 15-minute inactivity sleep window.
  const RENDER_URL = process.env["RENDER_EXTERNAL_URL"];
  if (RENDER_URL) {
    setInterval(() => {
      fetch(`${RENDER_URL}/healthz`).catch(() => {});
    }, 14 * 60_000);
    logger.info({ url: RENDER_URL }, "Render keep-alive ping scheduled");
  }
});

// Save ML state before the process exits (SIGTERM from workflow restart, Ctrl-C, etc.)
function shutdown() {
  saveMlState();
  logger.info("ML state saved on shutdown");
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
