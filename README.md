# ReplayPack

ReplayPack is the merge gate for agent-made code.

Agents are good at making plausible fixes. ReplayPack checks whether the fix satisfies the issue, the proof command, and the invariants that matter before it merges.

```text
visible test passes
hidden invariant fails
ReplayPack rejects the fix
```

## Why

A narrow test can prove the symptom is gone while the product contract is broken. ReplayPack stores that contract as a small JSON capsule:

- issue and CI context
- source/proof files
- repro trace
- proof command
- invariant commands

The agent gets the capsule as its task brief. CI runs `replaypack verify` after the edit.

## Install

```bash
npm install --save-dev replaypack
```

Or run without installing:

```bash
npx replaypack --help
```

## Verify A Capsule

```bash
npx replaypack verify replaypack/account-access.json \
  --out dist/replaypack-verify.json
```

Verification passes only when:

- all referenced files exist
- the proof command passes
- every invariant command passes

## Capture A Capsule

```bash
npx replaypack capture \
  --id account-access \
  --title "Account-scoped export access ignores membership" \
  --primary-file src/access.js \
  --proof-file test/visible-proof.mjs \
  --trace fixtures/trace/account-access.md \
  --issue-file issues/account-access.md \
  --proof-command "npm run proof" \
  --invariant-command "npm run invariant" \
  --out replaypack/account-access.json \
  --packet dist/replaypack-capture.json
```

Give the capsule to an agent:

```text
Use replaypack/account-access.json as the issue brief.
Make the smallest correct fix.
Run the proof and invariant commands before finishing.
```

## GitHub Actions

As an npm command:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- run: npx replaypack verify replaypack/account-access.json --out dist/replaypack-verify.json
```

As an action:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- uses: Atomics-hub/replaypack@v0
  with:
    capsule: replaypack/account-access.json
    out: dist/replaypack-verify.json
```

`--root` is useful for monorepos and examples. Capsule paths, referenced files, proof commands, and invariant commands are resolved from that root.

## Capsule Shape

```json
{
  "schema": "replaypack.capsule.v0",
  "id": "account-access",
  "entrypoint": {
    "primary_file": "src/access.js",
    "proof_file": "test/visible-proof.mjs",
    "proof_command": "npm run proof",
    "invariant_commands": ["npm run invariant"]
  },
  "workflow": {
    "issue_files": ["issues/account-access.md"]
  },
  "trace": {
    "repro": "fixtures/trace/account-access.md"
  }
}
```

## Security

ReplayPack executes the proof and invariant commands stored in a capsule. Treat capsules like CI configuration: verify only capsules from your repo or from people you trust.

## Demo

The GitHub repo includes a tiny account-access demo:

```bash
npm test
```

The wrong fix makes the visible export proof pass but leaves `role_source` as `user`. ReplayPack rejects it because the invariant requires account membership and session binding. The fixed version passes both proof and invariant.

The wedge:

```text
ReplayPack keeps agents from fixing the symptom and breaking the contract.
```
