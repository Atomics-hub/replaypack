commands_run:
- sed -n '1,240p' <repo>/.tmp/full-agentbench/full-generation-codex-scale-2026-06-20/feature-flag-fallback/treatment/agent-task.md
- rg --files
- sed -n '1,220p' package.json
- sed -n '1,220p' issues/issue.md
- sed -n '1,220p' fixtures/trace/repro.md
- sed -n '1,260p' src/system.js
- sed -n '1,260p' test/proof.mjs
- sed -n '1,260p' test/invariant.mjs
- sed -n '1,260p' replaypack/case.json
- npm run proof
- node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json

files_changed:
- src/system.js
- dist/replaypack-full.json
- transcript.md

verify_attempts: 1

final_status: pass

short_reason: Explicit tenant flags are now honored before falling back to the global default, so tenant false overrides global true while undefined still uses the global default.
