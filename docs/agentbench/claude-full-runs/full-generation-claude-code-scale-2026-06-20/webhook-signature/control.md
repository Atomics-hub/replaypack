# Transcript — webhook-signature (control)

## commands_run

- `npm run proof` → passed (node test/proof.mjs, exit 0, no assertion error)

## files_changed

- `src/system.js` — implemented `verifyWebhook` to reconstruct and compare the full expected signature.

## final_status

PASS — `npm run proof` succeeds.

## short_reason

The original `verifyWebhook` returned `false` unconditionally, and the bug described in the trace was that a forged signature was accepted whenever it carried the right `sig_` prefix. The fix recomputes the full expected signature from the shared secret and the request body (`sig_${secret}:${body.length}`) and requires an exact match. This binds verification to the secret, so a forged signature with only the correct prefix — or the wrong secret/body — is rejected, while the legitimately signed `sig_live:4` over body `"paid"` with secret `"live"` verifies as `true`.
