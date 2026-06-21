# Create Your First Capsule

This tutorial builds the smallest useful ReplayPack capsule: a visible proof passes, but the invariant catches the shallow fix.

The example is an idempotent job helper. A retry with the same event key in the same account should be skipped. The same event key in a different account should still process.

## 1. Create The Mini Repo

From a ReplayPack checkout:

```bash
rm -rf .tmp/first-capsule-demo
mkdir -p .tmp/first-capsule-demo/{src,test,issues,fixtures/trace,replaypack}
cd .tmp/first-capsule-demo
```

Create `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "proof": "node test/proof.mjs",
    "invariant": "node test/invariant.mjs"
  }
}
```

Create `src/idempotency.js` with the shallow implementation:

```js
export function shouldProcess({ accountId, key, seen }) {
  if (!accountId || !key) return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
```

Create `test/proof.mjs`:

```js
import assert from "node:assert/strict";
import { shouldProcess } from "../src/idempotency.js";

const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), false);
```

Create `test/invariant.mjs`:

```js
import assert from "node:assert/strict";
import { shouldProcess } from "../src/idempotency.js";

const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_b", key: "evt_1", seen }), true);
```

Create `issues/idempotency.md`:

```md
# Scope idempotency keys by account

Duplicate webhook retries must be skipped within the same account.
The same provider event key can appear in another account and must still process there.
```

Create `fixtures/trace/repro.md`:

```md
# Repro

1. Webhook event `evt_1` arrives for `acct_a`.
2. Retry `evt_1` arrives for `acct_a`; skip it.
3. Webhook event `evt_1` arrives for `acct_b`; process it because dedupe is account-scoped.
```

## 2. Prove The Trap

The visible proof passes:

```bash
npm run proof
```

The invariant fails:

```bash
npm run invariant
```

That is the ReplayPack moment: the shallow implementation satisfies the visible symptom but violates the product contract.

## 3. Capture The Capsule

Return to the ReplayPack checkout root, then capture the capsule:

```bash
cd ../..
```

```bash
node bin/replaypack.mjs capture \
  --root .tmp/first-capsule-demo \
  --id account-scoped-idempotency \
  --title "Scope idempotency keys by account" \
  --primary-file src/idempotency.js \
  --proof-file test/proof.mjs \
  --trace fixtures/trace/repro.md \
  --issue-file issues/idempotency.md \
  --proof-command "npm run proof" \
  --invariant-command "npm run invariant" \
  --out replaypack/idempotency.json \
  --packet dist/capture.json
```

The capture packet records that the visible proof passed and the invariant precheck failed. That is useful: it proves the capsule is guarding the gap.

## 4. Generate The Agent Brief

```bash
node bin/replaypack.mjs brief \
  --root .tmp/first-capsule-demo \
  replaypack/idempotency.json \
  --out dist/agent-brief.md
```

Give `dist/agent-brief.md` to the coding agent. It includes the issue, trace, proof command, invariant command, relevant files, and finish gate.

## 5. Verify Before The Fix

```bash
node bin/replaypack.mjs verify \
  --root .tmp/first-capsule-demo \
  replaypack/idempotency.json \
  --out dist/replaypack-before.json
```

Expected result: ReplayPack fails because the proof is ok but the invariant is nonzero.

## 6. Fix The Contract

Change `src/idempotency.js` so the dedupe key includes the account:

```js
export function shouldProcess({ accountId, key, seen }) {
  if (!accountId || !key) return false;
  const scopedKey = `${accountId}:${key}`;
  if (seen.has(scopedKey)) return false;
  seen.add(scopedKey);
  return true;
}
```

## 7. Verify After The Fix

```bash
node bin/replaypack.mjs verify \
  --root .tmp/first-capsule-demo \
  replaypack/idempotency.json \
  --out dist/replaypack-after.json
```

Expected result: ReplayPack passes. The visible proof and the invariant are both ok.

## What To Copy Into Your Repo

- Keep proof tests narrow and close to the bug report.
- Put broader contract checks in invariant commands.
- Store the capsule in `replaypack/<issue-id>.json`.
- Generate `dist/agent-brief.md` and give it to the agent.
- Make CI run `replaypack verify replaypack/<issue-id>.json`.
