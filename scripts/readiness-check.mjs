#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requiredFiles = [
  "README.md",
  "SECURITY.md",
  "action.yml",
  "docs/holy-fuck-scorecard.md",
  "docs/proofbench/README.md",
  "docs/market-proof.md",
  "examples/account-access/README.md"
];

const missing = requiredFiles.filter((filePath) => !fs.existsSync(path.join(root, filePath)));
const resultsPath = path.join(root, "docs/proofbench/results.json");
const validationFiles = {
  private_github_ci: "docs/validation/private-github-ci.json",
  real_repo_dogfood: "docs/validation/real-repo-dogfood.json",
  external_user_proof: "docs/validation/external-user-proof.json"
};
const result = {
  status: "not_launch_ready",
  missing,
  gates: {
    required_files: missing.length === 0 ? "pass" : "fail",
    proofbench_results: fs.existsSync(resultsPath) ? "present" : "missing",
    private_github_ci: exists(validationFiles.private_github_ci) ? "present" : "missing",
    real_repo_dogfood: exists(validationFiles.real_repo_dogfood) ? "present" : "missing",
    external_user_proof: exists(validationFiles.external_user_proof) ? "present" : "missing"
  },
  next_required: []
};

if (fs.existsSync(resultsPath)) {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const summary = results.summary ?? {};
  result.proofbench_summary = summary;
  result.gates.proofbench_minimum = proofbenchMeetsLaunchBar(summary) ? "pass" : "fail";
} else {
  result.gates.proofbench_minimum = "fail";
}

if (!fs.existsSync(resultsPath) || result.gates.proofbench_minimum === "fail") {
  result.next_required.push("create docs/proofbench/results.json with at least 10 passing cases");
}
if (!exists(validationFiles.private_github_ci)) {
  result.next_required.push("run private GitHub CI from the clean repo");
}
if (!exists(validationFiles.real_repo_dogfood)) {
  result.next_required.push("dogfood on one real repo issue");
}
if (!exists(validationFiles.external_user_proof)) {
  result.next_required.push("run one external developer trial");
}

console.log(JSON.stringify(result, null, 2));

const validationMissing = Object.values(validationFiles).some((filePath) => !exists(filePath));

if (
  missing.length > 0 ||
  !fs.existsSync(resultsPath) ||
  result.gates.proofbench_minimum === "fail" ||
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
    caseCount >= 10 &&
    (summary.bug_family_count ?? 0) >= 5 &&
    visibleGreenWrong >= 5 &&
    (summary.replaypack_rejected_visible_green_wrong_fixes ?? 0) >= Math.ceil(visibleGreenWrong * 0.8) &&
    (summary.replaypack_accepted_correct_fixes ?? 0) >= Math.ceil(caseCount * 0.9) &&
    (summary.false_positive_count ?? Number.POSITIVE_INFINITY) < Math.ceil(caseCount * 0.1) &&
    (summary.median_capsule_author_minutes ?? Number.POSITIVE_INFINITY) <= 15
  );
}
