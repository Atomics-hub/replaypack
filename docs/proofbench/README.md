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

## First Executable Cases

1. Account access membership/session binding.
2. Pagination cursor off-by-one.
3. Date/timezone billing cutoff.
4. Feature flag fallback inversion.
5. Idempotency key dedupe regression.
6. Retry policy for permanent errors.
7. File upload MIME sniffing bypass.
8. Permission check applied after data fetch.
9. Cache key missing tenant settings version.
10. Rate limit window boundary.

## Launch Bar

Minimum public launch data:

- 10 cases
- 5 or more attractive wrong fixes that pass visible proof
- ReplayPack rejects 80% or more of visible-green wrong fixes
- ReplayPack accepts 90% or more of correct fixes
- at least 5 bug families represented
- median capsule author time under 15 minutes

## Run

```bash
npm run proofbench
```

The runner generates executable benchmark fixtures under `.tmp/proofbench`, runs ReplayPack against each wrong and fixed variant, and writes `docs/proofbench/results.json`.

The generated benchmark is synthetic mechanism proof. It should be treated as necessary but not sufficient for public launch; real repo dogfood and external user proof are separate gates.
