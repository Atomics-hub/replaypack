# Holy-Fuck Scorecard

ReplayPack should not go public because we like the idea. It goes public when the evidence says a serious agent-heavy developer can understand it, trust it, and want it.

## Current Call

Status: `npm_released_external_user_trial_next`

ReplayPack is a credible holy-fuck candidate with public GitHub and npm release live. External demand is not proven yet.

The product mechanism is now benchmark-proven locally:

- wrong fix can pass the visible proof
- ReplayPack rejects it on invariant failure
- correct fix passes proof and invariant
- 10-case synthetic ProofBench passes the launch bar
- package surface is clean
- private GitHub CI passes
- real self-dogfood passes on a launch-blocking CI issue
- fresh private clone can run the wrong/fixed demo and dogfood capsule
- private public-repo trials pass on 7/7 selected OSS repositories
- public GitHub beta is live with a tester issue
- npm package `replaypack@0.2.0` is published and install-verified
- GitHub release `v0.2.0` points at the published commit

The missing market proof is external comprehension proof:

- external developer reaction
- confirmation that the demo makes the value obvious without a live explanation

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
| Package cleanliness | 92 | 85 | pass | npm package ships 8 files, installs cleanly, CLI runs |
| CI/action path | 90 | 85 | pass | GitHub Actions passed on public remote |
| Benchmark proof | 90 | 85 | pass | 10/10 visible-green wrong fixes rejected; 10/10 correct fixes accepted |
| Real repo dogfood | 82 | 80 | pass | self-dogfood caught the real CI pack-destination failure mode |
| Public repo private trials | 88 | 80 | pass | 7/7 selected public repos verified with local capsules |
| External user proof | 0 | 75 | fail | no external dev trial yet |
| Discovery/readme | 80 | 80 | pass | npm-ready README, public beta issue, and evidence page live |
| Launch readiness | 88 | 85 | package-live | GitHub and npm are live; market proof still waits on external users |

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

- ProofBench has at least 10 cases
- visible tests accept at least 5 attractive wrong fixes
- ReplayPack rejects at least 80% of those wrong fixes
- ReplayPack accepts at least 90% of correct fixes
- false positive rate is below 10%
- at least one real repo dogfood passes
- private public-repo trials pass on selected OSS repos without public writes
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
It is package-launched, but not yet market-proven.
Next gate is external user proof.
```
