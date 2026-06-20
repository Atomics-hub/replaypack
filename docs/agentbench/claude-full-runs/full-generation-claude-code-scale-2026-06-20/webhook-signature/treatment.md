# Transcript — webhook-signature

## commands_run

- `npm run proof` — exit 0 (pass)
- `npm run invariant` — exit 0 (pass)
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json` — exit 0, status `pass`

## files_changed

- `src/system.js` — implemented `verifyWebhook` to recompute the expected signature `sig_${secret}:${request.body.length}` and compare with strict equality (`===`).

## verify_attempts

1. Attempt 1 — `status: "pass"` (proof ok, invariant ok). No further attempts needed.

## final_status

PASS — ReplayPack verify returned `status: "pass"` with proof and invariant both green.

## short_reason

`verifyWebhook` was a stub returning `false`. The capsule/trace showed the real bug class is prefix acceptance: a forged signature with the right prefix (`sig_attacker`) was accepted. The fix derives the expected signature from the secret and body length and uses strict equality, so a legitimate `sig_live:4` passes (proof) while a wrong-secret `sig_test:4` and any forged prefix fail (invariant + trace). This fixes the general bug, not just the visible proof, preserving the invariant contract.
