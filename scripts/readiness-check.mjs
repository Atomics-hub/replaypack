#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requiredFiles = [
  "README.md",
  "SECURITY.md",
  "action.yml",
  "docs/demo.md",
  "docs/agentbench/README.md",
  "docs/holy-fuck-scorecard.md",
  "docs/proofbench/README.md",
  "docs/market-proof.md",
  "examples/account-access/README.md"
];

const missing = requiredFiles.filter((filePath) => !fs.existsSync(path.join(root, filePath)));
const proofbenchResultsPath = path.join(root, "docs/proofbench/results.json");
const agentbenchResultsPath = path.join(root, "docs/agentbench/results.json");
const validationFiles = {
  private_github_ci: "docs/validation/private-github-ci.json",
  real_repo_dogfood: "docs/validation/real-repo-dogfood.json",
  public_repo_private_trials: "docs/validation/public-repo-private-trials.json",
  public_github_beta: "docs/validation/public-github-beta.json",
  npm_publish: "docs/validation/npm-publish-v0.2.0.json",
  full_agent_proof: "docs/validation/full-agent-proof.json",
  live_agent_proof: "docs/validation/live-agent-proof.json",
  external_user_proof: "docs/validation/external-user-proof.json"
};
const result = {
  status: "not_launch_ready",
  missing,
  gates: {
    required_files: missing.length === 0 ? "pass" : "fail",
    proofbench_results: fs.existsSync(proofbenchResultsPath) ? "present" : "missing",
    agentbench_results: fs.existsSync(agentbenchResultsPath) ? "present" : "missing",
    private_github_ci: exists(validationFiles.private_github_ci) ? "present" : "missing",
    real_repo_dogfood: exists(validationFiles.real_repo_dogfood) ? "present" : "missing",
    public_repo_private_trials: exists(validationFiles.public_repo_private_trials) ? "present_optional" : "missing_optional",
    public_github_beta: exists(validationFiles.public_github_beta) ? "present_optional" : "missing_optional",
    npm_publish: exists(validationFiles.npm_publish) ? "present_optional" : "missing_optional",
    full_agent_proof: exists(validationFiles.full_agent_proof) ? "present" : "missing",
    live_agent_proof: exists(validationFiles.live_agent_proof) ? "present" : "missing",
    external_user_proof: exists(validationFiles.external_user_proof) ? "present" : "missing"
  },
  next_required: []
};

if (fs.existsSync(proofbenchResultsPath)) {
  const results = JSON.parse(fs.readFileSync(proofbenchResultsPath, "utf8"));
  const summary = results.summary ?? {};
  result.proofbench_summary = summary;
  result.gates.proofbench_minimum = proofbenchMeetsLaunchBar(summary) ? "pass" : "fail";
} else {
  result.gates.proofbench_minimum = "fail";
}

if (fs.existsSync(agentbenchResultsPath)) {
  const results = JSON.parse(fs.readFileSync(agentbenchResultsPath, "utf8"));
  const summary = results.summary ?? {};
  result.agentbench_summary = summary;
  result.gates.agentbench_minimum = agentbenchMeetsLaunchBar(summary) ? "pass" : "fail";
} else {
  result.gates.agentbench_minimum = "fail";
}

if (!fs.existsSync(proofbenchResultsPath) || result.gates.proofbench_minimum === "fail") {
  result.next_required.push("create docs/proofbench/results.json with at least 30 passing cases");
}
if (!fs.existsSync(agentbenchResultsPath) || result.gates.agentbench_minimum === "fail") {
  result.next_required.push("create docs/agentbench/results.json with at least 30 agent-loop cases");
}
if (!exists(validationFiles.private_github_ci)) {
  result.next_required.push("run private GitHub CI from the clean repo");
}
if (!exists(validationFiles.real_repo_dogfood)) {
  result.next_required.push("dogfood on one real repo issue");
}
if (!exists(validationFiles.full_agent_proof)) {
  result.next_required.push("run one live full-generation AgentBench trial");
}
if (!exists(validationFiles.live_agent_proof)) {
  result.next_required.push("run one live coding-agent AgentBench trial");
}
if (!exists(validationFiles.external_user_proof)) {
  result.next_required.push("run one external developer trial");
}

console.log(JSON.stringify(result, null, 2));

const validationMissing = Object.values(validationFiles).some((filePath) => !exists(filePath));

if (
  missing.length > 0 ||
  !fs.existsSync(proofbenchResultsPath) ||
  !fs.existsSync(agentbenchResultsPath) ||
  result.gates.proofbench_minimum === "fail" ||
  result.gates.agentbench_minimum === "fail" ||
  validationMissing
) {
  process.exit(1);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function proofbenchMeetsLaunchBar(summary) {
  const caseCount = summary.case_count ?? 0;
  const visibleGreenWrong = summary.visible_green_wrong_fixes ?? 0;

  return (
    caseCount >= 30 &&
    (summary.bug_family_count ?? 0) >= 20 &&
    visibleGreenWrong >= 20 &&
    (summary.replaypack_rejected_visible_green_wrong_fixes ?? 0) >= Math.ceil(visibleGreenWrong * 0.9) &&
    (summary.replaypack_accepted_correct_fixes ?? 0) >= Math.ceil(caseCount * 0.9) &&
    (summary.false_positive_count ?? Number.POSITIVE_INFINITY) === 0 &&
    (summary.median_capsule_author_minutes ?? Number.POSITIVE_INFINITY) <= 15
  );
}

function agentbenchMeetsLaunchBar(summary) {
  const caseCount = summary.case_count ?? 0;
  const baselineFalseDone = summary.baseline_visible_only_false_done ?? 0;

  return (
    caseCount >= 30 &&
    (summary.bug_family_count ?? 0) >= 20 &&
    baselineFalseDone >= 20 &&
    (summary.replaypack_prevented_false_done ?? 0) >= Math.ceil(baselineFalseDone * 0.9) &&
    (summary.replaypack_recovered_to_correct_fix ?? 0) >= Math.ceil(caseCount * 0.9)
  );
}
