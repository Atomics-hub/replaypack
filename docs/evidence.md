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

This evidence does not prove market demand.

The remaining proof is external comprehension:

- Can a developer understand ReplayPack without a live explanation?
- Would they add it to a repo where coding agents make PRs?
- What would stop them from using it?

The public beta issue exists to collect that evidence:

- https://github.com/Atomics-hub/replaypack/issues/1
