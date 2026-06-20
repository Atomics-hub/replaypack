# Transcript: timezone-cutoff

## commands_run

- `ls -la` — survey the assignment directory
- `find src issues test fixtures -type f | sort` — enumerate files
- `npm run proof` — validation command (passed)
- `node --input-type=module -e '... billingDay ...'` — sanity-check UTC and Los Angeles cases

## files_changed

- `src/system.js` — implemented `billingDay(iso, timezone)` to return the calendar day in the tenant's timezone using `Intl.DateTimeFormat` instead of the hardcoded `"1970-01-01"` stub.

## final_status

PASS — `npm run proof` exits 0.

## short_reason

The billing cutoff must respect the tenant timezone, not UTC. The original `billingDay` was a stub returning `"1970-01-01"`. The fix formats the instant in the given `timezone` via `Intl.DateTimeFormat(...).formatToParts`, yielding a `YYYY-MM-DD` local day. This satisfies the proof (`2026-07-01T12:00:00Z` in `UTC` → `2026-07-01`) and the trace: a late UTC event (`2026-07-02T05:00:00Z` = 22:00 PDT) correctly maps to the prior local billing day `2026-07-01` in `America/Los_Angeles`.
