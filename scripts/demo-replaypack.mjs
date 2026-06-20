#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "bin", "replaypack.mjs");
const workRoot = path.join(root, ".tmp", "demo");
const wrongRoot = path.join(root, "examples", "account-access", "wrong");
const fixedRoot = path.join(root, "examples", "account-access", "fixed");
const proofbenchPath = path.join(root, "docs", "proofbench", "results.json");

fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(workRoot, { recursive: true });

const wrong = verifyVariant(wrongRoot, path.join(workRoot, "wrong-verify.json"));
const fixed = verifyVariant(fixedRoot, path.join(workRoot, "fixed-verify.json"));
const proofbench = fs.existsSync(proofbenchPath) ? JSON.parse(fs.readFileSync(proofbenchPath, "utf8")) : null;

const wrongInvariant = wrong.report.invariants?.[0] ?? {};
const fixedInvariant = fixed.report.invariants?.[0] ?? {};
const passed =
  wrong.exitCode !== 0 &&
  wrong.report.status === "fail" &&
  wrong.report.proof?.status === "ok" &&
  wrongInvariant.status !== "ok" &&
  fixed.exitCode === 0 &&
  fixed.report.status === "pass" &&
  fixed.report.proof?.status === "ok" &&
  fixedInvariant.status === "ok";

console.log(`ReplayPack 60-second demo

Case: account-scoped export access

1. Plausible wrong agent fix
   visible proof: ${wrong.report.proof?.status ?? "missing"}
   invariant: ${wrongInvariant.status ?? "missing"}
   ReplayPack: rejected
   caught: role_source stayed "user" instead of "account_membership"

2. Correct fix
   visible proof: ${fixed.report.proof?.status ?? "missing"}
   invariant: ${fixedInvariant.status ?? "missing"}
   ReplayPack: accepted
`);

if (proofbench?.summary) {
  const summary = proofbench.summary;
  console.log(`ProofBench receipt
   cases: ${summary.case_count}
   bug families: ${summary.bug_family_count}
   visible-green wrong fixes rejected: ${summary.replaypack_rejected_visible_green_wrong_fixes}/${summary.visible_green_wrong_fixes}
   correct fixes accepted: ${summary.replaypack_accepted_correct_fixes}/${summary.case_count}
   false positives: ${summary.false_positive_count}
`);
}

if (!passed) {
  console.error("Demo failed: expected the wrong variant to be rejected and the fixed variant to pass.");
  console.error("Wrong verify stdout tail:");
  console.error(tail(wrong.stdout, 1200));
  console.error("Wrong verify stderr tail:");
  console.error(tail(wrong.stderr, 1200));
  console.error("Fixed verify stdout tail:");
  console.error(tail(fixed.stdout, 1200));
  console.error("Fixed verify stderr tail:");
  console.error(tail(fixed.stderr, 1200));
  process.exit(1);
}

function verifyVariant(variantRoot, outPath) {
  const result = spawnSync(
    process.execPath,
    [cli, "verify", "--root", variantRoot, "replaypack/account-access.json", "--out", outPath],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" }
    }
  );

  if (!fs.existsSync(outPath)) {
    console.error(`Missing verification packet: ${outPath}`);
    console.error(tail(result.stdout ?? "", 1200));
    console.error(tail(result.stderr ?? "", 1200));
    process.exit(1);
  }

  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    report: JSON.parse(fs.readFileSync(outPath, "utf8"))
  };
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}
