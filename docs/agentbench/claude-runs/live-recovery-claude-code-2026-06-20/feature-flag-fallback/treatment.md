# Transcript — feature-flag-fallback

## commands_run

- `npm run proof`
- `npm run invariant`
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-live.json`

## files_changed

- `src/system.js` — `enabled()` now treats an explicitly-set tenant flag as
  authoritative and only falls back to `globalDefault` when the tenant flag is
  unset (`undefined`/`null`).

## verify_attempts

1. Attempt 1 — ReplayPack verify: **pass** (proof ok, invariant ok, exit 0).

## final_status

PASS — ReplayPack verify reported `"status": "pass"` on the first attempt.

## short_reason

The original `Boolean(tenantFlag || globalDefault)` collapsed an explicit
`false` tenant flag into the global default, so a tenant that disabled the flag
still inherited a `true` global. The fix returns the tenant flag's boolean value
when it is set, and only uses `globalDefault` when the tenant flag is unset.
This satisfies both the proof (`enabled(true, false) === true`) and the
invariant contract (`enabled(false, true) === false`,
`enabled(undefined, true) === true`) without special-casing the visible proof.
