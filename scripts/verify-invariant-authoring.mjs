#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const options = parseArgs(process.argv.slice(2));
const workRootRel = ".tmp/invariant-authoring-demo";
const workRoot = path.join(root, workRootRel);
const outPath = path.join(root, options.out ?? ".tmp/invariant-authoring-receipt.json");

fs.rmSync(workRoot, { recursive: true, force: true });
writeFixture(workRoot, wrongSource());

const cookbookPath = path.join(root, "docs/invariant-cookbook.md");
const tutorialPath = path.join(root, "docs/tutorials/first-capsule.md");
const cookbook = fs.readFileSync(cookbookPath, "utf8");
const tutorial = fs.readFileSync(tutorialPath, "utf8");

const proofBefore = run("npm", ["run", "proof"], {
  cwd: workRoot,
  label: "tutorial visible proof",
  expectedExit: 0
});
const invariantBefore = run("npm", ["run", "invariant"], {
  cwd: workRoot,
  label: "tutorial invariant before fix",
  expectedExit: "nonzero"
});

const capture = run(
  process.execPath,
  [
    "bin/replaypack.mjs",
    "capture",
    "--root",
    workRootRel,
    "--id",
    "account-scoped-idempotency",
    "--title",
    "Scope idempotency keys by account",
    "--primary-file",
    "src/idempotency.js",
    "--proof-file",
    "test/proof.mjs",
    "--trace",
    "fixtures/trace/repro.md",
    "--issue-file",
    "issues/idempotency.md",
    "--proof-command",
    "npm run proof",
    "--invariant-command",
    "npm run invariant",
    "--out",
    "replaypack/idempotency.json",
    "--packet",
    "dist/capture.json"
  ],
  {
    cwd: root,
    label: "replaypack capture tutorial capsule",
    expectedExit: 0
  }
);

const brief = run(
  process.execPath,
  [
    "bin/replaypack.mjs",
    "brief",
    "--root",
    workRootRel,
    "replaypack/idempotency.json",
    "--out",
    "dist/agent-brief.md"
  ],
  {
    cwd: root,
    label: "replaypack brief tutorial capsule",
    expectedExit: 0
  }
);

const verifyBefore = run(
  process.execPath,
  [
    "bin/replaypack.mjs",
    "verify",
    "--root",
    workRootRel,
    "replaypack/idempotency.json",
    "--out",
    "dist/replaypack-before.json"
  ],
  {
    cwd: root,
    label: "replaypack verify tutorial before fix",
    expectedExit: "nonzero"
  }
);

fs.writeFileSync(path.join(workRoot, "src/idempotency.js"), fixedSource());

const verifyAfter = run(
  process.execPath,
  [
    "bin/replaypack.mjs",
    "verify",
    "--root",
    workRootRel,
    "replaypack/idempotency.json",
    "--out",
    "dist/replaypack-after.json"
  ],
  {
    cwd: root,
    label: "replaypack verify tutorial after fix",
    expectedExit: 0
  }
);

const capturePacket = readJson(path.join(workRoot, "dist/capture.json"));
const beforePacket = readJson(path.join(workRoot, "dist/replaypack-before.json"));
const afterPacket = readJson(path.join(workRoot, "dist/replaypack-after.json"));
const agentBrief = fs.readFileSync(path.join(workRoot, "dist/agent-brief.md"), "utf8");

const patterns = [
  ["authorization_scope", "## Pattern: Authorization Scope"],
  ["idempotent_jobs", "## Pattern: Idempotent Jobs"],
  ["money_and_totals", "## Pattern: Money And Totals"],
  ["webhook_integrity", "## Pattern: Webhook Integrity"]
].map(([id, marker]) => ({ id, present: cookbook.includes(marker) }));

