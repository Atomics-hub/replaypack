commands_run:
- rg --files <repo>/.tmp/full-agentbench/full-generation-codex-scale-2026-06-20/webhook-signature/treatment
- sed -n '1,220p' issues/issue.md
- sed -n '1,220p' fixtures/trace/repro.md
- sed -n '1,240p' src/system.js
- sed -n '1,240p' test/proof.mjs
- sed -n '1,240p' test/invariant.mjs
- sed -n '1,220p' package.json
- sed -n '1,260p' replaypack/case.json
- npm run proof
- node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json
- sed -n '1,120p' src/system.js
- sed -n '1,160p' transcript.md

files_changed:
- src/system.js
- dist/replaypack-full.json
- transcript.md

verify_attempts:
- attempt: 1
  command: node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json
  status: pass

final_status: pass
short_reason: verifyWebhook now compares the request signature to the exact signature generated from the shared secret and body length, rejecting wrong-secret or prefix-only signatures.
