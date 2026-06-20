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
const result = {
  status: "not_launch_ready",
  missing,
  gates: {
    required_files: missing.length === 0 ? "pass" : "fail",
    proofbench_results: fs.existsSync(resultsPath) ? "present" : "missing",
    private_github_ci: "not_checked_by_local_script",
    external_user_proof: "not_checked_by_local_script"
  },
  next_required: [
    "create docs/proofbench/results.json with at least 10 cases",
    "run private GitHub CI from the clean repo",
    "dogfood on one real repo issue",
    "run one external developer trial"
  ]
};

if (fs.existsSync(resultsPath)) {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  result.proofbench_summary = results.summary ?? null;
  result.gates.proofbench_minimum =
    (results.summary?.case_count ?? 0) >= 10 &&
    (results.summary?.bug_family_count ?? 0) >= 5 &&
    (results.summary?.replaypack_rejected_visible_green_wrong_fixes ?? 0) >=
      Math.ceil((results.summary?.visible_green_wrong_fixes ?? 0) * 0.8)
      ? "pass"
      : "fail";
}

console.log(JSON.stringify(result, null, 2));

if (missing.length > 0 || !fs.existsSync(resultsPath) || result.gates.proofbench_minimum === "fail") {
  process.exit(1);
}
