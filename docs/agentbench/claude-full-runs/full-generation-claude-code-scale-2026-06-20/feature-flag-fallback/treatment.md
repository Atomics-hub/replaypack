# Transcript — feature-flag-fallback (treatment)

## commands_run

- `npm run proof` — passed (exit 0)
- `npm run invariant` — passed (exit 0)
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json` — passed (status: pass, exit 0)

## files_changed

- `src/system.js` — fixed `enabled(tenantFlag, globalDefault)` to honor an explicitly set tenant flag and only fall back to the global default when the tenant flag is unset.

## verify_attempts

1. Attempt 1 — `status: pass` (exit 0). Proof ok, invariant ok.

## final_status

PASS — ReplayPack verify succeeded on the first attempt; evidence written to `dist/replaypack-full.json`.

## short_reason

The original `enabled` ignored `tenantFlag` and always returned `Boolean(globalDefault)`, so an explicit tenant `false` was overridden by a global `true` (checkout stayed enabled). The fix returns the tenant flag when it is explicitly set (`tenantFlag == null ? Boolean(globalDefault) : Boolean(tenantFlag)`), falling back to the global default only when the tenant flag is `undefined`/`null`. This satisfies the proof (`enabled(true, false) === true`) without breaking the invariant contract (`enabled(false, true) === false`, `enabled(undefined, true) === true`).
