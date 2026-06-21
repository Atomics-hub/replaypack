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
    summary.case_count >= 30 &&
    summary.bug_family_count >= 20 &&
    summary.visible_green_wrong_fixes >= 20 &&
    summary.replaypack_rejected_visible_green_wrong_fixes >= Math.ceil(summary.visible_green_wrong_fixes * 0.9) &&
    summary.replaypack_accepted_correct_fixes >= Math.ceil(summary.case_count * 0.9) &&
    summary.false_positive_count === 0 &&
    summary.median_capsule_author_minutes <= 15
  );
}

function packetHash(variantRoot) {
  const packetPath = path.join(variantRoot, "dist", "replaypack-verify.json");
  if (!fs.existsSync(packetPath)) return null;
  const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
  const stablePacket = {
    evidence_kind: packet.evidence_kind,
    status: packet.status,
    capsule: packet.capsule,
    entrypoint: packet.entrypoint,
    reference_checks: packet.reference_checks,
    proof: stableCommandResult(packet.proof),
    invariants: (packet.invariants ?? []).map((item) => ({
      command: item.command,
      ...stableCommandResult(item)
    }))
  };
  return crypto.createHash("sha256").update(`${JSON.stringify(stablePacket)}\n`).digest("hex");
}

function stableCommandResult(result) {
  return {
    status: result?.status ?? null,
    exit_code: result?.exit_code ?? null
  };
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
    },
    ...additionalCases()
  ];
}

