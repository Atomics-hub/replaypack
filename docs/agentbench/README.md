# ReplayPack AgentBench

AgentBench asks the question ReplayPack actually needs to win:

```text
Does ReplayPack make coding agents less likely to declare false done?
```

## Current Evidence Level

Current result: deterministic agent-loop replay, deterministic generated-brief handoff proof, live Codex and Claude Code recovery trials, and live Codex and Claude Code full task generation trials.

The deterministic replay is not a live LLM-agent run. It uses the executable ProofBench corpus and compares two finish policies:

- `baseline_visible_only_agent`: stops when the visible proof passes
- `replaypack_agent`: stops only when `replaypack verify` passes

The current run shows the mechanism an agent would experience:

- visible-only finish policy accepts plausible wrong fixes
- ReplayPack rejects those same false-green fixes
- the corresponding correct fixes pass the ReplayPack finish gate

BriefBench then checks the prompt surface agents actually receive:

- `replaypack brief` generates a markdown handoff from each capsule
- each generated brief must include the finish gate, proof command, invariant command, issue context, trace context, acceptance, and agent loop
- the same visible-only false-done and ReplayPack recovery loop must hold when the generated brief is the task contract

The live recovery trial then gives actual Codex subagents the same visible-green wrong variants:

- control agents use only the visible proof and stop
- treatment agents use ReplayPack verify and repair until the contract passes

The Claude Code recovery trial repeats the same visible-green wrong protocol on a non-Codex agent surface:

- controls stop on the visible proof
- treatments use ReplayPack verify and repair until the contract passes
- protocol checks confirm source/test/capsule boundaries were respected

The full task generation trial starts from deliberately broken implementations:

- control agents use issue, trace, source, and visible proof only
- treatment agents use the ReplayPack capsule and verify gate
- hidden invariants are evaluated after the fact

## Run

```bash
npm run proofbench
npm run agentbench
npm run briefbench
```

`npm run agentbench` writes:

- `docs/agentbench/results.json`

`npm run briefbench` writes:

- `docs/agentbench/brief-results.json`

## Current Metrics

Latest deterministic replay:

- 30 cases
- 30 bug families
- visible-only false-done outcomes: 30/30
- ReplayPack prevented false done: 30/30
- ReplayPack recovered to correct fix: 30/30

Latest deterministic brief handoff:

- 30 generated briefs
- 30 bug families
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
- transcripts: `docs/agentbench/live-runs/live-recovery-2026-06-20/`

Latest Claude Code recovery trial:

- 3 cases
- control visible-only false-done outcomes: 3/3
- ReplayPack treatment recoveries: 3/3
- protocol violations: 0
- manual intervention: 0
- receipt: `docs/validation/claude-code-agent-proof.json`
- transcripts: `docs/agentbench/claude-runs/live-recovery-claude-code-2026-06-20/`

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

Latest Claude Code full task generation trial:

- 6 cases
- control agents truly correct: 5/6
- control false-done outcomes: 1/6
- ReplayPack treatment verified correct: 6/6
- protocol violations: 0
- manual intervention: 0
- receipt: `docs/validation/claude-code-full-agent-proof.json`
- transcripts: `docs/agentbench/claude-full-runs/full-generation-claude-code-scale-2026-06-20/`

## Live-Agent Protocol

The next evidence level is a broad full task generation live agent run across more cases and external developer usage.

Control prompt:

```text
You are fixing this issue.
Use the issue, source file, and visible proof command.
Stop when the visible proof passes.
```

Treatment prompt:

```text
You are fixing this issue.
Use the ReplayPack capsule or generated ReplayPack brief as the task contract.
Do not say done until replaypack verify passes.
If verify fails, use the proof/invariant failure to repair the fix and rerun verify.
```

For normal agent handoff, generate the prompt surface with:

```bash
npx replaypack brief replaypack/<issue>.json --out dist/agent-brief.md
```

Metrics:

- `false_done`: agent reports done while invariant fails
- `recovered`: agent first hits a false-green or invariant failure, then repairs until ReplayPack passes
- `attempts_to_verify`: number of verify attempts before success or budget exhaustion
- `time_to_correct_fix`: wall-clock time to passing ReplayPack verification
- `manual_intervention`: whether the human had to explain the invariant outside the packet

Run constraints:

- same model and temperature per comparison
- same case order
- same time or attempt budget
- no internet unless the case explicitly requires it
- sanitized transcripts only

## Launch Bar

AgentBench deterministic replay passes when:

- at least 30 cases run
- at least 20 bug families are represented
- visible-only false done appears in at least 20 cases
- ReplayPack prevents at least 90% of those false-done outcomes
- ReplayPack recovers to a correct fix in at least 90% of cases

The current live recovery trials prove that Codex and Claude Code can recover from visible-green wrong fixes using ReplayPack. The current live full task generation trials show a Codex lift from 14/15 control correctness to 15/15 ReplayPack verified correctness and a Claude Code lift from 5/6 control correctness to 6/6 ReplayPack verified correctness. The added 6-case Codex batch had 6/6 correct controls, so it strengthens treatment reliability and sample size but does not add new false-done lift cases. ReplayPack should not claim broad agent lift until the full-generation protocol runs across more cases and external developer usage.

Full-generation receipts are marked complete only when every treatment case verifies, no protocol violations are found, no manual intervention is used, and at least one control false-done is converted into a verified ReplayPack treatment.

BriefBench passes when all generated briefs are complete, no generated brief leaks an absolute local path, visible-only false done appears in at least 20 cases, ReplayPack rejects at least 90% of those wrong fixes, and ReplayPack recovers to a correct fix in at least 90% of cases.
