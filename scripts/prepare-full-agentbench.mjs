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
  "feature-flag-fallback": `export function enabled(tenantFlag, globalDefault) {
  return Boolean(globalDefault);
}
`,
  "webhook-signature": `export function verifyWebhook(request, secret) {
  return false;
}
`
};
const defaultCases = Object.keys(baseSources);
const cases = parseCases(process.argv.slice(2)) ?? defaultCases;
const runId = `full-generation-${new Date().toISOString().slice(0, 10)}`;
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

  fs.writeFileSync(path.join(controlRoot, "agent-task.md"), controlTask(caseId));
  fs.writeFileSync(path.join(treatmentRoot, "agent-task.md"), treatmentTask(caseId));

  assignments.push({
    case_id: caseId,
    control_dir: path.relative(root, controlRoot),
    treatment_dir: path.relative(root, treatmentRoot),
    control_task: path.relative(root, path.join(controlRoot, "agent-task.md")),
    treatment_task: path.relative(root, path.join(treatmentRoot, "agent-task.md"))
  });
}

const run = {
  schema: "replaypack.full_agentbench.run.v0",
  run_id: runId,
  generated_at: new Date().toISOString(),
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

You are a coding agent using ReplayPack as the finish contract.

Rules:

- Work only inside this assignment directory.
- Do not inspect sibling control directories, .tmp/proofbench, docs/proofbench, docs/agentbench, or any file outside this assignment except the repo-local ReplayPack CLI path used below.
- Use the local ReplayPack capsule, issue, trace, source file, proof, and invariant feedback to fix the bug.
- Edit only src/system.js unless a command output proves another local file in this assignment is broken.
- Proof command: npm run proof
- Finish gate: node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json
- If ReplayPack verify fails, use the proof/invariant failure to repair the fix and rerun verify.
- Stop after ReplayPack verify passes, or after 4 verify attempts.

Write transcript.md with:

- commands_run
- files_changed
- verify_attempts
- final_status
- short_reason
`;
}

function parseCases(args) {
  const index = args.findIndex((arg) => arg === "--cases" || arg.startsWith("--cases="));
  if (index === -1) return null;
  const value = args[index].includes("=") ? args[index].split("=", 2)[1] : args[index + 1];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
