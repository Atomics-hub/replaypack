# Holy-Fuck Scorecard

ReplayPack should not go public because we like the idea. It goes public when the evidence says a serious agent-heavy developer can understand it, trust it, and want it.

## Current Call

Status: `private_ci_next`

ReplayPack is a credible holy-fuck candidate, but not yet a public launch.

The product mechanism is proven locally:

- wrong fix can pass the visible proof
- ReplayPack rejects it on invariant failure
- correct fix passes proof and invariant
- package surface is clean
- local Action simulation works

The missing proof is market and benchmark proof:

- benchmark across many bug families
- one real repo dogfood
- private GitHub CI pass from this clean repo
- external developer reaction
- short demo that makes the value obvious without explanation

## Gate Scores

| Gate | Score | Pass Bar | Status | Evidence |
| --- | ---: | ---: | --- | --- |
| Product mechanism | 90 | 85 | pass | local wrong/fixed account-access demo |
| Package cleanliness | 86 | 85 | pass | npm dry-run ships 8 files, no fixtures |
| CI/action path | 78 | 85 | pending | local action sim passes; hosted clean-repo CI missing |
| Benchmark proof | 25 | 85 | fail | no ProofBench results yet |
| Real repo dogfood | 20 | 80 | fail | no real repo issue yet |
| External user proof | 0 | 75 | fail | no external dev trial yet |
| Discovery/readme | 65 | 80 | pending | README clear, demo still not visual enough |
| Launch readiness | 52 | 85 | no-go | private proof only |

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
Next gate is ProofBench plus real repo dogfood.
```
