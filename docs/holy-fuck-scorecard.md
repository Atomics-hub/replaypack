# Holy-Fuck Scorecard

ReplayPack should not go public because we like the idea. It goes public when the evidence says a serious agent-heavy developer can understand it, trust it, and want it.

## Current Call

Status: `agentbench_replay_live_agent_next`

ReplayPack is a credible holy-fuck candidate with public GitHub and npm release live. Deterministic agent-loop proof now exists. Live-agent lift and external demand are not proven yet.

The product mechanism is now benchmark-proven locally:

- wrong fix can pass the visible proof
- ReplayPack rejects it on invariant failure
- correct fix passes proof and invariant
- one-command demo shows the trap without manual log parsing
- deterministic AgentBench shows visible-only false done at 30/30 and ReplayPack prevention/recovery at 30/30
- 30-case synthetic ProofBench passes the launch bar
- package surface is clean
- private GitHub CI passes
- real self-dogfood passes on a launch-blocking CI issue
- fresh private clone can run the wrong/fixed demo and dogfood capsule
- private public-repo trials pass on 7/7 selected OSS repositories
- public GitHub beta is live with a tester issue
- npm package `replaypack@0.2.0` is published and install-verified
- GitHub release `v0.2.0` points at the published commit

The missing proof is live-agent and market proof:

- live Codex/Claude-style agent run against the protocol
- external developer reaction
- confirmation that the demo makes the value obvious without a live explanation

## Current ProofBench Result

`npm run proofbench` writes `docs/proofbench/results.json`.

Latest local run:

- 30 benchmark cases
- 30 bug families
- 30 visible-green wrong fixes
- ReplayPack rejected 30/30 visible-green wrong fixes
- ReplayPack accepted 30/30 correct fixes
- 0 false positives
- 8 minute median capsule authoring estimate

This is strong mechanism proof. It is still synthetic; it does not replace real repo dogfood or external user proof.

## Current AgentBench Result

`npm run agentbench` writes `docs/agentbench/results.json`.

Latest deterministic replay:

- 30 cases
- 30 bug families
- visible-only false-done outcomes: 30/30
- ReplayPack prevented false done: 30/30
- ReplayPack recovered to correct fix: 30/30

This is the right agent-level claim shape, but it is not yet live LLM-agent evidence.

## Gate Scores

| Gate | Score | Pass Bar | Status | Evidence |
| --- | ---: | ---: | --- | --- |
| Product mechanism | 94 | 85 | pass | one-command account-access demo plus ProofBench |
| Package cleanliness | 92 | 85 | pass | npm package allowlist is explicit, installs cleanly, CLI runs |
| CI/action path | 90 | 85 | pass | GitHub Actions passed on public remote |
| Benchmark proof | 94 | 85 | pass | 30/30 visible-green wrong fixes rejected; 30/30 correct fixes accepted |
| Agent-loop proof | 88 | 85 | pass | deterministic AgentBench replay: 30/30 false-done prevented and recovered |
| Real repo dogfood | 82 | 80 | pass | self-dogfood caught the real CI pack-destination failure mode |
| Public repo private trials | 88 | 80 | pass | 7/7 selected public repos verified with local capsules |
| Live-agent proof | 0 | 75 | fail | no live coding-agent AgentBench run yet |
| External user proof | 0 | 75 | fail | no external dev trial yet |
| Discovery/readme | 84 | 80 | pass | npm-ready README, one-command demo, public beta issue, and evidence page live |
| Launch readiness | 90 | 85 | package-live | GitHub and npm are live; market proof still waits on external users |

## Go/No-Go Rules

Public GitHub is allowed when:

- private GitHub CI passes on the clean repo
- package dry-run remains clean
- README and demo can be understood in under one minute
- no private-path scan hits

npm publish is allowed when:

- public/private GitHub CI has passed
- package name is checked again
- install-from-tarball test passes
- release notes and security note are present
- npm package install has been verified after publish

Broad market launch is allowed when:

- ProofBench has at least 30 cases
- visible tests accept at least 20 attractive wrong fixes
- ReplayPack rejects at least 90% of those wrong fixes
- ReplayPack accepts at least 90% of correct fixes
- false positives are 0
- AgentBench deterministic replay prevents at least 90% of false-done outcomes
- at least one live coding-agent run proves recovery using only the packet
- at least one real repo dogfood passes
- private public-repo trials pass on selected OSS repos without public writes
- at least one external developer understands the value without a live explanation

## The Answer We Want To Earn

The future answer should sound like:

```text
Yes, this is the one.
We have N benchmark cases across M bug families.
Visible-only agents false-done on X wrong fixes.
ReplayPack prevented Y and recovered Z to correct fixes.
The clean repo CI passed, npm install passed, live agents recovered, and external devs understood it.
Now launch.
```

Until then, the honest answer is:

```text
ReplayPack is the prime candidate.
It is package-launched and agent-loop replay proven, but not yet live-agent or market-proven.
Next gate is live coding-agent proof.
```
