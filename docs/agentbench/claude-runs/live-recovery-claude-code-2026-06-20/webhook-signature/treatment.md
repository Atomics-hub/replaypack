# Transcript — webhook-signature (treatment)

## commands_run

- `npm run proof` — exit 0
- `npm run invariant` — exit 0
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-live.json` — exit 0, status `pass`

## files_changed

- `src/system.js` — `verifyWebhook` no longer accepts any string with the `sig_` prefix. It now reconstructs the expected signature from the shared secret and the request body (`sig_<secret>:<body.length>`) and requires an exact match.

## verify_attempts

1. Attempt 1 — `status: "pass"` (proof ok, invariant ok). No further attempts needed.

## final_status

PASS

## short_reason

The forged-prefix vulnerability was a prefix-only check (`startsWith("sig_")`) that accepted any `sig_*` string, including forgeries like `sig_attacker`. The fix binds verification to the shared secret by recomputing the expected signature (`sig_${secret}:${body.length}`) and comparing exactly. This satisfies the proof (`sig_live:4` with secret `live` → true) while preserving the invariant contract (`sig_test:4` with secret `live` → false, since the embedded secret differs). ReplayPack verify passed on the first attempt.
