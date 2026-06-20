# Private Public-Repo Trials

These trials run ReplayPack privately against local clones of public repositories.

The goal is portability evidence:

```text
Can ReplayPack package and verify an invariant against real public code without project-specific setup?
```

This is not external user proof. It does not show that an outside developer understands or wants ReplayPack.

## Safety Rules

- Clone public repositories into `.tmp/public-repo-trials`.
- Do not push, fork, open issues, open PRs, or contact maintainers.
- Do not run repository install scripts.
- Run proof and invariant commands with a scrubbed environment.
- Use selected small repositories with simple importable APIs.
- Record aggregate evidence in `docs/public-repo-trials/results.json`.

## Run

```bash
npm run public-repo-trials
```

The current pilot batch uses:

- `sindresorhus/escape-string-regexp`
- `sindresorhus/is-plain-obj`
- `sindresorhus/yoctocolors`
- `sindresorhus/array-move`
- `sindresorhus/quick-lru`
- `sindresorhus/decamelize`
- `sindresorhus/camelcase`

## Interpreting Results

A pass means:

- the public repository cloned cleanly
- the local ReplayPack capsule had all referenced files
- the visible proof command passed
- the invariant command passed
- ReplayPack wrote a verification packet

A pass does not mean:

- the public project endorses ReplayPack
- a maintainer reviewed it
- the trial found a real upstream bug
- external comprehension proof is complete
