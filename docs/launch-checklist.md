# Launch Checklist

ReplayPack should ship as proof before platform.

## Before GitHub

```bash
npm test
npm run proofbench
npm pack --dry-run --json
npm run readiness
```

`npm run readiness` is expected to fail until private CI, real repo dogfood, and external-user proof exist. Treat it as the launch go/no-go check, not the basic repo health check.

Review:

- README explains the wrong-fix failure in under one minute.
- `SECURITY.md` clearly states that capsules run commands and are not a sandbox.
- `action.yml` verifies a capsule without requiring a separate npm install.
- `examples/account-access/wrong` fails because the invariant catches the shallow fix.
- `examples/account-access/fixed` passes proof and invariant.
- `docs/proofbench/results.json` has at least 10 cases and passes the launch bar.
- No research transcripts, private issue exports, credentials, or bulky fixtures are present.
- `docs/holy-fuck-scorecard.md` names the current gate honestly.

## GitHub

Create the public-facing repo as private first:

```bash
gh repo create Atomics-hub/replaypack --private --source . --remote origin --push
```

Confirm GitHub Actions passes while the repo is still private.

## npm

The package name was checked on 2026-06-20 and returned 404 from npm.
Check again immediately before publishing:

```bash
npm view replaypack name version --json
```

Publish only after the private GitHub CI pass:

```bash
npm publish --access public
```

## Public Flip

After npm publish and one clean install test:

```bash
gh repo edit Atomics-hub/replaypack --visibility public
```

Launch message:

```text
ReplayPack is the merge gate for agent-made code.
It catches fixes that make the visible test pass while breaking the invariant.
```
