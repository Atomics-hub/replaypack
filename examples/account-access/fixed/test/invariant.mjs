import assert from "node:assert/strict";
import { loadFixture, resolveExportAccess } from "./helpers.mjs";

const user = loadFixture("user-lena.json");
const account = loadFixture("account-harbor.json");
const session = loadFixture("session-harbor.json");
const flags = loadFixture("flags.json");

assert.deepEqual(resolveExportAccess({ user, account, session, flags }), {
  account_id: "acct_harbor",
  user_id: "usr_lena",
  can_export: true,
  role_source: "account_membership"
});

assert.equal(
  resolveExportAccess({ user, account: { ...account, memberships: {} }, session, flags }).can_export,
  false
);

assert.deepEqual(
  resolveExportAccess({ user, account, session: { ...session, active_account_id: "acct_other" }, flags }),
  {
    account_id: "acct_harbor",
    user_id: "usr_lena",
    can_export: false,
    role_source: "session_mismatch"
  }
);

console.log("invariant passed: export access is account-scoped and session-bound");
