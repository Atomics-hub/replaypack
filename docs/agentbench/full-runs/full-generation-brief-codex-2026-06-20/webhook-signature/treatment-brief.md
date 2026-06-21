# ReplayPack Agent Brief

Capsule: `replaypack/case.json`
ID: `webhook-signature`
Title: Webhook verification accepts signature prefixes
Schema: `replaypack.capsule.v0`

## Goal

Make the smallest correct code change that satisfies the issue, visible proof, and ReplayPack invariants.
Do not say done until ReplayPack verify passes.

## Finish Gate

Run one of these from the repo root after your edit:

```bash
npx replaypack verify replaypack/case.json --out dist/replaypack-verify.json
```

Done means the verification packet status is `pass`. If the visible proof passes but ReplayPack fails, repair the invariant failure and rerun the finish gate.

## Commands

Visible proof: `npm run proof`

Invariant commands:
- `npm run invariant`

## Relevant Files

- primary: `src/system.js`
- proof: `test/proof.mjs`

## Issue Context

- issue: `issues/issue.md`

## Trace Context

- trace: `fixtures/trace/repro.md`

## Acceptance

- legitimate signature passes
- wrong secret signature fails

## Agent Instructions

- Do not fix only the visible proof.
- Preserve the invariant contract.
- Run ReplayPack verify before finishing.

## Context Excerpts

### issues/issue.md

```text
# Webhook signature

Only signatures created with the shared secret should verify.
```

### fixtures/trace/repro.md

```text
# Trace

A forged signature with the right prefix was accepted.
```

## Agent Loop

1. Read the issue and trace context.
2. Inspect the relevant source and proof files.
3. Make the smallest contract-correct change.
4. Run the finish gate.
5. If ReplayPack fails, use the proof or invariant output as the next repair target and repeat.