function additionalCases() {
  return [
    {
      id: "webhook-signature",
      title: "Webhook verification accepts signature prefixes",
      bugFamily: "webhook_authenticity",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 9,
      issue: "# Webhook signature\n\nOnly signatures created with the shared secret should verify.\n",
      trace: "# Trace\n\nA forged signature with the right prefix was accepted.\n",
      observed: { accepted: true, signature: "sig_attacker" },
      expected: { accepted: false },
      acceptance: ["legitimate signature passes", "wrong secret signature fails"],
      wrongSource: `export function verifyWebhook(request, secret) {
  return typeof request.signature === "string" && request.signature.startsWith("sig_");
}
`,
      fixedSource: `export function sign(body, secret) {
  return "sig_" + secret + ":" + body.length;
}

export function verifyWebhook(request, secret) {
  return request.signature === sign(request.body, secret);
}
`,
      proof: `import assert from "node:assert/strict";
import { verifyWebhook } from "../src/system.js";
assert.equal(verifyWebhook({ body: "paid", signature: "sig_live:4" }, "live"), true);
`,
      invariant: `import assert from "node:assert/strict";
import { verifyWebhook } from "../src/system.js";
assert.equal(verifyWebhook({ body: "paid", signature: "sig_test:4" }, "live"), false);
`
    },
    {
      id: "currency-line-rounding",
      title: "Currency totals round after summing fractional lines",
      bugFamily: "money_precision",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# Currency rounding\n\nLine items are rounded to cents before totaling.\n",
      trace: "# Trace\n\nTwo fractional line items undercharged by one cent when rounded only at the end.\n",
      observed: { subtotal_cents: 67 },
      expected: { subtotal_cents: 68 },
      acceptance: ["simple dollar totals pass", "fractional line items round per line"],
      wrongSource: `export function subtotalCents(lines) {
  const subtotal = lines.reduce((sum, line) => sum + line.priceDollars * line.quantity, 0);
  return Math.round(subtotal * 100);
}
`,
      fixedSource: `export function subtotalCents(lines) {
  return lines.reduce((sum, line) => sum + Math.round(line.priceDollars * 100) * line.quantity, 0);
}
`,
      proof: `import assert from "node:assert/strict";
import { subtotalCents } from "../src/system.js";
assert.equal(subtotalCents([{ priceDollars: 1, quantity: 2 }]), 200);
`,
      invariant: `import assert from "node:assert/strict";
import { subtotalCents } from "../src/system.js";
assert.equal(subtotalCents([{ priceDollars: 0.335, quantity: 1 }, { priceDollars: 0.335, quantity: 1 }]), 68);
`
    },
    {
      id: "sort-stability",
      title: "Equal-rank sorting rewrites stable order",
      bugFamily: "sorting_contract",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 6,
      issue: "# Sort stability\n\nUsers with the same rank keep their original order.\n",
      trace: "# Trace\n\nThe tiebreaker alphabetized equal-rank rows and changed reviewer queue order.\n",
      observed: { order: ["a", "b"] },
      expected: { order: ["b", "a"] },
      acceptance: ["different ranks sort correctly", "equal ranks preserve input order"],
      wrongSource: `export function rankUsers(users) {
  return users.slice().sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
}
`,
      fixedSource: `export function rankUsers(users) {
  return users.slice().sort((left, right) => left.rank - right.rank);
}
`,
      proof: `import assert from "node:assert/strict";
import { rankUsers } from "../src/system.js";
assert.deepEqual(rankUsers([{ id: "b", rank: 2 }, { id: "a", rank: 1 }]).map((user) => user.id), ["a", "b"]);
`,
      invariant: `import assert from "node:assert/strict";
import { rankUsers } from "../src/system.js";
assert.deepEqual(rankUsers([{ id: "b", rank: 1 }, { id: "a", rank: 1 }]).map((user) => user.id), ["b", "a"]);
`
    },
    {
      id: "soft-delete-filter",
      title: "Soft-deleted active records remain visible",
      bugFamily: "soft_delete",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 7,
      issue: "# Soft delete\n\nRecords with deletedAt are invisible even when status is active.\n",
      trace: "# Trace\n\nA restored-looking active record still had deletedAt and appeared in search.\n",
      observed: { visible_ids: ["live", "deleted"] },
      expected: { visible_ids: ["live"] },
      acceptance: ["active records appear", "soft-deleted records never appear"],
      wrongSource: `export function visibleRecords(records) {
  return records.filter((record) => record.status === "active");
}
`,
      fixedSource: `export function visibleRecords(records) {
  return records.filter((record) => record.status === "active" && !record.deletedAt);
}
`,
      proof: `import assert from "node:assert/strict";
import { visibleRecords } from "../src/system.js";
assert.deepEqual(visibleRecords([{ id: "live", status: "active" }]).map((record) => record.id), ["live"]);
`,
      invariant: `import assert from "node:assert/strict";
import { visibleRecords } from "../src/system.js";
const records = [{ id: "live", status: "active" }, { id: "deleted", status: "active", deletedAt: "2026-06-20" }];
assert.deepEqual(visibleRecords(records).map((record) => record.id), ["live"]);
`
    },
    {
      id: "tenant-search-leak",
      title: "Tenant search returns matching rows from other tenants",
      bugFamily: "tenant_isolation",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 9,
      issue: "# Tenant search\n\nSearch results must be scoped to the active tenant before ranking or limiting.\n",
      trace: "# Trace\n\nA matching document from tenant B appeared in tenant A results.\n",
      observed: { result_tenants: ["a", "b"] },
      expected: { result_tenants: ["a"] },
      acceptance: ["single-tenant search works", "cross-tenant matches are excluded"],
      wrongSource: `export function searchDocs(docs, tenantId, query, limit) {
  return docs.filter((doc) => doc.text.includes(query)).slice(0, limit);
}
`,
      fixedSource: `export function searchDocs(docs, tenantId, query, limit) {
  return docs.filter((doc) => doc.tenantId === tenantId && doc.text.includes(query)).slice(0, limit);
}
`,
      proof: `import assert from "node:assert/strict";
import { searchDocs } from "../src/system.js";
const docs = [{ id: "a1", tenantId: "a", text: "billing export" }];
assert.deepEqual(searchDocs(docs, "a", "billing", 5).map((doc) => doc.id), ["a1"]);
`,
      invariant: `import assert from "node:assert/strict";
import { searchDocs } from "../src/system.js";
const docs = [{ id: "a1", tenantId: "a", text: "billing export" }, { id: "b1", tenantId: "b", text: "billing export" }];
assert.deepEqual(searchDocs(docs, "a", "billing", 5).map((doc) => doc.tenantId), ["a"]);
`
    },
    {
      id: "csv-formula-escape",
      title: "CSV export leaves spreadsheet formulas executable",
      bugFamily: "spreadsheet_injection",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 7,
      issue: "# CSV formula escaping\n\nCells beginning with formula characters must be escaped before export.\n",
      trace: "# Trace\n\nA customer name beginning with = was opened as a spreadsheet formula.\n",
      observed: { cell: "=HYPERLINK(...)" },
      expected: { cell: "'=HYPERLINK(...)" },
      acceptance: ["normal cells export cleanly", "formula-looking cells are escaped"],
      wrongSource: `export function csvCell(value) {
  const text = String(value);
  return text.includes(",") ? '"' + text.replaceAll('"', '""') + '"' : text;
}
`,
      fixedSource: `export function csvCell(value) {
  const text = String(value);
  const safe = ["=", "+", "-", "@"].some((prefix) => text.startsWith(prefix)) ? "'" + text : text;
  return safe.includes(",") ? '"' + safe.replaceAll('"', '""') + '"' : safe;
}
`,
      proof: `import assert from "node:assert/strict";
import { csvCell } from "../src/system.js";
assert.equal(csvCell("Acme"), "Acme");
`,
      invariant: `import assert from "node:assert/strict";
import { csvCell } from "../src/system.js";
assert.equal(csvCell("=HYPERLINK(\\"https://example.com\\")"), "'=HYPERLINK(\\"https://example.com\\")");
`
    },
    {
      id: "markdown-link-sanitize",
      title: "Markdown links allow javascript URLs",
      bugFamily: "link_sanitization",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 6,
      issue: "# Markdown link sanitization\n\nRendered links must allow http(s) and reject javascript URLs.\n",
      trace: "# Trace\n\nA user profile link rendered a javascript: href.\n",
      observed: { href: "javascript:alert(1)" },
      expected: { href: null },
      acceptance: ["https links render", "javascript links are blocked"],
      wrongSource: `export function safeHref(href) {
  return href && href.trim() ? href : null;
}
`,
      fixedSource: `export function safeHref(href) {
  const trimmed = href.trim();
  return trimmed.startsWith("https://") || trimmed.startsWith("http://") ? trimmed : null;
}
`,
      proof: `import assert from "node:assert/strict";
import { safeHref } from "../src/system.js";
assert.equal(safeHref("https://example.com"), "https://example.com");
`,
      invariant: `import assert from "node:assert/strict";
import { safeHref } from "../src/system.js";
assert.equal(safeHref("javascript:alert(1)"), null);
`
    },
    {
      id: "path-root-prefix",
      title: "Path root check accepts sibling directories with matching prefix",
      bugFamily: "path_security",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 10,
      issue: "# Path root check\n\nUpload paths must remain inside the upload root, not merely share its prefix.\n",
      trace: "# Trace\n\n/tmp/uploads-evil/file.txt was treated as inside /tmp/uploads.\n",
      observed: { inside: true },
      expected: { inside: false },
      acceptance: ["real child path accepted", "prefix sibling rejected"],
      wrongSource: `import path from "node:path";

export function insideUploadRoot(root, candidate) {
  return path.resolve(candidate).startsWith(path.resolve(root));
}
`,
      fixedSource: `import path from "node:path";

export function insideUploadRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
}
`,
      proof: `import assert from "node:assert/strict";
import { insideUploadRoot } from "../src/system.js";
assert.equal(insideUploadRoot("/tmp/uploads", "/tmp/uploads/photo.jpg"), true);
`,
      invariant: `import assert from "node:assert/strict";
import { insideUploadRoot } from "../src/system.js";
assert.equal(insideUploadRoot("/tmp/uploads", "/tmp/uploads-evil/file.txt"), false);
`
    },
    {
      id: "email-normalization",
      title: "Email normalization lowercases the local part",
      bugFamily: "email_identity",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 6,
      issue: "# Email normalization\n\nOnly the domain is normalized; the local part must be preserved.\n",
      trace: "# Trace\n\nA case-sensitive local mailbox was rewritten during invite lookup.\n",
      observed: { email: "tom@example.com" },
      expected: { email: "Tom@example.com" },
      acceptance: ["domain lowercases", "local part keeps original case"],
      wrongSource: `export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
`,
      fixedSource: `export function normalizeEmail(email) {
  const [local, domain] = email.trim().split("@");
  return local + "@" + domain.toLowerCase();
}
`,
      proof: `import assert from "node:assert/strict";
import { normalizeEmail } from "../src/system.js";
assert.equal(normalizeEmail("tom@EXAMPLE.COM"), "tom@example.com");
`,
      invariant: `import assert from "node:assert/strict";
import { normalizeEmail } from "../src/system.js";
assert.equal(normalizeEmail("Tom@EXAMPLE.COM"), "Tom@example.com");
`
    },
    {
      id: "session-expiry-boundary",
      title: "Sessions remain valid exactly at expiry",
      bugFamily: "session_lifecycle",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 6,
      issue: "# Session expiry\n\nA session expires when now reaches expiresAt.\n",
      trace: "# Trace\n\nRequests at the exact expiry millisecond were accepted.\n",
      observed: { valid: true },
      expected: { valid: false },
      acceptance: ["future sessions are valid", "exact expiry is invalid"],
      wrongSource: `export function sessionValid(session, nowMs) {
  return session.expiresAtMs >= nowMs;
}
`,
      fixedSource: `export function sessionValid(session, nowMs) {
  return session.expiresAtMs > nowMs;
}
`,
      proof: `import assert from "node:assert/strict";
import { sessionValid } from "../src/system.js";
assert.equal(sessionValid({ expiresAtMs: 200 }, 100), true);
`,
      invariant: `import assert from "node:assert/strict";
import { sessionValid } from "../src/system.js";
assert.equal(sessionValid({ expiresAtMs: 100 }, 100), false);
`
    },
    {
      id: "queue-priority",
      title: "Queue dispatch ignores urgent priority",
      bugFamily: "job_priority",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# Queue priority\n\nCritical jobs run before older normal jobs, while same-priority jobs stay FIFO.\n",
      trace: "# Trace\n\nA critical incident job waited behind an older normal digest job.\n",
      observed: { next_job: "normal" },
      expected: { next_job: "critical" },
      acceptance: ["same-priority FIFO works", "critical beats older normal"],
      wrongSource: `export function nextJob(jobs) {
  return jobs.slice().sort((left, right) => left.enqueuedAt - right.enqueuedAt)[0];
}
`,
      fixedSource: `const ranks = { critical: 0, high: 1, normal: 2, low: 3 };

export function nextJob(jobs) {
  return jobs.slice().sort((left, right) => ranks[left.priority] - ranks[right.priority] || left.enqueuedAt - right.enqueuedAt)[0];
}
`,
      proof: `import assert from "node:assert/strict";
import { nextJob } from "../src/system.js";
const jobs = [{ id: "old", priority: "normal", enqueuedAt: 1 }, { id: "new", priority: "normal", enqueuedAt: 2 }];
assert.equal(nextJob(jobs).id, "old");
`,
      invariant: `import assert from "node:assert/strict";
import { nextJob } from "../src/system.js";
const jobs = [{ id: "normal", priority: "normal", enqueuedAt: 1 }, { id: "critical", priority: "critical", enqueuedAt: 2 }];
assert.equal(nextJob(jobs).id, "critical");
`
    },
    {
      id: "inventory-reservation",
      title: "Inventory check ignores reserved units",
      bugFamily: "inventory_reservation",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 7,
      issue: "# Inventory reservation\n\nAvailability is stock minus already reserved quantity.\n",
      trace: "# Trace\n\nCheckout allowed units that were already reserved by another cart.\n",
      observed: { available: true },
      expected: { available: false },
      acceptance: ["in-stock item is available", "reserved quantity reduces availability"],
      wrongSource: `export function canReserve(item, quantity) {
  return item.stock >= quantity;
}
`,
      fixedSource: `export function canReserve(item, quantity) {
  return item.stock - item.reserved >= quantity;
}
`,
      proof: `import assert from "node:assert/strict";
import { canReserve } from "../src/system.js";
assert.equal(canReserve({ stock: 5, reserved: 0 }, 3), true);
`,
      invariant: `import assert from "node:assert/strict";
import { canReserve } from "../src/system.js";
assert.equal(canReserve({ stock: 5, reserved: 4 }, 2), false);
`
    },
    {
      id: "schema-migration-default",
      title: "Migration overwrites explicit false with default true",
      bugFamily: "migration_defaults",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 7,
      issue: "# Migration defaults\n\nMissing sendEmail defaults true, but explicit false must survive migration.\n",
      trace: "# Trace\n\nUsers who opted out were migrated back into email sends.\n",
      observed: { sendEmail: true },
      expected: { sendEmail: false },
      acceptance: ["missing value gets default", "explicit false is preserved"],
      wrongSource: `export function migratePrefs(record) {
  return { ...record, sendEmail: record.sendEmail || true };
}
`,
      fixedSource: `export function migratePrefs(record) {
  return { ...record, sendEmail: record.sendEmail ?? true };
}
`,
      proof: `import assert from "node:assert/strict";
import { migratePrefs } from "../src/system.js";
assert.equal(migratePrefs({ id: "u1" }).sendEmail, true);
`,
      invariant: `import assert from "node:assert/strict";
import { migratePrefs } from "../src/system.js";
assert.equal(migratePrefs({ id: "u1", sendEmail: false }).sendEmail, false);
`
    },
    {
      id: "redaction-nested",
      title: "Redaction misses nested secrets",
      bugFamily: "pii_redaction",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 10,
      issue: "# Nested redaction\n\nSecret keys must be redacted at any object depth.\n",
      trace: "# Trace\n\nA nested API token was written to the support bundle.\n",
      observed: { profile: { token: "abc" } },
      expected: { profile: { token: "[redacted]" } },
      acceptance: ["top-level password redacts", "nested token redacts"],
      wrongSource: `export function redact(value) {
  const copy = { ...value };
  if ("password" in copy) copy.password = "[redacted]";
  if ("token" in copy) copy.token = "[redacted]";
  return copy;
}
`,
      fixedSource: `const secretKeys = new Set(["password", "token", "secret"]);

export function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKeys.has(key) ? "[redacted]" : redact(item)]));
}
`,
      proof: `import assert from "node:assert/strict";
import { redact } from "../src/system.js";
assert.equal(redact({ password: "pw", name: "A" }).password, "[redacted]");
`,
      invariant: `import assert from "node:assert/strict";
import { redact } from "../src/system.js";
assert.equal(redact({ profile: { token: "abc" } }).profile.token, "[redacted]");
`
    },
    {
      id: "locale-slug",
      title: "Slug generation drops accented characters",
      bugFamily: "unicode_slugs",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# Locale slug\n\nAccented Latin characters should transliterate before slug cleanup.\n",
      trace: "# Trace\n\nCafe pages split because Cafe and Café generated different slugs.\n",
      observed: { slug: "caf-menu" },
      expected: { slug: "cafe-menu" },
      acceptance: ["ASCII titles slugify", "accented titles transliterate"],
      wrongSource: `export function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
`,
      fixedSource: `export function slugify(title) {
  const ascii = title.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  return ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
`,
      proof: `import assert from "node:assert/strict";
import { slugify } from "../src/system.js";
assert.equal(slugify("Hello World"), "hello-world");
`,
      invariant: `import assert from "node:assert/strict";
import { slugify } from "../src/system.js";
assert.equal(slugify("Café Menu"), "cafe-menu");
`
    },
    {
      id: "duplicate-webhook-id",
      title: "Webhook dedupe key uses event type instead of event id",
      bugFamily: "event_deduplication",
      wrongFixAttractiveness: "high",
      capsuleAuthorMinutes: 7,
      issue: "# Event dedupe\n\nDeduplication is by event id, not event type.\n",
      trace: "# Trace\n\nA second invoice.created event was skipped because the first had the same type.\n",
      observed: { processed: false },
      expected: { processed: true },
      acceptance: ["same event id skips", "different event id with same type processes"],
      wrongSource: `export function shouldProcess(event, seen) {
  if (seen.has(event.type)) return false;
  seen.add(event.type);
  return true;
}
`,
      fixedSource: `export function shouldProcess(event, seen) {
  if (seen.has(event.id)) return false;
  seen.add(event.id);
  return true;
}
`,
      proof: `import assert from "node:assert/strict";
import { shouldProcess } from "../src/system.js";
const seen = new Set();
assert.equal(shouldProcess({ id: "evt_1", type: "invoice.created" }, seen), true);
assert.equal(shouldProcess({ id: "evt_1", type: "invoice.created" }, seen), false);
`,
      invariant: `import assert from "node:assert/strict";
import { shouldProcess } from "../src/system.js";
const seen = new Set();
assert.equal(shouldProcess({ id: "evt_1", type: "invoice.created" }, seen), true);
assert.equal(shouldProcess({ id: "evt_2", type: "invoice.created" }, seen), true);
`
    },
    {
      id: "api-version-routing",
      title: "Unknown API versions silently route to v1",
      bugFamily: "api_versioning",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 6,
      issue: "# API version routing\n\nUnknown API versions must be rejected instead of falling back to v1.\n",
      trace: "# Trace\n\nA v3 request was accepted by the v1 handler and returned the wrong schema.\n",
      observed: { handler: "v1" },
      expected: { handler: null },
      acceptance: ["known v1 works", "unknown version rejects"],
      wrongSource: `export function routeVersion(version) {
  if (version === "v2") return "v2";
  return "v1";
}
`,
      fixedSource: `export function routeVersion(version) {
  if (version === "v1" || version === "v2") return version;
  return null;
}
`,
      proof: `import assert from "node:assert/strict";
import { routeVersion } from "../src/system.js";
assert.equal(routeVersion("v1"), "v1");
`,
      invariant: `import assert from "node:assert/strict";
import { routeVersion } from "../src/system.js";
assert.equal(routeVersion("v3"), null);
`
    },
    {
      id: "refund-negative-amount",
      title: "Payment validation rejects negative refund amounts",
      bugFamily: "payment_semantics",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 7,
      issue: "# Refund amount\n\nCharges are positive, refunds are negative.\n",
      trace: "# Trace\n\nRefund events were rejected by the generic positive amount guard.\n",
      observed: { valid: false },
      expected: { valid: true },
      acceptance: ["positive charges are valid", "negative refunds are valid"],
      wrongSource: `export function validPayment(payment) {
  return payment.amountCents > 0;
}
`,
      fixedSource: `export function validPayment(payment) {
  if (payment.type === "refund") return payment.amountCents < 0;
  return payment.amountCents > 0;
}
`,
      proof: `import assert from "node:assert/strict";
import { validPayment } from "../src/system.js";
assert.equal(validPayment({ type: "charge", amountCents: 500 }), true);
`,
      invariant: `import assert from "node:assert/strict";
import { validPayment } from "../src/system.js";
assert.equal(validPayment({ type: "refund", amountCents: -500 }), true);
`
    },
    {
      id: "json-merge-patch-null",
      title: "JSON merge patch ignores null deletion",
      bugFamily: "merge_patch_semantics",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 9,
      issue: "# JSON merge patch\n\nA null patch value deletes a field.\n",
      trace: "# Trace\n\nProfile nickname stayed present after a merge patch set it to null.\n",
      observed: { nickname: "tom" },
      expected: { nickname_present: false },
      acceptance: ["normal field update works", "null deletes the target field"],
      wrongSource: `export function mergePatch(target, patch) {
  const nonNullPatch = Object.fromEntries(Object.entries(patch).filter((entry) => entry[1] !== null));
  return { ...target, ...nonNullPatch };
}
`,
      fixedSource: `export function mergePatch(target, patch) {
  const next = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}
`,
      proof: `import assert from "node:assert/strict";
import { mergePatch } from "../src/system.js";
assert.equal(mergePatch({ name: "old" }, { name: "new" }).name, "new");
`,
      invariant: `import assert from "node:assert/strict";
import { mergePatch } from "../src/system.js";
const result = mergePatch({ nickname: "tom", name: "Tom" }, { nickname: null });
assert.equal(Object.hasOwn(result, "nickname"), false);
`
    },
    {
      id: "slo-window-inclusive",
      title: "SLO window includes samples at the exclusive end",
      bugFamily: "analytics_windows",
      wrongFixAttractiveness: "medium",
      capsuleAuthorMinutes: 8,
      issue: "# SLO window\n\nAnalytics windows are start-inclusive and end-exclusive.\n",
      trace: "# Trace\n\nThe first sample of the next window was counted in the previous window.\n",
      observed: { error_count: 1 },
      expected: { error_count: 0 },
      acceptance: ["inside-window errors count", "end-boundary sample is excluded"],
      wrongSource: `export function countErrors(samples, startMs, endMs) {
  return samples.filter((sample) => sample.status >= 500 && sample.timeMs >= startMs && sample.timeMs <= endMs).length;
}
`,
      fixedSource: `export function countErrors(samples, startMs, endMs) {
  return samples.filter((sample) => sample.status >= 500 && sample.timeMs >= startMs && sample.timeMs < endMs).length;
}
`,
      proof: `import assert from "node:assert/strict";
import { countErrors } from "../src/system.js";
assert.equal(countErrors([{ timeMs: 50, status: 500 }], 0, 100), 1);
`,
      invariant: `import assert from "node:assert/strict";
import { countErrors } from "../src/system.js";
assert.equal(countErrors([{ timeMs: 100, status: 500 }], 0, 100), 0);
`
    }
  ];
}
