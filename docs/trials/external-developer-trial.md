# External Developer Trial

Use this with one developer who has not worked on ReplayPack.

Target time: 10 minutes.

## Setup

```bash
git clone https://github.com/Atomics-hub/replaypack.git
cd replaypack
node --version
npm test
```

Expected:

```text
replaypack smoke ok
```

## Demo

Run the wrong fix:

```bash
node bin/replaypack.mjs verify --root examples/account-access/wrong replaypack/account-access.json
```

Expected: command exits nonzero. The normal proof passes, but the invariant fails.

Run the fixed version:

```bash
node bin/replaypack.mjs verify --root examples/account-access/fixed replaypack/account-access.json
```

Expected: command exits zero with `"status": "pass"`.

## Dogfood

Run the real repo dogfood capsule:

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

## Pass Bar

External proof passes only if:

- the developer can explain the core idea in their own words
- they can run the wrong/fixed demo without help beyond this file
- they understand the invariant-vs-visible-proof distinction
- they give one concrete repo/workflow where this might be useful
- at least one objection is captured and addressed or accepted as a blocker
