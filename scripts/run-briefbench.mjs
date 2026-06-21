#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "bin", "replaypack.mjs");
const proofbenchScript = path.join(root, "scripts", "run-proofbench.mjs");
const proofbenchWorkRoot = path.join(root, ".tmp", "proofbench");
const briefbenchRoot = path.join(root, ".tmp", "briefbench");
const proofbenchResultsPath = path.join(briefbenchRoot, "proofbench-results.json");
const resultsPath = path.join(root, "docs", "agentbench", "brief-results.json");

fs.rmSync(briefbenchRoot, { recursive: true, force: true });
fs.mkdirSync(briefbenchRoot, { recursive: true });

run(root, [
  process.execPath,
  proofbenchScript,
  "--results-out",
  path.relative(root, proofbenchResultsPath),
  "--work-root",
  path.relative(root, proofbenchWorkRoot)
]);

const proofbench = readJson(proofbenchResultsPath);
const caseResults = [];

for (const benchCase of proofbench.cases ?? []) {
  const wrongRoot = path.join(proofbenchWorkRoot, benchCase.id, "wrong");
  const fixedRoot = path.join(proofbenchWorkRoot, benchCase.id, "fixed");
  const briefPath = path.join(wrongRoot, "dist", "agent-brief.md");

  const briefCommand = run(wrongRoot, [
    process.execPath,
    cli,
    "brief",
    "replaypack/case.json",
    "--out",
    "dist/agent-brief.md"
  ]);
  const brief = fs.readFileSync(briefPath, "utf8");
  const briefChecks = checkBrief(brief, benchCase);
  const wrongProof = run(wrongRoot, ["npm", "run", "proof"]);
  const wrongReplayPack = run(
    wrongRoot,
    [
      process.execPath,
      cli,
      "verify",
      "replaypack/case.json",
      "--out",
      "dist/briefbench-wrong-verify.json"
    ],
    { allowFailure: true }
  );
  const fixedReplayPack = run(fixedRoot, [
    process.execPath,
    cli,
    "verify",
    "replaypack/case.json",
    "--out",
    "dist/briefbench-fixed-verify.json"
  ]);

  caseResults.push({
    id: benchCase.id,
    title: benchCase.title,
    bug_family: benchCase.bug_family,
    brief: {
      path: path.relative(root, briefPath),
      sha256: sha256(fs.readFileSync(briefPath)),
      bytes: Buffer.byteLength(brief),
      command_status: statusOf(briefCommand),
      checks: briefChecks,
      status: Object.values(briefChecks).every(Boolean) && statusOf(briefCommand) === "pass" ? "complete" : "incomplete"
    },
    baseline_visible_only_agent: statusOf(wrongProof) === "pass" ? "false_done" : "not_false_done",
    brief_agent_first_attempt: statusOf(wrongReplayPack) === "fail" ? "rejected_wrong_fix" : "not_rejected",
    brief_agent_recovery: statusOf(fixedReplayPack) === "pass" ? "accepted_correct_fix" : "not_recovered",
    proofbench_receipt: {
      visible_proof_on_wrong: benchCase.visible_proof_on_wrong,
      replaypack_on_wrong: benchCase.replaypack_on_wrong,
      replaypack_on_fixed: benchCase.replaypack_on_fixed
    }
  });
}

const summary = summarize(caseResults);
const results = {
  schema: "replaypack.agentbench.brief_results.v0",
  generated_at: new Date().toISOString(),
  evidence_level: "deterministic_agent_brief_handoff",
  methodology: {
    source: "scripts/run-proofbench.mjs temporary cases",
    baseline_agent:
      "Visible-only agent stops when the visible proof passes, which accepts the plausible wrong fix in each ProofBench case.",
    replaypack_brief_agent:
      "ReplayPack brief agent receives the generated markdown handoff, treats replaypack verify as the finish gate, rejects the wrong fix, and recovers to the corresponding correct fix.",
    limitation:
      "This validates the generated agent handoff surface with deterministic executable cases. It is not an external human trial or a live LLM transcript."
  },
  summary,
  cases: caseResults
};

fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

if (!meetsLaunchBar(summary)) {
  process.exit(1);
}

