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
const packageJson = readJson("package.json");
const validationFiles = {
  private_github_ci: "docs/validation/private-github-ci.json",
  real_repo_dogfood: "docs/validation/real-repo-dogfood.json",
  public_repo_private_trials: "docs/validation/public-repo-private-trials.json",
  public_github_beta: "docs/validation/public-github-beta.json",
  packed_package_trial: "docs/validation/private-packed-package-trial.json",
  npm_publish: `docs/validation/npm-publish-v${packageJson.version}.json`,
  full_agent_proof: "docs/validation/full-agent-proof.json",
  cross_agent_full_proof: "docs/validation/claude-code-full-agent-proof.json",
  live_agent_proof: "docs/validation/live-agent-proof.json",
  cross_agent_recovery_proof: "docs/validation/claude-code-agent-proof.json",
  external_user_proof: "docs/validation/external-user-proof.json"
};
const validationChecks = {
  private_github_ci: {
    nextRequired: "run private GitHub CI from the clean repo",
    validate: validatePrivateGithubCi
  },
  real_repo_dogfood: {
    nextRequired: "dogfood on one real repo issue",
    validate: validateRealRepoDogfood
  },
  public_repo_private_trials: {
    optional: true,
    validate: validatePublicRepoPrivateTrials
  },
  public_github_beta: {
    optional: true,
    validate: validatePublicGithubBeta
  },
  packed_package_trial: {
    optional: true,
    validate: validatePackedPackageTrial
  },
  npm_publish: {
    optional: true,
    validate: validateNpmPublish
  },
  full_agent_proof: {
    nextRequired: "run one live full-generation AgentBench trial",
    validate: (data) => validateFullAgentProof(data, { nonCodex: false })
  },
  cross_agent_full_proof: {
    nextRequired: "run one non-Codex full-generation AgentBench trial",
    validate: (data) => validateFullAgentProof(data, { nonCodex: true })
  },
  live_agent_proof: {
    nextRequired: "run one live coding-agent AgentBench trial",
    validate: (data) => validateLiveAgentProof(data, { nonCodex: false })
  },
  cross_agent_recovery_proof: {
    nextRequired: "run one non-Codex AgentBench recovery trial",
    validate: (data) => validateLiveAgentProof(data, { nonCodex: true })
  },
  external_user_proof: {
    nextRequired: "run one external developer trial",
    validate: validateExternalUserProof
  }
};
const result = {
  status: "not_launch_ready",
  missing,
  gates: {
    required_files: missing.length === 0 ? "pass" : "fail",
    proofbench_results: fs.existsSync(proofbenchResultsPath) ? "present" : "missing",
    agentbench_results: fs.existsSync(agentbenchResultsPath) ? "present" : "missing"
  },
  validation_errors: [],
  next_required: []
};

for (const [key, check] of Object.entries(validationChecks)) {
  result.gates[key] = validationGate(key, check);
}

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
for (const [key, check] of Object.entries(validationChecks)) {
  const gate = result.gates[key];
  if (!check.optional && (gate === "missing" || gate === "invalid")) {
    result.next_required.push(check.nextRequired);
  }
  if (check.optional && gate === "invalid_optional") {
    result.next_required.push(`fix optional evidence receipt: ${key}`);
  }
}

const validationFailure = Object.entries(validationChecks).some(([key, check]) => {
  const gate = result.gates[key];
  return check.optional ? gate === "invalid_optional" : gate === "missing" || gate === "invalid";
});

const launchFailure =
  missing.length > 0 ||
  !fs.existsSync(proofbenchResultsPath) ||
  !fs.existsSync(agentbenchResultsPath) ||
  result.gates.proofbench_minimum === "fail" ||
  result.gates.agentbench_minimum === "fail" ||
  validationFailure;

if (!launchFailure) {
  result.status = "launch_ready";
}

console.log(JSON.stringify(result, null, 2));

