#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const baseSources = {
  "account-access": `export function canExport({ user }) {
  return { allowed: user.role === "admin", source: "user" };
}
`,
  "pagination-cursor": `export function page(items, after, limit) {
  return { rows: [], nextCursor: null };
}
`,
  "timezone-cutoff": `export function billingDay(iso, timezone) {
  return "1970-01-01";
}
`,
  "feature-flag-fallback": `export function enabled(tenantFlag, globalDefault) {
  return Boolean(globalDefault);
}
`,
  "idempotency-scope": `export function shouldProcess(event, seen) {
  return false;
}
`,
  "retry-permanent-errors": `export function shouldRetry(error) {
  return false;
}
`,
  "upload-mime-sniff": `export function acceptUpload(file) {
  return false;
}
`,
  "permission-after-fetch": `export function visibleRecord(user, record) {
  return null;
}
`,
  "webhook-signature": `export function verifyWebhook(request, secret) {
  return false;
}
`,
  "rate-limit-boundary": `export function allowed(requestTimes, now, limit, windowMs) {
  return false;
}
`,
  "currency-line-rounding": `export function subtotalCents(lines) {
  return 0;
}
`,
  "sort-stability": `export function rankUsers(users) {
  return [];
}
`,
  "soft-delete-filter": `export function visibleRecords(records) {
  return [];
}
`,
  "tenant-search-leak": `export function searchDocs(docs, tenantId, query, limit) {
  return [];
}
`,
  "csv-formula-escape": `export function csvCell(value) {
  return "";
}
`
};
const defaultCases = Object.keys(baseSources);
const options = parseArgs(process.argv.slice(2));
const cases = options.cases ?? defaultCases;
const runId = options.runId ?? `full-generation-${new Date().toISOString().slice(0, 10)}`;
const proofbenchRoot = path.join(root, ".tmp", "proofbench");
const fullRoot = path.join(root, ".tmp", "full-agentbench", runId);
const currentRunPath = path.join(root, ".tmp", "full-agentbench", "current-run.json");

const proofbench = spawnSync(process.execPath, [path.join(root, "scripts", "run-proofbench.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" }
});

if (proofbench.status !== 0) {
  console.error(proofbench.stdout);
  console.error(proofbench.stderr);
  process.exit(proofbench.status ?? 1);
}

fs.rmSync(fullRoot, { recursive: true, force: true });
fs.mkdirSync(fullRoot, { recursive: true });

const assignments = [];

