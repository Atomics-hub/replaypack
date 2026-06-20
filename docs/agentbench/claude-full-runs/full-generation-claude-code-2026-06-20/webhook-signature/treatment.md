# Transcript — webhook-signature

## commands_run

- `npm run proof` — exit 0
- `npm run invariant` — exit 0
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json` — exit 0 (status: pass)

## files_changed

- `src/system.js` — implemented `verifyWebhook` to compute the expected signature `sig_<secret>:<body.length>` and compare it for exact equality.

## verify_attempts

1. Attempt 1 — **pass**. Proof ok, invariant ok, ReplayPack status `pass`.

## final_status

PASS

## short_reason

The stub `verifyWebhook` returned `false` unconditionally. The signature scheme is
`sig_<secret>:<body.length>`. The fix derives the expected signature from the shared
secret and the request body length and compares it with exact string equality. This
rejects forged signatures that merely share the right prefix (the documented vulnerability)
while accepting legitimately signed requests. Both the proof (`sig_live:4` with secret
`live` → true) and the invariant (`sig_test:4` with secret `live` → false) pass, and
ReplayPack verify reports `pass` on the first attempt.