if (launchFailure) {
  process.exit(1);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function validationGate(key, check) {
  const relativePath = validationFiles[key];
  if (!exists(relativePath)) {
    return check.optional ? "missing_optional" : "missing";
  }

  try {
    const errors = check.validate(readJson(relativePath));
    if (errors.length > 0) {
      result.validation_errors.push(...errors.map((error) => `${key}: ${error}`));
      return check.optional ? "invalid_optional" : "invalid";
    }
    return check.optional ? "pass_optional" : "pass";
  } catch (error) {
    result.validation_errors.push(`${key}: ${error.message}`);
    return check.optional ? "invalid_optional" : "invalid";
  }
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

function validatePrivateGithubCi(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.private_github_ci.v0", errors, "schema must be private_github_ci.v0");
  expect(data.conclusion === "success", errors, "conclusion must be success");
  expect(Boolean(data.run_url), errors, "run_url is required");
  expect(Array.isArray(data.validated_steps) && data.validated_steps.length >= 3, errors, "validated_steps must list hosted checks");
  return errors;
}

function validateRealRepoDogfood(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.real_repo_dogfood.v0", errors, "schema must be real_repo_dogfood.v0");
  expect(data.status === "pass", errors, "status must be pass");
  expect(Boolean(data.issue), errors, "issue is required");
  expect(exists(data.capsule), errors, "capsule must exist");
  expect(data.proof?.status === "ok", errors, "proof status must be ok");
  expect(
    Array.isArray(data.invariants) && data.invariants.length > 0 && data.invariants.every((item) => item.status === "ok"),
    errors,
    "all invariants must be ok"
  );
  return errors;
}

function validatePublicRepoPrivateTrials(data) {
  const errors = [];
  const summary = data.summary ?? {};
  expect(data.schema === "replaypack.validation.public_repo_private_trials.v0", errors, "schema must be public_repo_private_trials.v0");
  expect(summary.attempted >= 1, errors, "at least one public repo trial is required");
  expect(summary.failed === 0, errors, "failed public repo trials must be zero");
  expect(summary.passed === summary.attempted, errors, "all attempted public repo trials must pass");
  expect(Array.isArray(data.repositories) && data.repositories.length === summary.attempted, errors, "repository receipts must match attempted count");
  expect(data.repositories?.every((repo) => repo.status === "pass"), errors, "every repository receipt must pass");
  return errors;
}

function validatePublicGithubBeta(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.public_github_beta.v0", errors, "schema must be public_github_beta.v0");
  expect(data.visibility === "PUBLIC", errors, "repository visibility must be PUBLIC");
  expect(data.beta_issue?.state === "OPEN", errors, "beta issue must be OPEN");
  expect(Boolean(data.url), errors, "public repository URL is required");
  return errors;
}

function validatePackedPackageTrial(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.private_packed_package_trial.v0", errors, "schema must be private_packed_package_trial.v0");
  expect(data.package?.name === packageJson.name, errors, "package name must match package.json");
  expect(data.package?.version === packageJson.version, errors, "package version must match package.json");
  expect(
    data.commands?.some((item) => item.command === "npm run package-trial" && item.actual === "exit 0"),
    errors,
    "npm run package-trial must be recorded as exit 0"
  );
  expect(
    data.commands?.some((item) => item.command === "replaypack --version" && item.actual === packageJson.version),
    errors,
    "installed replaypack version must match package.json"
  );
  expect(
    data.commands?.some((item) => item.command === "replaypack trial" && item.actual === "pass"),
    errors,
    "installed replaypack trial must be recorded as pass"
  );
  expect(data.trial_summary?.wrong_demo?.proof === "ok", errors, "wrong demo visible proof must be ok");
  expect(data.trial_summary?.wrong_demo?.replaypack === "fail", errors, "wrong demo must fail ReplayPack");
  expect(data.trial_summary?.fixed_demo?.replaypack === "pass", errors, "fixed demo must pass ReplayPack");
  expect(data.trial_summary?.dogfood?.replaypack === "pass", errors, "dogfood must pass ReplayPack");
  return errors;
}

function validateNpmPublish(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.npm_publish.v0", errors, "schema must be npm_publish.v0");
  expect(data.published === true, errors, "published must be true");
  expect(data.package === packageJson.name, errors, "published package must match package.json");
  expect(data.version === packageJson.version, errors, "published version must match package.json");
  expect(data.npm?.dist_tag_latest === packageJson.version, errors, "npm latest tag must match package.json");
  expect(Boolean(data.npm?.tarball), errors, "npm tarball URL is required");
  return errors;
}

function validateFullAgentProof(data, { nonCodex }) {
  const errors = [];
  const summary = data.results ?? {};
  const caseCount = summary.case_count ?? 0;
  expect(data.schema === "replaypack.validation.full_agent_proof.v0", errors, "schema must be full_agent_proof.v0");
  expect(data.status === "complete", errors, "status must be complete");
  expect(caseCount > 0, errors, "case_count must be greater than zero");
  expect(data.case_sample?.case_count === caseCount, errors, "case_sample count must match results count");
  expect(Array.isArray(data.cases) && data.cases.length === caseCount, errors, "case receipts must match case_count");
  expect(summary.replaypack_verified_correct === caseCount, errors, "ReplayPack treatments must all verify correct");
  expect(summary.replaypack_failed === 0, errors, "ReplayPack failures must be zero");
  expect(summary.control_protocol_violations === 0, errors, "control protocol violations must be zero");
  expect(summary.replaypack_protocol_violations === 0, errors, "ReplayPack protocol violations must be zero");
  expect(summary.manual_intervention_count === 0, errors, "manual intervention must be zero");
  expect(summary.false_done_lift_cases > 0, errors, "at least one false-done control must be lifted");
  expect(
    data.cases?.every((item) => exists(item.control?.transcript) && exists(item.treatment?.transcript)),
    errors,
    "every case must have control and treatment transcripts"
  );
  if (nonCodex) {
    expect(Boolean(data.agent_surface) && data.agent_surface !== "codex_subagents", errors, "agent surface must be non-Codex");
  }
  return errors;
}

function validateLiveAgentProof(data, { nonCodex }) {
  const errors = [];
  const summary = data.results ?? {};
  const caseCount = summary.case_count ?? 0;
  expect(data.schema === "replaypack.validation.live_agent_proof.v0", errors, "schema must be live_agent_proof.v0");
  expect(data.status === "complete", errors, "status must be complete");
  expect(caseCount > 0, errors, "case_count must be greater than zero");
  expect(data.case_sample?.case_count === caseCount, errors, "case_sample count must match results count");
  expect(Array.isArray(data.cases) && data.cases.length === caseCount, errors, "case receipts must match case_count");
  expect(summary.visible_only_false_done > 0, errors, "visible-only controls must include false-done outcomes");
  expect(summary.replaypack_recovered_to_correct_fix === caseCount, errors, "ReplayPack treatments must all recover");
  expect(summary.manual_intervention_count === 0, errors, "manual intervention must be zero");
  expect((summary.control_protocol_violations ?? 0) === 0, errors, "control protocol violations must be zero");
  expect((summary.replaypack_protocol_violations ?? 0) === 0, errors, "ReplayPack protocol violations must be zero");
  expect(
    data.cases?.every((item) => exists(item.control?.transcript) && exists(item.treatment?.transcript)),
    errors,
    "every case must have control and treatment transcripts"
  );
  if (nonCodex) {
    expect(Boolean(data.agent_surface) && data.agent_surface !== "codex_subagents", errors, "agent surface must be non-Codex");
  }
  return errors;
}

function validateExternalUserProof(data) {
  const errors = [];
  expect(data.schema === "replaypack.validation.external_user_proof.v0", errors, "schema must be external_user_proof.v0");
  expect(data.verdict === "pass", errors, "verdict must be pass");
  expect(Boolean(data.source?.url || data.source?.file), errors, "source issue URL or file is required");
  expect(Boolean(data.trial_runner?.relationship), errors, "trial runner relationship is required");
  expect(data.trial_receipt?.referenced === true, errors, "trial receipt must be referenced");
  expect(Array.isArray(data.commands_run) && data.commands_run.length >= 3, errors, "commands_run must include trial commands");
  expect(data.commands_run?.every((item) => Boolean(item.command) && Boolean(item.status)), errors, "every command needs status");
  expect(
    data.commands_run?.some((item) => isTrialCommand(item.command) && item.status === "pass"),
    errors,
    "trial command must be recorded as pass"
  );
  expect(Boolean(data.comprehension?.one_minute_explanation), errors, "one-minute explanation is required");
  expect(data.comprehension?.understood_not_just_tests === true, errors, "developer must understand why this is not just tests");
  expect(Array.isArray(data.objections) && data.objections.some(Boolean), errors, "at least one objection is required");
  return errors;
}

function expect(condition, errors, message) {
  if (!condition) {
    errors.push(message);
  }
}

function isTrialCommand(command) {
  return command.includes("trial:external") || /replaypack(\.mjs)?\s+trial/.test(command);
}
