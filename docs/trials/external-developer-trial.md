# External Developer Trial

Use this with one developer who has not worked on ReplayPack.

Target time: 10 minutes.

## Setup

```bash
git clone https://github.com/Atomics-hub/replaypack.git
cd replaypack
node --version
node bin/replaypack.mjs trial
```

Expected summary:

```text
ReplayPack external trial: pass
wrong demo   proof=ok invariant=nonzero replaypack=fail
fixed demo   proof=ok invariant=ok replaypack=pass
dogfood      proof=ok invariant=ok replaypack=pass
```

The command writes a receipt to:

```text
dist/external-trial/receipt.json
```

## Demo

The trial command runs the wrong fix:

```bash
node bin/replaypack.mjs verify --root examples/account-access/wrong replaypack/account-access.json
```

Expected: command exits nonzero. The normal proof passes, but the invariant fails.

It then runs the fixed version:

```bash
node bin/replaypack.mjs verify --root examples/account-access/fixed replaypack/account-access.json
```

Expected: command exits zero with `"status": "pass"`.

## Dogfood

The trial command also runs the real repo dogfood capsule:

```bash
node bin/replaypack.mjs verify docs/dogfood/ci-pack-destination/replaypack.json --out dist/dogfood-ci-pack-verify.json
```

Expected: command exits zero with `"status": "pass"`.

## Questions

Ask the developer:

1. After one minute with the README, what do you think ReplayPack does?
2. Was the wrong/fixed demo understandable without a live explanation?
3. Do you understand why this is not just unit tests?
4. Would you add this to a repo where agents make PRs?
5. What is the first objection or confusion?

## Send Feedback

Open an external developer trial issue:

```text
https://github.com/Atomics-hub/replaypack/issues/new?template=external-developer-trial.yml
```

Paste command outcomes, the one-minute explanation, the invariant-vs-visible-proof read, whether they would use it, and the first objection. This is the evidence ReplayPack still needs before claiming external-user proof.

## Record Proof

After an outside developer files the issue, a maintainer records reviewed proof with:

```bash
npm run record-external-proof -- --issue <issue-number> --verdict pass --reviewer <name>
```

This writes `docs/validation/external-user-proof.json`. `npm run readiness` only passes when that receipt is present and validates.

## Pass Bar

External proof passes only if:

- the developer can explain the core idea in their own words
- they can run the wrong/fixed demo without help beyond this file
- they understand the invariant-vs-visible-proof distinction
- they give one concrete repo/workflow where this might be useful
- at least one objection is captured and addressed or accepted as a blocker
