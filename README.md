# ReplayPack

> Public beta: looking for 5 developers who use coding agents to run the 10-minute trial and tell us whether this is useful or nonsense. Start here: [External Developer Trial](https://github.com/Atomics-hub/replaypack/blob/main/docs/trials/external-developer-trial.md).

ReplayPack is the done-contract for coding agents.

Agents are good at making plausible fixes. ReplayPack checks whether the fix satisfies the issue, the proof command, and the invariants that matter before it merges.

```text
visible test passes
hidden invariant fails
ReplayPack rejects the fix
```

Current proof receipt: ProofBench has 30 executable cases across 30 bug families. In the latest run, normal visible proofs accepted 30 plausible wrong fixes; ReplayPack rejected all 30 and accepted all 30 correct fixes. AgentBench deterministic replay converts that into the agent loop: visible-only agents false-done 30/30; ReplayPack prevents 30/30 and recovers 30/30.

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

Or run with `npx`:

```bash
npx replaypack --help
```

For the beta demo, clone the repo:

```bash
git clone https://github.com/Atomics-hub/replaypack.git
cd replaypack
node bin/replaypack.mjs trial
```

The trial writes `dist/external-trial/receipt.json` plus `dist/external-trial/feedback.md` for the public beta issue.

Run the checkout CLI:

```bash
npm test
node bin/replaypack.mjs --help
```

## Verify A Capsule

Generate an agent-ready task brief first:

```bash
npx replaypack brief replaypack/account-access.json
```

Or from a checkout:

```bash
node bin/replaypack.mjs brief --root examples/account-access/fixed replaypack/account-access.json
```

The brief turns the capsule into a bounded task prompt with issue excerpts, trace excerpts, proof commands, invariant commands, and the exact finish gate.

```bash
npx replaypack verify replaypack/account-access.json \
  --out dist/replaypack-verify.json
```

Or from a checkout:

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

```bash
npx replaypack brief replaypack/account-access.json --out dist/agent-brief.md
```

Then paste or attach `dist/agent-brief.md` to the coding agent. The generated brief tells the agent to make the smallest correct fix, run `replaypack verify`, and keep repairing until the verification packet passes.

## GitHub Actions

As an npm command:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- run: npx replaypack verify replaypack/account-access.json --out dist/replaypack-verify.json
```

As an action from this repo:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
- run: npm ci
- uses: Atomics-hub/replaypack@v0.2.0
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

The GitHub repo includes a one-command account-access demo:

```bash
npm run demo
```

The wrong fix makes the visible export proof pass but leaves `role_source` as `user`. ReplayPack rejects it because the invariant requires account membership and session binding. The fixed version passes both proof and invariant. See [Demo](https://github.com/Atomics-hub/replaypack/blob/main/docs/demo.md) for the expected transcript.

The wedge:

```text
ReplayPack keeps agents from fixing the symptom and breaking the contract.
```

## Launch Evidence

ReplayPack is being held to a proof loop before broad launch:

- [Evidence](https://github.com/Atomics-hub/replaypack/blob/main/docs/evidence.md)
- [60-Second Demo](https://github.com/Atomics-hub/replaypack/blob/main/docs/demo.md)
- [Holy-Fuck Scorecard](https://github.com/Atomics-hub/replaypack/blob/main/docs/holy-fuck-scorecard.md)
- [AgentBench](https://github.com/Atomics-hub/replaypack/blob/main/docs/agentbench/README.md)
- [ProofBench](https://github.com/Atomics-hub/replaypack/blob/main/docs/proofbench/README.md)
- [Market Proof Loop](https://github.com/Atomics-hub/replaypack/blob/main/docs/market-proof.md)
- [Private Public-Repo Trials](https://github.com/Atomics-hub/replaypack/blob/main/docs/public-repo-trials/README.md)
- [External Developer Trial](https://github.com/Atomics-hub/replaypack/blob/main/docs/trials/external-developer-trial.md)

Run the current readiness check:

```bash
npm run readiness
```

Run the agent-readable evidence audit:

```bash
npm run evidence:verify
```

Readiness checks receipt contents, transcripts, and launch evidence. The evidence audit checks `docs/validation/evidence-manifest.json`, which ties public claims to machine-readable receipts. The current technical proof gates are valid; readiness still fails until external-user proof exists.
