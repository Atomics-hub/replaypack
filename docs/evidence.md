# ReplayPack Evidence

ReplayPack is being launched as proof before platform.

The claim:

```text
Agent fixes can pass the visible proof while breaking the invariant.
ReplayPack catches that before merge.
```

## Current Proof

Machine-checkable manifest:

- receipt: `docs/validation/evidence-manifest.json`
- verifier: `npm run evidence:verify`

| Evidence Gate | Result | What It Shows |
| --- | ---: | --- |
| 60-second demo | pass | One command shows visible proof passing, ReplayPack rejecting the wrong fix, and accepting the correct fix |
| AgentBench deterministic replay | 30/30 | Visible-only finish policy false-dones; ReplayPack prevents and recovers on the same executable cases |
| BriefBench handoff | 30/30 | Generated agent briefs include the finish gate/context, reject wrong fixes, and recover to correct fixes |
| Invariant authoring docs | pass | Cookbook and first-capsule tutorial teach four invariant patterns and verify an executable capture/brief/verify loop |
| Live AgentBench recovery trial | 3/3 | Codex subagents recovered from visible-green wrong fixes using ReplayPack with no manual intervention |
| Claude Code recovery trial | 3/3 | Non-Codex agent surface reproduced visible-only false done and ReplayPack recovery |
| Live AgentBench full generation trial | 15/15 | Codex treatments verified 15/15 correct vs 14/15 control correctness |
| Live generated-brief full generation trial | 3/3 | Codex treatments using generated briefs verified 3/3 correct vs 2/3 control correctness |
| Claude Code full generation trial | 6/6 | Claude Code treatments verified 6/6 correct vs 5/6 control correctness |
| ProofBench | 30/30 pass | Synthetic wrong-fix benchmark across 30 bug families |
| Visible-green wrong fixes rejected | 30/30 | ReplayPack catches plausible fixes that normal proof accepts |
| Correct fixes accepted | 30/30 | ReplayPack is not rejecting the intended fixes in the benchmark |
| False positives | 0 | No fixed benchmark case failed ReplayPack |
| Private public-repo trials | 7/7 pass | ReplayPack can verify local capsules against selected public OSS repos |
| Real self-dogfood | pass | ReplayPack captured a real CI packaging failure in this repo |
| GitHub CI | pass | Hosted CI verifies smoke, package contents, and the local Action path |
| Fresh clone trial | pass | Clone-based setup, wrong/fixed demo, and dogfood capsule all run from a clean checkout |
| Packed-package trial | pass | Installed tarball exposes `replaypack brief` and `replaypack trial`, writes an agent brief, and writes receipt/feedback/agent-report files |

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

Latest BriefBench handoff run:

- receipt: `docs/agentbench/brief-results.json`
- 30 generated briefs across 30 bug families
- complete briefs with finish gate/context: 30/30
- visible-only false-done outcomes: 30/30
- brief-gated wrong fixes rejected: 30/30
- brief-gated recoveries to correct fix: 30/30
- absolute path leaks: 0

Latest live recovery trial:

- 3 cases
- control visible-only false-done outcomes: 3/3
- ReplayPack treatment recoveries: 3/3
- manual intervention: 0
- receipt: `docs/validation/live-agent-proof.json`

Latest Claude Code recovery trial:

- 3 cases
- control visible-only false-done outcomes: 3/3
- ReplayPack treatment recoveries: 3/3
- protocol violations: 0
- manual intervention: 0
- receipt: `docs/validation/claude-code-agent-proof.json`

Latest live full task generation trial:

- 15 cases across two Codex subagent batches
- control agents truly correct: 14/15
- control false-done outcomes: 1/15
- ReplayPack treatment verified correct: 15/15
- manual intervention: 0
- receipt: `docs/validation/full-agent-proof.json`
- source receipt: `docs/validation/full-agent-proof.previous-9case.json`
- source receipt: `docs/validation/full-agent-proof-extra.json`
- transcripts: `docs/agentbench/full-runs/full-generation-codex-scale-2026-06-20/`
- transcripts: `docs/agentbench/full-runs/full-generation-codex-extra-2026-06-20/`

Latest live generated-brief full task generation trial:

- 3 cases
- treatment prompt surface: generated `dist/agent-brief.md`
- control agents truly correct: 2/3
- control false-done outcomes: 1/3
- ReplayPack treatment verified correct: 3/3
- generated brief checks passed: 3/3
- manual intervention: 0
- receipt: `docs/validation/full-agent-brief-proof.json`
- transcripts and generated briefs: `docs/agentbench/full-runs/full-generation-brief-codex-2026-06-20/`

Latest Claude Code full task generation trial:

- 6 cases
- control agents truly correct: 5/6
- control false-done outcomes: 1/6
- ReplayPack treatment verified correct: 6/6
- protocol violations: 0
- manual intervention: 0
- receipt: `docs/validation/claude-code-full-agent-proof.json`

Limitations: deterministic replay is not live LLM-agent evidence. The live recovery trials start from visible-green wrong variants. The live full task generation trials are real but still small. The added 6-case Codex batch had 6/6 correct controls, so it strengthens treatment reliability and sample size but does not add new false-done lift cases. The generated-brief full-generation trial is only 3 cases, but it uses the actual generated brief artifact as the treatment surface.

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

## Invariant Authoring Surface

`npm run authoring:verify` builds a tiny idempotency fixture, captures a ReplayPack capsule, generates an agent brief, verifies that ReplayPack fails before the account-scoped fix, applies the fix, and verifies that ReplayPack passes after the fix.

Latest local result:

- receipt: `docs/validation/invariant-authoring-docs.json`
- cookbook patterns: 4
- tutorial capture: captured
- generated agent brief: finish gate and invariant command present
- verify before fix: fail, proof ok, invariant nonzero
- verify after fix: pass, proof ok, invariant ok

Limitation: this proves the authoring tutorial is executable. It is still not external developer comprehension or demand proof.

## Install Surface

`npm run package-trial` packs ReplayPack, installs the tarball into a fresh temp project, checks the installed `replaypack --version`, runs `replaypack brief`, runs `replaypack trial`, and verifies the caller project receives `dist/agent-brief.md`, `dist/external-trial/receipt.json`, `dist/external-trial/feedback.md`, and `dist/external-trial/agent-report.md`.

Latest local result:

- receipt: `docs/validation/private-packed-package-trial.json`
- packed version: `0.2.1`
- installed CLI version: `0.2.1`
- installed `replaypack brief`: pass
- generated agent brief: pass
- installed `replaypack trial`: pass
- generated feedback draft: pass
- generated agent trial report: pass
- wrong demo: proof ok, invariant nonzero, ReplayPack fail
- fixed demo: proof ok, invariant ok, ReplayPack pass
- dogfood: proof ok, invariant ok, ReplayPack pass

Limitation: this verifies the installable package surface before publish. The live npm `latest` tag is still `0.2.0` until the `0.2.1` publish is completed.

## Still Not Proven

This evidence does not prove market demand or broad large-sample full-generation lift.

The remaining proof is live usage:

- Does the full task generation lift hold across more cases?
- Can a developer understand ReplayPack without a live explanation?
- Would they add it to a repo where coding agents make PRs?
- What would stop them from using it?

The public beta issue exists to collect that evidence:

- https://github.com/Atomics-hub/replaypack/issues/1
