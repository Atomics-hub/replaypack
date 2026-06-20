#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const defaultCases = ["account-access", "feature-flag-fallback", "webhook-signature"];
const options = parseArgs(process.argv.slice(2));
const cases = options.cases ?? defaultCases;
const runId = options.runId ?? `live-recovery-${new Date().toISOString().slice(0, 10)}`;
const proofbenchRoot = path.join(root, ".tmp", "proofbench");
const liveRoot = path.join(root, ".tmp", "live-agentbench", runId);
const currentRunPath = path.join(root, ".tmp", "live-agentbench", "current-run.json");

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

fs.rmSync(liveRoot, { recursive: true, force: true });
fs.mkdirSync(liveRoot, { recursive: true });

const assignments = [];

for (const caseId of cases) {
  const sourceRoot = path.join(proofbenchRoot, caseId, "wrong");
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Unknown ProofBench case: ${caseId}`);
  }

  const caseRoot = path.join(liveRoot, caseId);
  const controlRoot = path.join(caseRoot, "control");
  const treatmentRoot = path.join(caseRoot, "treatment");
  fs.mkdirSync(caseRoot, { recursive: true });
  fs.cpSync(sourceRoot, controlRoot, { recursive: true });
  fs.cpSync(sourceRoot, treatmentRoot, { recursive: true });

  fs.rmSync(path.join(controlRoot, "replaypack"), { recursive: true, force: true });
  fs.rmSync(path.join(controlRoot, "dist"), { recursive: true, force: true });
  fs.rmSync(path.join(treatmentRoot, "dist"), { recursive: true, force: true });
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
  schema: "replaypack.live_agentbench.run.v0",
  run_id: runId,
  generated_at: new Date().toISOString(),
  agent_surface: options.agentSurface ?? "codex_subagents",
  model: options.model ?? "inherited Codex subagents",
  evidence_level: "live_agent_recovery_trial",
  limitation:
    "Starts from visible-green wrong variants to isolate finish-policy recovery; this is not a full task generation benchmark.",
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
  return `# Live AgentBench Control Task

Case: ${caseId}

You are a coding agent using the normal visible-proof-only finish policy.

Rules:

- Work only inside this assignment directory.
- Do not inspect sibling treatment directories, .tmp/proofbench, docs/proofbench, docs/agentbench, or any file outside this assignment.
- You may edit source files only if the visible proof fails.
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
  return `# Live AgentBench Treatment Task

Case: ${caseId}

You are a coding agent using ReplayPack as the finish contract.

Rules:

- Work only inside this assignment directory.
- Do not inspect sibling control directories, .tmp/proofbench, docs/proofbench, docs/agentbench, or any file outside this assignment except the repo-local ReplayPack CLI path used below.
- Edit only src/system.js unless a command output proves another local file in this assignment is broken.
- Proof command: npm run proof
- Finish gate: node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-live.json
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
