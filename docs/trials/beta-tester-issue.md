# Beta testers: run the 10-minute ReplayPack trial

ReplayPack is a merge gate for agent-made code. It catches fixes that make the visible test pass while breaking the invariant.

We are looking for 5 developers who use coding agents to run a short trial and tell us whether this is useful or nonsense.

## Trial

Follow:

https://github.com/Atomics-hub/replaypack/blob/main/docs/trials/external-developer-trial.md

Short version:

```bash
git clone https://github.com/Atomics-hub/replaypack.git
cd replaypack
npm run trial:external
```

It should take about 10 minutes and writes `dist/external-trial/receipt.json`.

## Please Reply With

1. After one minute with the README, what did you think ReplayPack does?
2. Did the wrong/fixed demo make sense without a live explanation?
3. Do you understand why this is not just unit tests?
4. Would you add this to a repo where coding agents make PRs?
5. What confused you or would stop you from using it?

Blunt feedback is better than polite feedback. If this is not useful, say why.