function checkBrief(brief, benchCase) {
  return {
    has_heading: brief.includes("# ReplayPack Agent Brief"),
    has_title: brief.includes(benchCase.title),
    has_finish_gate: brief.includes("## Finish Gate"),
    has_verify_command: brief.includes("npx replaypack verify replaypack/case.json --out dist/replaypack-verify.json"),
    has_visible_proof_command: brief.includes("Visible proof: `npm run proof`"),
    has_invariant_command: brief.includes("- `npm run invariant`"),
    has_primary_file: brief.includes("src/system.js"),
    has_proof_file: brief.includes("test/proof.mjs"),
    has_issue_context: brief.includes("issues/issue.md") && brief.includes("## Issue Context"),
    has_trace_context: brief.includes("fixtures/trace/repro.md") && brief.includes("## Trace Context"),
    has_acceptance: brief.includes("## Acceptance"),
    has_agent_instructions: brief.includes("## Agent Instructions"),
    has_agent_loop: brief.includes("## Agent Loop"),
    no_missing_reference_marker: !brief.includes("(missing)") && !brief.includes("_Missing file._"),
    no_absolute_path_leak: !brief.includes(root) && !brief.includes("/Users/")
  };
}

function summarize(results) {
  const caseCount = results.length;
  const familyCount = new Set(results.map((item) => item.bug_family)).size;
  const completeBriefs = results.filter((item) => item.brief.status === "complete").length;
  const finishGates = results.filter((item) => item.brief.checks.has_finish_gate && item.brief.checks.has_verify_command).length;
  const falseDone = results.filter((item) => item.baseline_visible_only_agent === "false_done").length;
  const rejectedWrong = results.filter((item) => item.brief_agent_first_attempt === "rejected_wrong_fix").length;
  const recovered = results.filter((item) => item.brief_agent_recovery === "accepted_correct_fix").length;
  const missingReferenceMarkers = results.filter((item) => !item.brief.checks.no_missing_reference_marker).length;
  const absolutePathLeaks = results.filter((item) => !item.brief.checks.no_absolute_path_leak).length;
  const byteSizes = results.map((item) => item.brief.bytes).sort((left, right) => left - right);

  return {
    case_count: caseCount,
    bug_family_count: familyCount,
    generated_briefs: results.filter((item) => item.brief.command_status === "pass").length,
    complete_briefs: completeBriefs,
    finish_gate_present: finishGates,
    visible_only_false_done: falseDone,
    brief_gate_rejected_wrong_fix: rejectedWrong,
    brief_gate_recovered_to_correct_fix: recovered,
    missing_reference_markers: missingReferenceMarkers,
    absolute_path_leaks: absolutePathLeaks,
    median_brief_bytes: byteSizes[Math.floor(byteSizes.length / 2)] ?? null,
    max_brief_bytes: byteSizes.at(-1) ?? null,
    brief_completion_rate: ratio(completeBriefs, caseCount),
    false_done_reduction_rate: ratio(rejectedWrong, falseDone),
    recovery_rate: ratio(recovered, caseCount)
  };
}

function meetsLaunchBar(summary) {
  const falseDone = summary.visible_only_false_done ?? 0;
  const caseCount = summary.case_count ?? 0;
  return (
    caseCount >= 30 &&
    (summary.bug_family_count ?? 0) >= 20 &&
    summary.generated_briefs === caseCount &&
    summary.complete_briefs === caseCount &&
    summary.finish_gate_present === caseCount &&
    summary.missing_reference_markers === 0 &&
    summary.absolute_path_leaks === 0 &&
    falseDone >= 20 &&
    (summary.brief_gate_rejected_wrong_fix ?? 0) >= Math.ceil(falseDone * 0.9) &&
    (summary.brief_gate_recovered_to_correct_fix ?? 0) >= Math.ceil(caseCount * 0.9)
  );
}

function run(cwd, args, options = {}) {
  const [command, ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  const status = result.status === 0 ? "pass" : "fail";

  if (status === "fail" && !options.allowFailure) {
    console.error(`${args.join(" ")} failed with exit ${result.status ?? "null"}`);
    printTail("stdout", result.stdout);
    printTail("stderr", result.stderr);
    process.exit(result.status ?? 1);
  }

  return {
    status,
    exit_code: result.status,
    stdout_tail: tail(result.stdout ?? "", 1000),
    stderr_tail: tail(result.stderr ?? "", 1000)
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function statusOf(result) {
  return result.status;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(3));
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function printTail(label, text) {
  const value = text ?? "";
  if (!value.trim()) return;
  console.error(`${label}:`);
  console.error(value.length > 2000 ? value.slice(value.length - 2000) : value);
}
