# Holy-Fuck Scorecard

ReplayPack should not go public because we like the idea. It goes public when the evidence says a serious agent-heavy developer can understand it, trust it, and want it.

## Current Call

Status: `proofbench_passed_validation_next`

ReplayPack is a credible holy-fuck candidate, but not yet a public launch.

The product mechanism is now benchmark-proven locally:

- wrong fix can pass the visible proof
- ReplayPack rejects it on invariant failure
- correct fix passes proof and invariant
- 10-case synthetic ProofBench passes the launch bar
- package surface is clean
- local Action simulation works

The missing proof is market and in-the-wild proof:

- one real repo dogfood
- private GitHub CI pass from this clean repo
- external developer reaction
- short demo that makes the value obvious without explanation

## Current ProofBench Result

`npm run proofbench` writes `docs/proofbench/results.json`.

Latest local run:

- 10 benchmark cases
- 10 bug families
- 10 visible-green wrong fixes
- ReplayPack rejected 10/10 visible-green wrong fixes
- ReplayPack accepted 10/10 correct fixes
- 0 false positives
- 8 minute median capsule authoring estimate

This is strong mechanism proof. It is still synthetic; it does not replace real repo dogfood or external user proof.

## Gate Scores

| Gate | Score | Pass Bar | Status | Evidence |
| --- | ---: | ---: | --- | --- |
| Product mechanism | 92 | 85 | pass | wrong/fixed account-access demo plus ProofBench |
| Package cleanliness | 86 | 85 | pass | npm dry-run ships 8 files, no fixtures |
| CI/action path | 78 | 85 | pending | local action sim passes; hosted clean-repo CI missing |
| Benchmark proof | 90 | 85 | pass | 10/10 visible-green wrong fixes rejected; 10/10 correct fixes accepted |
| Real repo dogfood | 20 | 80 | fail | no real repo issue yet |
| External user proof | 0 | 75 | fail | no external dev trial yet |
| Discovery/readme | 65 | 80 | pending | README clear, demo still not visual enough |
| Launch readiness | 68 | 85 | no-go | benchmark proof passed; validation proof missing |

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

Public launch is allowed when:

- ProofBench has at least 10 cases
- visible tests accept at least 5 attractive wrong fixes
- ReplayPack rejects at least 80% of those wrong fixes
- ReplayPack accepts at least 90% of correct fixes
- false positive rate is below 10%
- at least one real repo dogfood passes
- at least one external developer understands the value without a live explanation

## The Answer We Want To Earn

The future answer should sound like:

```text
Yes, this is the one.
We have N benchmark cases across M bug families.
Normal tests accepted X wrong agent fixes.
ReplayPack rejected Y of them and accepted Z correct fixes.
The clean repo CI passed, npm install passed, and external devs understood it.
Now launch.
```

Until then, the honest answer is:

```text
ReplayPack is the prime candidate.
It is not yet fully launch-proven.
Next gate is private CI, real repo dogfood, and external user proof.
```
