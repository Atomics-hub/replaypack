# ReplayPack ProofBench

ProofBench is the evidence engine for ReplayPack.

The benchmark should answer:

```text
How often do normal visible tests accept plausible wrong agent fixes,
and how often does ReplayPack reject those wrong fixes while accepting correct fixes?
```

## Case Shape

Each case needs:

- `issue.md`: short issue description
- `trace.md`: repro or production-style context
- `base/`: minimal project before the fix
- `wrong/`: plausible agent-style wrong fix
- `fixed/`: correct fix
- `replaypack/*.json`: capsule shared by wrong and fixed variants
- visible proof command
- invariant command

## Required Metrics

For each case:

- `visible_proof_on_wrong`: pass/fail
- `replaypack_on_wrong`: pass/fail
- `visible_proof_on_fixed`: pass/fail
- `replaypack_on_fixed`: pass/fail
- `wrong_fix_attractiveness`: low/medium/high
- `bug_family`
- `capsule_author_minutes`

Aggregate metrics:

- wrong fixes accepted by visible proof
- wrong fixes rejected by ReplayPack
- correct fixes accepted by ReplayPack
- false positives
- median capsule author time
- number of distinct bug families

## First Ten Case Targets

1. Account access membership/session binding.
2. Markdown URL parser balanced parentheses.
3. Cache invalidation with stale tenant setting.
4. Date/timezone billing cutoff.
5. Pagination cursor off-by-one.
6. Feature flag fallback inversion.
7. Idempotency key dedupe regression.
8. Retry/backoff swallowing permanent errors.
9. File upload MIME sniffing bypass.
10. Permission check applied after data fetch.

## Launch Bar

Minimum public launch data:

- 10 cases
- 5 or more attractive wrong fixes that pass visible proof
- ReplayPack rejects 80% or more of visible-green wrong fixes
- ReplayPack accepts 90% or more of correct fixes
- at least 5 bug families represented
- median capsule author time under 15 minutes
