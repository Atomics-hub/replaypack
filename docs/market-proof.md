# Market Proof Loop

ReplayPack needs discovery proof, not just correctness proof.

## Target Users

- developers merging AI-generated PRs
- maintainers reviewing plausible drive-by fixes
- teams using Codex, Claude Code, Cursor, Copilot, or SWE agents in CI
- infra owners responsible for merge gates

## Discovery Bets

1. GitHub Action Marketplace.
2. npm search for agent verification / AI code review / invariant CI.
3. short demo video or GIF.
4. blog post with benchmark numbers.
5. examples for Codex, Claude Code, Cursor, and Copilot PR flow.

## Questions To Answer Before Launch

- Can a stranger explain ReplayPack after reading the README for one minute?
- Can they run the demo without help?
- Do they understand why this is not "just tests"?
- Do they have a repo where plausible agent fixes are a real problem?
- Would they install a GitHub Action for it?

## Minimum External Proof

Before a broad public launch:

- 3 developer conversations
- 1 private external trial
- 1 quote or paraphrased reaction that shows the concept landed
- 1 concrete objection addressed in docs or CLI

Current collection path:

- GitHub issue form: https://github.com/Atomics-hub/replaypack/issues/new?template=external-developer-trial.yml
- Trial script: `docs/trials/external-developer-trial.md`

## Positioning

Primary:

```text
ReplayPack is the merge gate for agent-made code.
```

Supporting:

```text
It catches fixes that make the visible test pass while breaking the invariant.
```

Avoid:

- "AI testing platform"
- "agent memory"
- "better unit tests"
- "security sandbox"

## 2026 Market Snapshot

Current vendor movement strengthens the need for ReplayPack but also narrows the wedge.

- GitHub Copilot cloud agent positions itself as a background coding worker that researches a repository, plans, edits branches, runs in a GitHub Actions-powered environment, and can create PRs: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- Claude Code GitHub Actions turns issues and PR comments into implementation/review workflows on GitHub runners, with API and Actions cost concerns: https://code.claude.com/docs/en/github-actions
- OpenAI Codex code review can review PRs, follow `AGENTS.md`, post focused findings, and start cloud tasks from PR comments: https://developers.openai.com/codex/integrations/github
- Cursor Bugbot reviews PRs in GitHub and can provide fixes through Cursor or Background Agent: https://cursor.com/bugbot

Inference from these sources: the big platforms are racing to own generation, review, and hosted agent execution. ReplayPack should not try to be another agent runner or AI reviewer. The defensible wedge is a small, provider-neutral merge gate: portable capsules that prove a fix satisfied the invariant, not just the visible test.

External research also supports the pain:

- ETH Zurich SRI reported that coding agents often patch already-correct code rather than abstaining, which points to weak verification discipline in autonomous maintenance: https://www.sri.inf.ethz.ch/blog/fixedcode
- Recent benchmark work like c-CRAB converts review feedback into executable behavioral tests, which points the market toward executable proof over prose-only review: https://arxiv.org/html/2603.23448v2

## Name/Surface Checks

Last local check: 2026-06-20.

- `npm view replaypack name version description repository --json` returned `E404`, so the npm package name appeared unclaimed.
- `git ls-remote https://github.com/Atomics-hub/replaypack.git` returned repository not found, so the target public repo was not already live.
