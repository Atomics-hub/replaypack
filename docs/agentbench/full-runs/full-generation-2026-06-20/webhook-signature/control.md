commands_run:
- sed -n '1,240p' agent-task.md
- rg --files
- sed -n '1,260p' src/system.js
- sed -n '1,260p' issues/issue.md
- sed -n '1,260p' fixtures/trace/repro.md
- sed -n '1,260p' test/proof.mjs
- npm run proof

files_changed:
- src/system.js
- transcript.md

final_status: proof_passed

short_reason: Implemented exact webhook signature verification by comparing against the expected `sig_<secret>:<body length>` value, so matching prefixes alone do not verify.
