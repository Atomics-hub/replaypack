# Launch Checklist

ReplayPack should ship as proof before platform.

## Before GitHub

```bash
npm test
npm pack --dry-run --json
```

Review:

- README explains the wrong-fix failure in under one minute.
- `SECURITY.md` clearly states that capsules run commands and are not a sandbox.
- `action.yml` verifies a capsule without requiring a separate npm install.
- `examples/account-access/wrong` fails because the invariant catches the shallow fix.
- `examples/account-access/fixed` passes proof and invariant.
- No research transcripts, private issue exports, credentials, or bulky fixtures are present.

## GitHub

Create the public-facing repo as private first:

```bash
gh repo create Atomics-hub/replaypack --private --source . --remote origin --push
```

Confirm GitHub Actions passes while the repo is still private.

## npm

The package name was checked before this repo was prepared and returned 404 from npm.
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
