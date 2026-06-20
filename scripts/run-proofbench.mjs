#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const workRoot = path.join(root, ".tmp", "proofbench");
const cli = path.join(root, "bin", "replaypack.mjs");
const resultsPath = path.join(root, "docs", "proofbench", "results.json");

fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(workRoot, { recursive: true });

const caseResults = [];
for (const benchCase of cases()) {
  const caseRoot = path.join(workRoot, benchCase.id);
  const wrongRoot = path.join(caseRoot, "wrong");
  const fixedRoot = path.join(caseRoot, "fixed");

  writeVariant(wrongRoot, benchCase, benchCase.wrongSource);
  writeVariant(fixedRoot, benchCase, benchCase.fixedSource);

  const wrongProof = run(wrongRoot, ["npm", "run", "proof"]);
  const wrongReplayPack = run(wrongRoot, [
    process.execPath,
    cli,
    "verify",
    "replaypack/case.json",
    "--out",
    "dist/replaypack-verify.json"
  ]);
  const fixedProof = run(fixedRoot, ["npm", "run", "proof"]);
  const fixedReplayPack = run(fixedRoot, [
    process.execPath,
    cli,
    "verify",
    "replaypack/case.json",
    "--out",
    "dist/replaypack-verify.json"
  ]);

  caseResults.push({
    id: benchCase.id,
    title: benchCase.title,
    bug_family: benchCase.bugFamily,
    wrong_fix_attractiveness: benchCase.wrongFixAttractiveness,
    capsule_author_minutes: benchCase.capsuleAuthorMinutes,
    visible_proof_on_wrong: statusOf(wrongProof),
    replaypack_on_wrong: statusOf(wrongReplayPack),
    visible_proof_on_fixed: statusOf(fixedProof),
    replaypack_on_fixed: statusOf(fixedReplayPack),
    wrong_replaypack_packet_sha256: packetHash(wrongRoot),
    fixed_replaypack_packet_sha256: packetHash(fixedRoot)
  });
}

const summary = summarize(caseResults);
const results = {
  schema: "replaypack.proofbench.results.v0",
  generated_at: new Date().toISOString(),
  summary,
  cases: caseResults
};

fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

if (!meetsLaunchBar(summary)) {
  process.exit(1);
}

function writeVariant(variantRoot, benchCase, source) {
  fs.mkdirSync(path.join(variantRoot, "src"), { recursive: true });
  fs.mkdirSync(path.join(variantRoot, "test"), { recursive: true });
  fs.mkdirSync(path.join(variantRoot, "issues"), { recursive: true });
  fs.mkdirSync(path.join(variantRoot, "fixtures", "trace"), { recursive: true });
  fs.mkdirSync(path.join(variantRoot, "replaypack"), { recursive: true });

  writeJson(path.join(variantRoot, "package.json"), {
    name: `proofbench-${benchCase.id}`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      proof: "node test/proof.mjs",
      invariant: "node test/invariant.mjs",
      test: "npm run proof && npm run invariant"
    }
  });
  fs.writeFileSync(path.join(variantRoot, "src", "system.js"), source);
  fs.writeFileSync(path.join(variantRoot, "test", "proof.mjs"), benchCase.proof);
  fs.writeFileSync(path.join(variantRoot, "test", "invariant.mjs"), benchCase.invariant);
  fs.writeFileSync(path.join(variantRoot, "issues", "issue.md"), benchCase.issue);
  fs.writeFileSync(path.join(variantRoot, "fixtures", "trace", "repro.md"), benchCase.trace);
  writeJson(path.join(variantRoot, "replaypack", "case.json"), {
    schema: "replaypack.capsule.v0",
    id: benchCase.id,
    title: benchCase.title,
    created_at: "2026-06-20T00:00:00-07:00",
    entrypoint: {
      repo_root: ".",
      primary_file: "src/system.js",
      proof_file: "test/proof.mjs",
      proof_command: "npm run proof",
      invariant_commands: ["npm run invariant"]
    },
    workflow: {
      issue_files: ["issues/issue.md"]
    },
    trace: {
      repro: "fixtures/trace/repro.md",
      observed: benchCase.observed,
      expected: benchCase.expected
    },
    acceptance: benchCase.acceptance,
    agent_instructions: [
      "Do not fix only the visible proof.",
      "Preserve the invariant contract.",
      "Run ReplayPack verify before finishing."
    ]
  });
}

