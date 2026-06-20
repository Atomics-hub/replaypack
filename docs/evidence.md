# ReplayPack Evidence

ReplayPack is being launched as proof before platform.

The claim:

```text
Agent fixes can pass the visible proof while breaking the invariant.
ReplayPack catches that before merge.
```

## Current Proof

| Evidence Gate | Result | What It Shows |
| --- | ---: | --- |
| 60-second demo | pass | One command shows visible proof passing, ReplayPack rejecting the wrong fix, and accepting the correct fix |
| AgentBench deterministic replay | 30/30 | Visible-only finish policy false-dones; ReplayPack prevents and recovers on the same executable cases |
| Live AgentBench recovery trial | 3/3 | Codex subagents recovered from visible-green wrong fixes using ReplayPack with no manual intervention |
| Live AgentBench full generation trial | 3/3 | From broken starts, ReplayPack treatments verified 3/3 correct vs 2/3 control correctness |
| ProofBench | 30/30 pass | Synthetic wrong-fix benchmark across 30 bug families |
| Visible-green wrong fixes rejected | 30/30 | ReplayPack catches plausible fixes that normal proof accepts |
| Correct fixes accepted | 30/30 | ReplayPack is not rejecting the intended fixes in the benchmark |
| False positives | 0 | No fixed benchmark case failed ReplayPack |
| Private public-repo trials | 7/7 pass | ReplayPack can verify local capsules against selected public OSS repos |
| Real self-dogfood | pass | ReplayPack captured a real CI packaging failure in this repo |
| GitHub CI | pass | Hosted CI verifies smoke, package contents, and the local Action path |
| Fresh clone trial | pass | Clone-based setup, wrong/fixed demo, and dogfood capsule all run from a clean checkout |

## ProofBench

`npm run proofbench` generates synthetic wrong/fixed cases and writes:

- `docs/proofbench/results.json`

Latest summary:

- 30 benchmark cases
- 30 bug families
- 30 visible-green wrong fixes
- ReplayPack rejected 30/30 visible-green wrong fixes
- ReplayPack accepted 30/30 correct fixes
- 0 false positives
- 8 minute median capsule authoring estimate

## AgentBench

`npm run agentbench` converts ProofBench into an agent finish-policy comparison and writes:

- `docs/agentbench/results.json`

Latest deterministic replay:

- 30 benchmark cases
- 30 bug families
- visible-only agent false-done outcomes: 30/30
- ReplayPack prevented false done: 30/30
- ReplayPack recovered to correct fix: 30/30

Latest live recovery trial:

- 3 cases
- control visible-only false-done outcomes: 3/3
- ReplayPack treatment recoveries: 3/3
- manual intervention: 0
- receipt: `docs/validation/live-agent-proof.json`

Latest live full task generation trial:

- 3 cases
- control agents truly correct: 2/3
- control false-done outcomes: 1/3
- ReplayPack treatment verified correct: 3/3
- manual intervention: 0
- receipt: `docs/validation/full-agent-proof.json`

Limitations: deterministic replay is not live LLM-agent evidence. The live recovery trial starts from visible-green wrong variants. The live full task generation trial is real but small and Codex-only.

## Public Repo Trials

`npm run public-repo-trials` clones selected public repositories into `.tmp/`, creates local capsules, and verifies them with a scrubbed environment.

Latest summary:

- 7 public repositories attempted
- 7 passed
- 0 failed
- no repository install scripts were run
- no public writes, forks, issues, PRs, or maintainer contacts were made

Repos:

- `sindresorhus/escape-string-regexp`
- `sindresorhus/is-plain-obj`
- `sindresorhus/yoctocolors`
- `sindresorhus/array-move`
- `sindresorhus/quick-lru`
- `sindresorhus/decamelize`
- `sindresorhus/camelcase`

## Still Not Proven

This evidence does not prove market demand or broad cross-agent lift.

The remaining proof is live usage:

- Does the full task generation lift hold across more cases and non-Codex agent surfaces?
- Can a developer understand ReplayPack without a live explanation?
- Would they add it to a repo where coding agents make PRs?
- What would stop them from using it?

The public beta issue exists to collect that evidence:

- https://github.com/Atomics-hub/replaypack/issues/1
