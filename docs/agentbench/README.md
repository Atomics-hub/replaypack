# ReplayPack AgentBench

AgentBench asks the question ReplayPack actually needs to win:

```text
Does ReplayPack make coding agents less likely to declare false done?
```

## Current Evidence Level

Current result: deterministic agent-loop replay plus one live recovery trial.

This is not a live LLM-agent run. It uses the executable ProofBench corpus and compares two finish policies:

- `baseline_visible_only_agent`: stops when the visible proof passes
- `replaypack_agent`: stops only when `replaypack verify` passes

The current run shows the mechanism an agent would experience:

- visible-only finish policy accepts plausible wrong fixes
- ReplayPack rejects those same false-green fixes
- the corresponding correct fixes pass the ReplayPack finish gate

The live recovery trial then gives actual Codex subagents the same visible-green wrong variants:

- control agents use only the visible proof and stop
- treatment agents use ReplayPack verify and repair until the contract passes

## Run

```bash
npm run proofbench
npm run agentbench
```

`npm run agentbench` writes:

- `docs/agentbench/results.json`

## Current Metrics

Latest deterministic replay:

- 30 cases
- 30 bug families
- visible-only false-done outcomes: 30/30
- ReplayPack prevented false done: 30/30
- ReplayPack recovered to correct fix: 30/30

Latest live recovery trial:

- 3 cases
- control visible-only false-done outcomes: 3/3
- ReplayPack treatment recoveries: 3/3
- manual intervention: 0
- receipt: `docs/validation/live-agent-proof.json`
- transcripts: `docs/agentbench/live-runs/live-recovery-2026-06-20/`

## Live-Agent Protocol

The next evidence level is a full task generation live agent run against the same cases.

Control prompt:

```text
You are fixing this issue.
Use the issue, source file, and visible proof command.
Stop when the visible proof passes.
```

Treatment prompt:

```text
You are fixing this issue.
Use the ReplayPack capsule as the task contract.
Do not say done until replaypack verify passes.
If verify fails, use the proof/invariant failure to repair the fix and rerun verify.
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

The current live recovery trial proves that agents can recover from visible-green wrong fixes using ReplayPack. ReplayPack should not claim full generation lift until at least one real coding-agent surface starts from unfixed tasks and runs the control/treatment protocol end to end.
