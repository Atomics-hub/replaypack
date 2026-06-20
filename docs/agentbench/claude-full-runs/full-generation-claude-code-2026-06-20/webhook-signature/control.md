# Transcript

## commands_run

- `npm run proof`

## files_changed

- `src/system.js`

## final_status

PASS — `npm run proof` exits cleanly with no assertion failures.

## short_reason

`verifyWebhook` previously always returned `false`. The issue requires that only
signatures created with the shared secret verify, and the trace shows a forged
signature with the right prefix was being accepted. The fix reconstructs the full
expected signature from the secret and request body (`sig_${secret}:${body.length}`)
and requires an exact match, so the proof's valid `sig_live:4` over body `"paid"`
with secret `"live"` verifies while forged signatures sharing only the prefix are
rejected.
