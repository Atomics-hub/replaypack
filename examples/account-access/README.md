# Account Access Demo

This demo shows the ReplayPack failure mode in one minute.

The issue:

```text
Lena is a global viewer, but she is finance_admin in acct_harbor.
The export endpoint must use account membership and session binding.
```

The wrong fix makes the visible proof pass:

```bash
cd examples/account-access/wrong
node ../../../bin/replaypack.mjs verify replaypack/account-access.json
```

ReplayPack rejects it because the invariant catches `role_source: user`.

The fixed version passes:

```bash
cd examples/account-access/fixed
node ../../../bin/replaypack.mjs verify replaypack/account-access.json
```
