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