for (const caseId of cases) {
  const baseSource = baseSources[caseId];
  if (!baseSource) {
    throw new Error(`No full-generation base source configured for case: ${caseId}`);
  }

  const sourceRoot = path.join(proofbenchRoot, caseId, "wrong");
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Unknown ProofBench case: ${caseId}`);
  }

  const caseRoot = path.join(fullRoot, caseId);
  const controlRoot = path.join(caseRoot, "control");
  const treatmentRoot = path.join(caseRoot, "treatment");
  fs.mkdirSync(caseRoot, { recursive: true });
  fs.cpSync(sourceRoot, controlRoot, { recursive: true });
  fs.cpSync(sourceRoot, treatmentRoot, { recursive: true });

  for (const assignmentRoot of [controlRoot, treatmentRoot]) {
    fs.writeFileSync(path.join(assignmentRoot, "src", "system.js"), baseSource);
    fs.rmSync(path.join(assignmentRoot, "dist"), { recursive: true, force: true });
  }
  fs.rmSync(path.join(controlRoot, "replaypack"), { recursive: true, force: true });
  fs.renameSync(path.join(controlRoot, "test", "invariant.mjs"), path.join(controlRoot, "test", "invariant.hidden.mjs"));
  rewriteControlPackageJson(controlRoot);
  writeTreatmentBrief(treatmentRoot);

  fs.writeFileSync(path.join(controlRoot, "agent-task.md"), controlTask(caseId));
  fs.writeFileSync(path.join(treatmentRoot, "agent-task.md"), treatmentTask(caseId));

  assignments.push({
    case_id: caseId,
    control_dir: path.relative(root, controlRoot),
    treatment_dir: path.relative(root, treatmentRoot),
    control_task: path.relative(root, path.join(controlRoot, "agent-task.md")),
    treatment_task: path.relative(root, path.join(treatmentRoot, "agent-task.md")),
    treatment_brief: path.relative(root, path.join(treatmentRoot, "dist", "agent-brief.md"))
  });
}

const run = {
  schema: "replaypack.full_agentbench.run.v0",
  run_id: runId,
  generated_at: new Date().toISOString(),
  agent_surface: options.agentSurface ?? "codex_subagents",
  model: options.model ?? "inherited Codex subagents",
  evidence_level: "live_agent_full_generation_trial",
  limitation:
    "Starts from deliberately broken minimal implementations generated from ProofBench cases; it measures issue-to-proof behavior and ReplayPack finish behavior on a small sample.",
  assignments
};

fs.mkdirSync(path.dirname(currentRunPath), { recursive: true });
fs.writeFileSync(currentRunPath, `${JSON.stringify(run, null, 2)}\n`);
console.log(JSON.stringify(run, null, 2));

function rewriteControlPackageJson(controlRoot) {
  const packageJsonPath = path.join(controlRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.scripts = {
    proof: "node test/proof.mjs",
    test: "npm run proof"
  };
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function writeTreatmentBrief(treatmentRoot) {
  const result = spawnSync(process.execPath, [cliPath(), "brief", "replaypack/case.json", "--out", "dist/agent-brief.md"], {
    cwd: treatmentRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Failed to generate treatment brief in ${treatmentRoot}`);
  }
}

function cliPath() {
  return path.join(root, "bin", "replaypack.mjs");
}

function controlTask(caseId) {
  return `# Full AgentBench Control Task

Case: ${caseId}

You are a coding agent using the normal issue plus visible-proof finish policy.

Rules:

- Work only inside this assignment directory.
- Do not inspect sibling treatment directories, .tmp/proofbench, docs/proofbench, docs/agentbench, or any file outside this assignment.
- Use the local issue, trace, source file, and visible proof to fix the bug.
- Edit only src/system.js. Do not edit tests, issues, traces, package.json, or hidden invariant files.
- Validation command: npm run proof
- Do not run invariant commands.
- Do not run ReplayPack.
- When npm run proof passes, stop and write transcript.md.

Write transcript.md with:

- commands_run
- files_changed
- final_status
- short_reason
`;
}

function treatmentTask(caseId) {
  return `# Full AgentBench Treatment Task

Case: ${caseId}

You are a coding agent using the generated ReplayPack agent brief as the task contract.

Rules:

- Work only inside this assignment directory.
- Do not inspect sibling control directories, .tmp/proofbench, docs/proofbench, docs/agentbench, or any file outside this assignment except the repo-local ReplayPack CLI path used below.
- Start by reading dist/agent-brief.md. Use it as the primary issue brief and finish contract.
- Use the local ReplayPack capsule, issue, trace, source file, proof, and invariant feedback referenced by the generated brief to fix the bug.
- Edit only src/system.js unless a command output proves another local file in this assignment is broken.
- Proof command: npm run proof
- Finish gate: node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json
- If ReplayPack verify fails, use the proof/invariant failure to repair the fix and rerun verify.
- Stop after ReplayPack verify passes, or after 4 verify attempts.

Write transcript.md with:

- commands_run
- agent_brief_used
- files_changed
- verify_attempts
- final_status
- short_reason
`;
}

function parseArgs(args) {
  return {
    cases: parseListOption(args, "cases"),
    runId: parseStringOption(args, "run-id"),
    agentSurface: parseStringOption(args, "agent-surface"),
    model: parseStringOption(args, "model")
  };
}

function parseListOption(args, name) {
  const value = parseStringOption(args, name);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : null;
}

function parseStringOption(args, name) {
  const flag = `--${name}`;
  const index = args.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return null;
  return args[index].includes("=") ? args[index].split("=", 2)[1] : args[index + 1];
}
