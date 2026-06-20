# ReplayPack Demo

Run the one-minute proof trap:

```bash
npm run demo
```

Expected shape:

```text
ReplayPack 60-second demo

Case: account-scoped export access

1. Plausible wrong agent fix
   visible proof: ok
   invariant: nonzero
   ReplayPack: rejected
   caught: role_source stayed "user" instead of "account_membership"

2. Correct fix
   visible proof: ok
   invariant: ok
   ReplayPack: accepted
```

What this proves:

- the wrong fix can pass the normal visible proof
- ReplayPack still rejects it because the invariant fails
- the correct fix passes the same proof and invariant path

The demo writes verification packets to `.tmp/demo/` and does not modify the example fixtures.