const tutorialChecks = {
  contains_capture_command: tutorial.includes("node bin/replaypack.mjs capture"),
  contains_brief_command: tutorial.includes("node bin/replaypack.mjs brief"),
  contains_verify_command: tutorial.includes("node bin/replaypack.mjs verify"),
  contains_visible_proof_passes: tutorial.includes("The visible proof passes"),
  contains_invariant_fails: tutorial.includes("The invariant fails"),
  contains_root_out_note: tutorial.includes(".tmp/first-capsule-demo/dist/agent-brief.md")
};

const demo = {
  visible_proof_status: proofBefore.status === 0 ? "ok" : "nonzero",
  invariant_before_status: invariantBefore.status === 0 ? "ok" : "nonzero",
  capture_status: capturePacket.status,
  capture_proof_status: capturePacket.proof.status,
  capture_invariant_precheck_status: capturePacket.invariant_prechecks?.[0]?.status ?? null,
  brief_has_finish_gate: agentBrief.includes("## Finish Gate"),
  brief_has_invariant_command: agentBrief.includes("- `npm run invariant`"),
  brief_prints_caller_visible_path: brief.stdout_tail.includes(`${workRootRel}/dist/agent-brief.md`),
  verify_before_status: beforePacket.status,
  verify_before_proof_status: beforePacket.proof.status,
  verify_before_invariant_status: beforePacket.invariants?.[0]?.status ?? null,
  verify_after_status: afterPacket.status,
  verify_after_proof_status: afterPacket.proof.status,
  verify_after_invariant_status: afterPacket.invariants?.[0]?.status ?? null
};

const receipt = {
  schema: "replaypack.validation.invariant_authoring_docs.v0",
  checked_at: new Date().toISOString(),
  docs: {
    cookbook: "docs/invariant-cookbook.md",
    first_capsule_tutorial: "docs/tutorials/first-capsule.md"
  },
  pattern_count: patterns.length,
  patterns,
  tutorial_checks: tutorialChecks,
  demo,
  commands: [
    { command: "npm run proof", exit_code: proofBefore.status },
    { command: "npm run invariant", exit_code: invariantBefore.status },
    { command: "replaypack capture", exit_code: capture.status },
    { command: "replaypack brief", exit_code: brief.status },
    { command: "replaypack verify before fix", exit_code: verifyBefore.status },
    { command: "replaypack verify after fix", exit_code: verifyAfter.status }
  ],
  limitations: [
    "This proves the first-capsule tutorial path is executable in a generated fixture.",
    "This is not external developer comprehension or demand proof."
  ]
};

validate(receipt);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`);

console.log(`ReplayPack invariant authoring docs: pass

Receipt:
  ${path.relative(root, outPath)}

Verified:
  cookbook patterns -> ${patterns.length}
  tutorial capture -> ${receipt.demo.capture_status}
  verify before fix -> ${receipt.demo.verify_before_status}
  verify after fix -> ${receipt.demo.verify_after_status}
