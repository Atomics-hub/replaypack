# Invariant Cookbook

ReplayPack works when the visible proof and the invariant do different jobs.

- The visible proof says the reported symptom is fixed.
- The invariant says the product contract still holds.

A useful invariant is small, deterministic, local to the repository, and written in the same language as the code under test. It should fail on the plausible shallow fix an agent is likely to make.

## Choosing The Invariant

Ask this before writing the capsule:

```text
What could an agent change that makes the narrow test pass while still leaving the product wrong?
```

Then write one command that proves that thing did not happen.

Good invariants usually check one of these contracts:

| Pattern | Use When | The Invariant Should Prove |
| --- | --- | --- |
| Authorization scope | Permissions, tenants, accounts, roles | Access comes from the right scope and denies the wrong scope |
| Idempotent jobs | Webhooks, background workers, retries | Duplicate handling is scoped correctly and does not drop legitimate work |
| Money and totals | Billing, invoices, refunds, ledgers | Integer cents, rounding, and totals remain consistent across lines |
| Webhook integrity | Signatures, callbacks, tokens | The payload is bound to the expected secret/body/time, not just a shape |

## Pattern: Authorization Scope

Use this when the bug touches data access, tenant boundaries, roles, or sessions.

Visible proof:

```js
assert.equal(canExport({ user, account, session }).allowed, true);
```

Invariant:

```js
assert.equal(canExport({ user, account, session }).source, "account_membership");

const mismatched = canExport({
  user,
  account,
  session: { accountId: "acct_other" },
  flags: { accountScopedRoles: true, sessionBinding: true }
});

assert.equal(mismatched.allowed, false);
assert.equal(mismatched.source, "session_mismatch");
```

Why this catches shallow fixes: an agent can make the allowed case pass by checking a global user role. The invariant forces account membership and session binding.

## Pattern: Idempotent Jobs

Use this when the bug touches retries, webhook delivery, background jobs, queues, or dedupe keys.

Visible proof:

```js
const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), false);
```

Invariant:

```js
const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_b", key: "evt_1", seen }), true);
```

Why this catches shallow fixes: a global dedupe key skips legitimate work in another account. The invariant forces the dedupe key to include the account scope.

## Pattern: Money And Totals

Use this when the bug touches billing, invoices, refunds, taxes, discounts, currency conversion, or ledger rows.

Visible proof:

```js
assert.equal(totalInvoice([{ unitCents: 1999, qty: 2 }]).totalCents, 3998);
```

Invariant:

```js
const invoice = totalInvoice([
  { unitCents: 333, qty: 3 },
  { unitCents: 250, qty: 2 }
]);

assert.equal(invoice.lines.every((line) => Number.isInteger(line.totalCents)), true);
assert.equal(
  invoice.totalCents,
  invoice.lines.reduce((sum, line) => sum + line.totalCents, 0)
);
```

Why this catches shallow fixes: an agent can hard-code or float-round the visible case. The invariant forces integer cents and line-total consistency.

## Pattern: Webhook Integrity

Use this when the bug touches signatures, callbacks, tokens, replay protection, or shared secrets.

Visible proof:

```js
assert.equal(verifyWebhook({ body: "ping", secret: "live", signature: "sig_live:4" }), true);
```

Invariant:

```js
assert.equal(verifyWebhook({ body: "ping", secret: "live", signature: "sig_test:4" }), false);
assert.equal(verifyWebhook({ body: "pong", secret: "live", signature: "sig_live:4" }), false);
assert.equal(verifyWebhook({ body: "ping", secret: "live", signature: "sig_live:5" }), false);
```

Why this catches shallow fixes: an agent can accept any string with the right prefix. The invariant forces the signature to bind to the secret and body.

## Anti-Patterns

Avoid invariants that:

- repeat the visible proof with different wording
- only snapshot a large output blob
- hit production services
- depend on wall-clock time without freezing it
- rely on random data without a seed
- require secrets or developer-specific credentials
- are so broad that an agent cannot tell what failed

## Agent Prompt

When handing a capsule to an agent, use this language:

```text
The visible proof is not the finish line. Make the smallest change that passes ReplayPack verify. If the visible proof passes but ReplayPack fails, treat the invariant failure as the next repair target.
```

## First Capsule Checklist

Before asking an agent to fix the bug, make sure the capsule has:

- one primary source file
- one visible proof command
- one invariant command
- one issue file explaining the contract
- one trace file showing the real workflow
- a generated agent brief from `replaypack brief`
- a finish gate using `replaypack verify`

