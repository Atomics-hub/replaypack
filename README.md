# ReplayPack

> Public beta: looking for 5 developers who use coding agents to run the 10-minute trial and tell us whether this is useful or nonsense. Start here: [External Developer Trial](docs/trials/external-developer-trial.md).

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

## Public Beta Setup

ReplayPack is public on GitHub before npm publish. For the beta, clone the repo:

```bash
git clone https://github.com/Atomics-hub/replaypack.git
cd replaypack
npm test
```

Run the CLI from the checkout:

```bash
node bin/replaypack.mjs --help
```

The npm package is not published yet. After beta validation, the install path will be:

```bash
npm install --save-dev replaypack
```

Or:

```bash
npx replaypack --help
```

## Verify A Capsule

```bash
node bin/replaypack.mjs verify replaypack/account-access.json \
  --out dist/replaypack-verify.json
```

Verification passes only when:

- all referenced files exist
- the proof command passes
- every invariant command passes

## Capture A Capsule

```bash
node bin/replaypack.mjs capture \
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

After npm publish, as an npm command:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- run: npx replaypack verify replaypack/account-access.json --out dist/replaypack-verify.json
```

During the public beta, as an action from this repo:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- uses: Atomics-hub/replaypack@main
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
node bin/replaypack.mjs verify --root examples/account-access/wrong replaypack/account-access.json
node bin/replaypack.mjs verify --root examples/account-access/fixed replaypack/account-access.json
```

The wrong fix makes the visible export proof pass but leaves `role_source` as `user`. ReplayPack rejects it because the invariant requires account membership and session binding. The fixed version passes both proof and invariant.

The wedge:

```text
ReplayPack keeps agents from fixing the symptom and breaking the contract.
```

## Launch Evidence

ReplayPack is being held to a proof loop before broad launch:

- [Holy-Fuck Scorecard](docs/holy-fuck-scorecard.md)
- [ProofBench](docs/proofbench/README.md)
- [Market Proof Loop](docs/market-proof.md)
- [Private Public-Repo Trials](docs/public-repo-trials/README.md)
- [External Developer Trial](docs/trials/external-developer-trial.md)

Run the current readiness check:

```bash
npm run readiness
```

The readiness check is expected to fail until external-user proof exists.
