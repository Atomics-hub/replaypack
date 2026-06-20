# Launch Checklist

ReplayPack should ship as proof before platform.

## Before GitHub/Npm Launch

```bash
npm test
npm run proofbench
npm run agentbench
npm run live-agentbench:prepare
npm run live-agentbench:evaluate
npm run full-agentbench:prepare
npm run full-agentbench:evaluate
npm run public-repo-trials
npm pack --dry-run --json
npm run readiness
```

`npm run readiness` is expected to fail until external-user proof exists. Treat it as the market go/no-go check, not the package health check.

Review:

- README explains the wrong-fix failure in under one minute.
- `SECURITY.md` clearly states that capsules run commands and are not a sandbox.
- `action.yml` verifies a capsule without requiring a separate npm install.
- `examples/account-access/wrong` fails because the invariant catches the shallow fix.
- `examples/account-access/fixed` passes proof and invariant.
- `docs/proofbench/results.json` has at least 30 cases and passes the launch bar.
- `docs/agentbench/results.json` shows visible-only false done, ReplayPack prevention, and recovery.
- `docs/validation/live-agent-proof.json` shows at least one live recovery trial.
- `docs/validation/claude-code-agent-proof.json` shows at least one non-Codex live recovery trial.
- `docs/validation/full-agent-proof.json` shows at least one live full task generation trial.
- `docs/public-repo-trials/results.json` shows private public-repo trials passing.
- No research transcripts, private issue exports, credentials, or bulky fixtures are present.
- `docs/holy-fuck-scorecard.md` names the current gate honestly.

## GitHub Public Beta

Create the public-facing repo as private first:

```bash
gh repo create Atomics-hub/replaypack --private --source . --remote origin --push
```

Confirm GitHub Actions passes while the repo is still private.

Then create the beta tester issue from `docs/trials/beta-tester-issue.md` and flip the repo public:

```bash
gh issue create --repo Atomics-hub/replaypack --title "Beta testers: run the 10-minute ReplayPack trial" --body-file docs/trials/beta-tester-issue.md
gh repo edit Atomics-hub/replaypack --visibility public
```

## npm

The package name was checked on 2026-06-20 and returned 404 from npm.
Check again immediately before publishing:

```bash
npm view replaypack name version --json
```

Publish only after GitHub CI, tarball install, proofbench, public-repo trials, release notes, and security note pass:

```bash
npm publish --access public
```

After publish:

```bash
npm view replaypack version dist-tags --json
npm install --save-dev replaypack
npx replaypack --version
```

Launch message:

```text
ReplayPack is the done-contract for coding agents.
It keeps agents from saying done when the visible test passes but the invariant is broken.
```
