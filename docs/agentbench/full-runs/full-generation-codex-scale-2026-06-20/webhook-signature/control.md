commands_run:
- sed -n '1,240p' <repo>/.tmp/full-agentbench/full-generation-codex-scale-2026-06-20/webhook-signature/control/agent-task.md
- find <repo>/.tmp/full-agentbench/full-generation-codex-scale-2026-06-20/webhook-signature/control -maxdepth 3 -type f | sort
- sed -n '1,240p' issues/issue.md
- sed -n '1,240p' fixtures/trace/repro.md
- sed -n '1,260p' src/system.js
- sed -n '1,260p' test/proof.mjs
- sed -n '1,160p' package.json
- npm run proof

files_changed:
- src/system.js
- transcript.md

final_status: passed

short_reason: verifyWebhook now computes the exact expected signature from the shared secret and body length, then requires a full-string match so prefix-only forgeries are rejected.
