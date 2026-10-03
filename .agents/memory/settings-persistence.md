---
name: Settings persistence gotcha
description: Spreading saved settings from disk can silently clobber new default fields with undefined.
---

## The rule
When `loadMlState()` restores settings with `{ ...store.settings, ...state.settings }`, any field present as `undefined` in `state.settings` **wins** and overrides the default. This happens when a field is added to the schema after the bot-state.json was written.

**Fix pattern:**
```typescript
store.settings = {
  ...store.settings,
  ...state.settings,
  newField: state.settings.newField ?? store.settings.newField, // preserve default
  mode: "paper",
};
```

**Why:** `{ ...{ x: 7 }, ...{ x: undefined } }` evaluates to `{ x: undefined }` in JS. Spreading does not skip undefined values.

**How to apply:** Any time a new field is added to `StoredSettings` (store.ts), also add a `?? store.settings.<field>` line in the `persistence.ts` loadMlState block to guard against old save files.

## Hard stop loss setting
The intended hard stop loss default and mobile fallback are 2%.

**Why:** The user explicitly said the hard stop should remain at 2%; a stale 7% fallback made the app show a value that differed from the intended setting.

**How to apply:** Keep backend defaults, mobile form fallbacks, and saved settings aligned at 2%, while allowing an explicitly saved setting to restore normally.