`);

function validate(receipt) {
  const errors = [];
  expect(receipt.patterns.every((item) => item.present), errors, "all cookbook pattern sections must be present");
  expect(
    Object.values(receipt.tutorial_checks).every(Boolean),
    errors,
    "first-capsule tutorial must contain capture, brief, verify, proof, and invariant guidance"
  );
  expect(receipt.demo.visible_proof_status === "ok", errors, "tutorial visible proof must pass before the fix");
  expect(receipt.demo.invariant_before_status === "nonzero", errors, "tutorial invariant must fail before the fix");
  expect(receipt.demo.capture_status === "captured", errors, "tutorial capsule must capture");
  expect(receipt.demo.capture_proof_status === "ok", errors, "capture proof precheck must be ok");
  expect(
    receipt.demo.capture_invariant_precheck_status === "nonzero",
    errors,
    "capture invariant precheck must show the contract gap"
  );
  expect(receipt.demo.brief_has_finish_gate, errors, "agent brief must include finish gate");
  expect(receipt.demo.brief_has_invariant_command, errors, "agent brief must include invariant command");
  expect(receipt.demo.brief_prints_caller_visible_path, errors, "brief output must print the caller-visible path");
  expect(receipt.demo.verify_before_status === "fail", errors, "ReplayPack verify must fail before the fix");
  expect(receipt.demo.verify_before_proof_status === "ok", errors, "before-fix proof must be ok");
  expect(
    receipt.demo.verify_before_invariant_status === "nonzero",
    errors,
    "before-fix invariant must be nonzero"
  );
  expect(receipt.demo.verify_after_status === "pass", errors, "ReplayPack verify must pass after the fix");
  expect(receipt.demo.verify_after_proof_status === "ok", errors, "after-fix proof must be ok");
  expect(receipt.demo.verify_after_invariant_status === "ok", errors, "after-fix invariant must be ok");

  if (errors.length > 0) {
    console.error("ReplayPack invariant authoring docs: fail");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

function writeFixture(base, source) {
  fs.mkdirSync(path.join(base, "src"), { recursive: true });
  fs.mkdirSync(path.join(base, "test"), { recursive: true });
  fs.mkdirSync(path.join(base, "issues"), { recursive: true });
  fs.mkdirSync(path.join(base, "fixtures/trace"), { recursive: true });
  fs.mkdirSync(path.join(base, "replaypack"), { recursive: true });

  fs.writeFileSync(
    path.join(base, "package.json"),
    `${JSON.stringify(
      {
        type: "module",
        scripts: {
          proof: "node test/proof.mjs",
          invariant: "node test/invariant.mjs"
        }
      },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(path.join(base, "src/idempotency.js"), source);
  fs.writeFileSync(
    path.join(base, "test/proof.mjs"),
    `import assert from "node:assert/strict";
import { shouldProcess } from "../src/idempotency.js";

const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), false);
`
  );
  fs.writeFileSync(
    path.join(base, "test/invariant.mjs"),
    `import assert from "node:assert/strict";
import { shouldProcess } from "../src/idempotency.js";

const seen = new Set();
assert.equal(shouldProcess({ accountId: "acct_a", key: "evt_1", seen }), true);
assert.equal(shouldProcess({ accountId: "acct_b", key: "evt_1", seen }), true);
`
  );
  fs.writeFileSync(
    path.join(base, "issues/idempotency.md"),
    `# Scope idempotency keys by account

Duplicate webhook retries must be skipped within the same account.
The same provider event key can appear in another account and must still process there.
`
  );
  fs.writeFileSync(
    path.join(base, "fixtures/trace/repro.md"),
    `# Repro

1. Webhook event evt_1 arrives for acct_a.
2. Retry evt_1 arrives for acct_a; skip it.
3. Webhook event evt_1 arrives for acct_b; process it because dedupe is account-scoped.
`
  );
}

function wrongSource() {
  return `export function shouldProcess({ accountId, key, seen }) {
  if (!accountId || !key) return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
`;
}

function fixedSource() {
  return `export function shouldProcess({ accountId, key, seen }) {
  if (!accountId || !key) return false;
  const scopedKey = \`\${accountId}:\${key}\`;
  if (seen.has(scopedKey)) return false;
  seen.add(scopedKey);
  return true;
}
`;
}

function run(command, args, { cwd, label, expectedExit }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  const expected = expectedExit === "nonzero" ? result.status !== 0 : result.status === expectedExit;
  if (!expected) {
    console.error(`${label} failed expectation. Exit: ${result.status ?? "null"}`);
    printTail("stdout", result.stdout);
    printTail("stderr", result.stderr);
    process.exit(result.status ?? 1);
  }
  return {
    status: result.status ?? null,
    stdout_tail: tail(result.stdout ?? "", 1200),
    stderr_tail: tail(result.stderr ?? "", 1200)
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[toCamel(key)] = inlineValue;
    } else {
      parsed[toCamel(key)] = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function expect(condition, errors, message) {
  if (!condition) {
    errors.push(message);
  }
}

function printTail(label, value) {
  const text = value ?? "";
  if (!text.trim()) return;
  console.error(`${label}:`);
  console.error(tail(text, 2000));
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}
