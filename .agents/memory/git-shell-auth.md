---
name: Git shell authentication
description: Distinguish Git remote credentials from the Replit shell askpass helper when pushes fail.
---

Keep the Git remote free of embedded credentials. In this project, a push dry-run returned an invalid credential even after reconnecting Git Providers and removing URL userinfo; the shell helper remained a separate possible failure point. Always check the current branch and worktree state before acting because authentication and branch state can change independently.

**Why:** Repeating provider reconnects did not change the shell-side rejection and risks wasting time or exposing credentials.

**How to apply:** On a push failure, inspect the sanitized remote URL and configured askpass path without printing credentials. Check current branch/worktree status, and use an approved Git integration or Git pane if the shell helper remains invalid. Do not push or deploy without authorization.