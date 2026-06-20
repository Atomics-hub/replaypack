import assert from "node:assert/strict";
import { loadFixture, resolveExportAccess } from "./helpers.mjs";

const result = resolveExportAccess({
  user: loadFixture("user-lena.json"),
  account: loadFixture("account-harbor.json"),
  session: loadFixture("session-harbor.json"),
  flags: loadFixture("flags.json")
});

assert.equal(result.can_export, true);

console.log("visible proof passed: export button is enabled");
