# Transcript — timezone-cutoff

## commands_run

- `npm run proof` (before fix) — failed: returned `1970-01-01`, expected `2026-07-01`
- `npm run invariant` (before fix) — failed: returned `1970-01-01`, expected `2026-06-30`
- `npm run proof` (after fix) — passed
- `npm run invariant` (after fix) — passed
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json` — passed

## files_changed

- `src/system.js` — implemented `billingDay(iso, timezone)` using `Intl.DateTimeFormat` with the `en-CA` locale (YYYY-MM-DD) and the tenant `timeZone` to derive the local calendar day from the ISO instant.

## verify_attempts

1. Attempt 1 — `status: "pass"` (proof ok, invariant ok)

## final_status

PASS

## short_reason

The stub returned a constant `1970-01-01`, ignoring both the instant and the tenant timezone. The fix formats the ISO instant in the tenant's timezone via `Intl.DateTimeFormat`, so a late-UTC event (06:30Z) correctly maps to the prior local billing day in Los Angeles (2026-06-30) while the UTC tenant still resolves to 2026-07-01. ReplayPack verify passed on the first attempt.