function run(cwd, args) {
  const [command, ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  return {
    status: result.status === 0 ? "pass" : "fail",
    exit_code: result.status,
    stdout_tail: tail(result.stdout ?? "", 1000),
    stderr_tail: tail(result.stderr ?? "", 1000)
  };
}

function summarize(results) {
  const visibleGreenWrong = results.filter((item) => item.visible_proof_on_wrong === "pass").length;
  const replaypackRejectedWrong = results.filter(
    (item) => item.visible_proof_on_wrong === "pass" && item.replaypack_on_wrong === "fail"
  ).length;
  const replaypackAcceptedCorrect = results.filter((item) => item.replaypack_on_fixed === "pass").length;
  const falsePositives = results.filter((item) => item.replaypack_on_fixed === "fail").length;
  const familyCount = new Set(results.map((item) => item.bug_family)).size;
  const authorTimes = results.map((item) => item.capsule_author_minutes).sort((left, right) => left - right);
  return {
    case_count: results.length,
    bug_family_count: familyCount,
    visible_green_wrong_fixes: visibleGreenWrong,
    replaypack_rejected_visible_green_wrong_fixes: replaypackRejectedWrong,
    replaypack_accepted_correct_fixes: replaypackAcceptedCorrect,
    false_positive_count: falsePositives,
    median_capsule_author_minutes: authorTimes[Math.floor(authorTimes.length / 2)] ?? null,
    wrong_fix_rejection_rate:
      visibleGreenWrong === 0 ? 0 : Number((replaypackRejectedWrong / visibleGreenWrong).toFixed(3)),
    correct_fix_acceptance_rate:
      results.length === 0 ? 0 : Number((replaypackAcceptedCorrect / results.length).toFixed(3))
  };
}

function meetsLaunchBar(summary) {
  return (
    summary.case_count >= 10 &&
    summary.bug_family_count >= 5 &&
    summary.visible_green_wrong_fixes >= 5 &&
    summary.replaypack_rejected_visible_green_wrong_fixes >= Math.ceil(summary.visible_green_wrong_fixes * 0.8) &&
    summary.replaypack_accepted_correct_fixes >= Math.ceil(summary.case_count * 0.9) &&
    summary.false_positive_count === 0 &&
    summary.median_capsule_author_minutes <= 15
  );
}

function packetHash(variantRoot) {
  const packetPath = path.join(variantRoot, "dist", "replaypack-verify.json");
  if (!fs.existsSync(packetPath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(packetPath)).digest("hex");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function statusOf(result) {
  return result.status;
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function cases() {
  return [
    {
      id: "account-access",
      title: "Account membership ignored for export access",
      bugFamily: "authorization_state",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 8,
      issue: "# Account access\n\nLena can export only through account membership and matching session.\n",
      trace: "# Trace\n\nGlobal user role is viewer, account membership is finance_admin.\n",
      observed: { can_export: false, role_source: "user" },
      expected: { can_export: true, role_source: "account_membership" },
      acceptance: ["visible export proof passes", "role source is account_membership", "mismatched sessions cannot export"],
      wrongSource: `export function canExport({ user, account, session, flags }) {
  if (!flags.accountScopedRoles) return { allowed: user.role === "admin", source: "user" };
  return { allowed: true, source: "user" };
}
`,
      fixedSource: `export function canExport({ user, account, session, flags }) {
  if (!flags.accountScopedRoles) return { allowed: user.role === "admin", source: "user" };
  if (flags.sessionBinding && session.accountId !== account.id) return { allowed: false, source: "session_mismatch" };
  const role = account.memberships[user.id]?.role;
  return { allowed: role === "finance_admin" || role === "admin", source: role ? "account_membership" : "user" };
}
`,
      proof: `import assert from "node:assert/strict";
import { canExport } from "../src/system.js";
const result = canExport({
  user: { id: "u1", role: "viewer" },
  account: { id: "a1", memberships: { u1: { role: "finance_admin" } } },
  session: { accountId: "a1" },
  flags: { accountScopedRoles: true, sessionBinding: true }
});
assert.equal(result.allowed, true);
`,
      invariant: `import assert from "node:assert/strict";
import { canExport } from "../src/system.js";
const input = {
  user: { id: "u1", role: "viewer" },
  account: { id: "a1", memberships: { u1: { role: "finance_admin" } } },
  session: { accountId: "a1" },
  flags: { accountScopedRoles: true, sessionBinding: true }
};
assert.deepEqual(canExport(input), { allowed: true, source: "account_membership" });
assert.deepEqual(canExport({ ...input, session: { accountId: "other" } }), { allowed: false, source: "session_mismatch" });
`
    },
    {
      id: "pagination-cursor",
      title: "Pagination cursor repeats the last item",
      bugFamily: "pagination",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 7,
      issue: "# Pagination cursor\n\nThe page items are correct but nextCursor must not repeat the last item.\n",
      trace: "# Trace\n\nSecond page repeats an item because the cursor is advanced incorrectly.\n",
      observed: { items: ["b", "c"], nextCursor: "b" },
      expected: { items: ["b", "c"], nextCursor: "c" },
      acceptance: ["visible items are correct", "nextCursor equals last returned item"],
      wrongSource: `export function page(items, after, limit) {
  const start = after ? items.indexOf(after) + 1 : 0;
  const rows = items.slice(start, start + limit);
  return { rows, nextCursor: rows[0] ?? null };
}
`,
      fixedSource: `export function page(items, after, limit) {
  const start = after ? items.indexOf(after) + 1 : 0;
  const rows = items.slice(start, start + limit);
  return { rows, nextCursor: rows.at(-1) ?? null };
}
`,
      proof: `import assert from "node:assert/strict";
import { page } from "../src/system.js";
assert.deepEqual(page(["a", "b", "c", "d"], "a", 2).rows, ["b", "c"]);
`,
      invariant: `import assert from "node:assert/strict";
import { page } from "../src/system.js";
assert.deepEqual(page(["a", "b", "c", "d"], "a", 2), { rows: ["b", "c"], nextCursor: "c" });
`
    },
    {
      id: "timezone-cutoff",
      title: "Billing cutoff ignores tenant timezone",
      bugFamily: "time",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 11,
      issue: "# Billing cutoff\n\nThe cutoff day must respect tenant timezone, not UTC.\n",
      trace: "# Trace\n\nA late UTC event still belongs to the prior local billing day in Los Angeles.\n",
      observed: { billing_day: "2026-07-01" },
      expected: { billing_day: "2026-06-30" },
      acceptance: ["UTC tenant still works", "Los Angeles tenant gets local day"],
      wrongSource: `export function billingDay(iso, timezone) {
  return iso.slice(0, 10);
}
`,
      fixedSource: `export function billingDay(iso, timezone) {
  const date = new Date(iso);
  if (timezone === "America/Los_Angeles") {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  return iso.slice(0, 10);
}
`,
      proof: `import assert from "node:assert/strict";
import { billingDay } from "../src/system.js";
assert.equal(billingDay("2026-07-01T12:00:00.000Z", "UTC"), "2026-07-01");
`,
      invariant: `import assert from "node:assert/strict";
import { billingDay } from "../src/system.js";
assert.equal(billingDay("2026-07-01T06:30:00.000Z", "America/Los_Angeles"), "2026-06-30");
`
    },
    {
      id: "feature-flag-fallback",
      title: "Explicit false feature flag falls back to global default",
      bugFamily: "feature_flags",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 6,
      issue: "# Feature flag fallback\n\nExplicit tenant false must override global true.\n",
      trace: "# Trace\n\nCheckout was enabled for a tenant that explicitly disabled it.\n",
      observed: { enabled: true },
      expected: { enabled: false },
      acceptance: ["true flag works", "explicit false beats global default"],
      wrongSource: `export function enabled(tenantFlag, globalDefault) {
  return Boolean(tenantFlag || globalDefault);
}
`,
      fixedSource: `export function enabled(tenantFlag, globalDefault) {
  return tenantFlag === undefined ? Boolean(globalDefault) : Boolean(tenantFlag);
}
`,
      proof: `import assert from "node:assert/strict";
import { enabled } from "../src/system.js";
assert.equal(enabled(true, false), true);
`,
      invariant: `import assert from "node:assert/strict";
import { enabled } from "../src/system.js";
assert.equal(enabled(false, true), false);
assert.equal(enabled(undefined, true), true);
`
    },
    {
      id: "idempotency-scope",
      title: "Idempotency key dedupes across accounts",
      bugFamily: "idempotency",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 9,
      issue: "# Idempotency scope\n\nDedupe keys are scoped by account.\n",
      trace: "# Trace\n\nSame key in two accounts caused the second account event to be skipped.\n",
      observed: { second_account_processed: false },
      expected: { second_account_processed: true },
      acceptance: ["duplicate within same account is skipped", "same key across accounts is processed"],
      wrongSource: `export function shouldProcess(event, seen) {
  if (seen.has(event.key)) return false;
  seen.add(event.key);
  return true;
}
`,
      fixedSource: `export function shouldProcess(event, seen) {
  const scoped = event.accountId + ":" + event.key;
  if (seen.has(scoped)) return false;
  seen.add(scoped);
  return true;
}
`,
      proof: `import assert from "node:assert/strict";
import { shouldProcess } from "../src/system.js";
const seen = new Set();
assert.equal(shouldProcess({ accountId: "a", key: "k" }, seen), true);
assert.equal(shouldProcess({ accountId: "a", key: "k" }, seen), false);
`,
      invariant: `import assert from "node:assert/strict";
import { shouldProcess } from "../src/system.js";
const seen = new Set();
assert.equal(shouldProcess({ accountId: "a", key: "k" }, seen), true);
assert.equal(shouldProcess({ accountId: "b", key: "k" }, seen), true);
`
    },
    {
      id: "retry-permanent-errors",
      title: "Permanent errors are retried",
      bugFamily: "retry_policy",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 6,
      issue: "# Retry policy\n\nTransient errors retry; permanent validation errors do not.\n",
      trace: "# Trace\n\nValidation failures were retried until the queue backed up.\n",
      observed: { retry: true, code: "validation_failed" },
      expected: { retry: false, code: "validation_failed" },
      acceptance: ["transient network error retries", "validation error is permanent"],
      wrongSource: `export function shouldRetry(error) {
  return error.code !== "ok";
}
`,
      fixedSource: `export function shouldRetry(error) {
  return ["timeout", "network", "rate_limited"].includes(error.code);
}
`,
      proof: `import assert from "node:assert/strict";
import { shouldRetry } from "../src/system.js";
assert.equal(shouldRetry({ code: "timeout" }), true);
`,
      invariant: `import assert from "node:assert/strict";
import { shouldRetry } from "../src/system.js";
assert.equal(shouldRetry({ code: "validation_failed" }), false);
`
    },
    {
      id: "upload-mime-sniff",
      title: "Upload validation trusts file extension",
      bugFamily: "file_security",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 10,
      issue: "# Upload MIME sniffing\n\nJPEG extension is not enough; bytes must be JPEG.\n",
      trace: "# Trace\n\nA .jpg upload with PHP bytes was accepted.\n",
      observed: { accepted: true, bytes: "<?php" },
      expected: { accepted: false },
      acceptance: ["real jpg accepted", "extension-only disguised file rejected"],
      wrongSource: `export function acceptUpload(file) {
  return file.name.endsWith(".jpg") || file.type === "image/jpeg";
}
`,
      fixedSource: `export function acceptUpload(file) {
  return file.type === "image/jpeg" && file.bytes.startsWith("FFD8");
}
`,
      proof: `import assert from "node:assert/strict";
import { acceptUpload } from "../src/system.js";
assert.equal(acceptUpload({ name: "cat.jpg", type: "image/jpeg", bytes: "FFD8FFE0" }), true);
`,
      invariant: `import assert from "node:assert/strict";
import { acceptUpload } from "../src/system.js";
assert.equal(acceptUpload({ name: "shell.jpg", type: "image/jpeg", bytes: "<?php" }), false);
`
    },
    {
      id: "permission-after-fetch",
      title: "Permission check masks after fetching private data",
      bugFamily: "authorization_flow",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# Permission after fetch\n\nUnauthorized users should get no record, not masked secret data.\n",
      trace: "# Trace\n\nRecord lookup happened before authorization and returned object shape to caller.\n",
      observed: { id: "r1", secret: null },
      expected: null,
      acceptance: ["owner gets record", "non-owner gets null"],
      wrongSource: `export function visibleRecord(user, record) {
  if (record.ownerId === user.id) return record;
  return { id: record.id, secret: null };
}
`,
      fixedSource: `export function visibleRecord(user, record) {
  if (record.ownerId !== user.id) return null;
  return record;
}
`,
      proof: `import assert from "node:assert/strict";
import { visibleRecord } from "../src/system.js";
assert.deepEqual(visibleRecord({ id: "u1" }, { id: "r1", ownerId: "u1", secret: "s" }).secret, "s");
`,
      invariant: `import assert from "node:assert/strict";
import { visibleRecord } from "../src/system.js";
assert.equal(visibleRecord({ id: "u2" }, { id: "r1", ownerId: "u1", secret: "s" }), null);
`
    },
    {
      id: "cache-key-settings",
      title: "Cache key ignores tenant settings version",
      bugFamily: "cache_invalidation",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 7,
      issue: "# Cache key settings\n\nCache key must change when settings version changes.\n",
      trace: "# Trace\n\nTenant config update was ignored because cached render key only used tenant id.\n",
      observed: { key_changed: false },
      expected: { key_changed: true },
      acceptance: ["stable settings produce stable key", "settings version changes key"],
      wrongSource: `export function cacheKey(tenant) {
  return tenant.id;
}
`,
      fixedSource: `export function cacheKey(tenant) {
  return tenant.id + ":" + tenant.settingsVersion;
}
`,
      proof: `import assert from "node:assert/strict";
import { cacheKey } from "../src/system.js";
assert.equal(cacheKey({ id: "a", settingsVersion: 1 }), cacheKey({ id: "a", settingsVersion: 1 }));
`,
      invariant: `import assert from "node:assert/strict";
import { cacheKey } from "../src/system.js";
assert.notEqual(cacheKey({ id: "a", settingsVersion: 1 }), cacheKey({ id: "a", settingsVersion: 2 }));
`
    },
    {
      id: "rate-limit-boundary",
      title: "Rate limit window boundary never expires old request",
      bugFamily: "rate_limits",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# Rate limit boundary\n\nRequests exactly at the window boundary should expire.\n",
      trace: "# Trace\n\nA customer remained blocked after the oldest request reached the boundary.\n",
      observed: { allowed: false },
      expected: { allowed: true },
      acceptance: ["under limit is allowed", "boundary request expires"],
      wrongSource: `export function allowed(requestTimes, now, limit, windowMs) {
  const recent = requestTimes.filter((time) => now - time <= windowMs);
  return recent.length < limit;
}
`,
      fixedSource: `export function allowed(requestTimes, now, limit, windowMs) {
  const recent = requestTimes.filter((time) => now - time < windowMs);
  return recent.length < limit;
}
`,
      proof: `import assert from "node:assert/strict";
import { allowed } from "../src/system.js";
assert.equal(allowed([90], 100, 2, 60), true);
`,
      invariant: `import assert from "node:assert/strict";
import { allowed } from "../src/system.js";
assert.equal(allowed([40], 100, 1, 60), true);
`
    }
  ];
}
