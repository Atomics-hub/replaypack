# Security

ReplayPack capsules can run arbitrary proof and invariant commands.

Treat a capsule like a CI workflow file:

- Review capsules before running them.
- Run capsules only from repositories or people you trust.
- Do not verify untrusted capsules on a machine with secrets available.
- Prefer least-privilege CI tokens and standard CI isolation.

ReplayPack is a verification format and CLI. It is not a sandbox.
