# Transcript — feature-flag-fallback

## commands_run

- `npm run proof`
- `npm run invariant`
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json`

## files_changed

- `src/system.js` — `enabled()` ignored `tenantFlag` and always returned `Boolean(globalDefault)`. Changed it to honor an explicit tenant flag and fall back to the global default only when the tenant flag is `undefined`:
  ```js
  return Boolean(tenantFlag === undefined ? globalDefault : tenantFlag);
  ```

## verify_attempts

1. Attempt 1 — `status: pass` (exit 0). Proof ok, invariant ok.

## final_status

PASS — ReplayPack verify passed on attempt 1.

## short_reason

The feature flag resolver discarded the tenant override and returned the global default unconditionally, so an explicit tenant `false` was overridden by global `true`. The fix returns the tenant flag when it is set and only falls back to the global default when the tenant flag is `undefined`. This satisfies the proof (`enabled(true, false) === true`) and both invariants (`enabled(false, true) === false`, `enabled(undefined, true) === true`) without fixing only the visible proof case.
