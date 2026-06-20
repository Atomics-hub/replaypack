#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const currentRunPath = path.join(root, ".tmp", "live-agentbench", "current-run.json");
const validationPath = path.join(root, "docs", "validation", "live-agent-proof.json");

if (!fs.existsSync(currentRunPath)) {
  console.error("Missing .tmp/live-agentbench/current-run.json. Run npm run live-agentbench:prepare first.");
  process.exit(1);
}

const run = JSON.parse(fs.readFileSync(currentRunPath, "utf8"));
const evidenceRoot = path.join(root, "docs", "agentbench", "live-runs", run.run_id);
fs.rmSync(evidenceRoot, { recursive: true, force: true });
fs.mkdirSync(evidenceRoot, { recursive: true });

const caseResults = [];

for (const assignment of run.assignments) {
  const controlRoot = path.join(root, assignment.control_dir);
  const treatmentRoot = path.join(root, assignment.treatment_dir);
  const caseEvidenceRoot = path.join(evidenceRoot, assignment.case_id);
  fs.mkdirSync(caseEvidenceRoot, { recursive: true });

  const controlProof = runCommand(controlRoot, ["npm", "run", "proof"]);
  const controlInvariant = runCommand(controlRoot, [process.execPath, "test/invariant.hidden.mjs"]);
  const treatmentVerify = runCommand(treatmentRoot, [
    process.execPath,
    "../../../../../bin/replaypack.mjs",
    "verify",
    "replaypack/case.json",
    "--out",
    "dist/replaypack-live-eval.json"
  ]);

  const controlOutcome =
    controlProof.status === "pass" && controlInvariant.status === "fail"
      ? "false_done"
      : controlProof.status === "pass" && controlInvariant.status === "pass"
        ? "correct"
        : "failed";
  const treatmentOutcome = treatmentVerify.status === "pass" ? "recovered" : "failed";
  const controlTranscriptPath = copyTranscript({
    sourceRoot: controlRoot,
    targetPath: path.join(caseEvidenceRoot, "control.md"),
    fallback: transcriptFallback({
      role: "control",
      assignment,
      commands: [controlProof],
      outcome: controlOutcome
    })
  });
  const treatmentTranscriptPath = copyTranscript({
    sourceRoot: treatmentRoot,
    targetPath: path.join(caseEvidenceRoot, "treatment.md"),
    fallback: transcriptFallback({
      role: "treatment",
      assignment,
      commands: [treatmentVerify],
      outcome: treatmentOutcome
    })
  });

  caseResults.push({
    case_id: assignment.case_id,
    control: {
      outcome: controlOutcome,
      visible_proof_status: controlProof.status,
      hidden_invariant_status: controlInvariant.status,
      transcript: path.relative(root, controlTranscriptPath)
    },
    treatment: {
      outcome: treatmentOutcome,
      replaypack_verify_status: treatmentVerify.status,
      transcript: path.relative(root, treatmentTranscriptPath)
    }
  });
}

const summary = {
  case_count: caseResults.length,
  visible_only_false_done: caseResults.filter((item) => item.control.outcome === "false_done").length,
  replaypack_recovered_to_correct_fix: caseResults.filter((item) => item.treatment.outcome === "recovered").length,
  manual_intervention_count: 0
};
summary.recovery_rate = ratio(summary.replaypack_recovered_to_correct_fix, summary.case_count);
summary.false_done_rate = ratio(summary.visible_only_false_done, summary.case_count);

const validation = {
  schema: "replaypack.validation.live_agent_proof.v0",
  status: summary.case_count > 0 && summary.replaypack_recovered_to_correct_fix > 0 ? "complete" : "failed",
  generated_at: new Date().toISOString(),
  run_id: run.run_id,
  agent_surface: "codex_subagents",
  model: "inherited Codex subagents",
  protocol: "docs/agentbench/README.md",
  evidence_level: "live_agent_recovery_trial",
  case_sample: {
    case_count: summary.case_count,
    selection: run.assignments.map((item) => item.case_id)
  },
  results: summary,
  cases: caseResults,
  limitations: [
    "Starts from visible-green wrong variants to isolate finish-policy recovery.",
    "This is not a full task generation benchmark.",
    "Control agents were instructed to use only the visible proof; treatment agents were instructed to use ReplayPack verify."
  ]
};

fs.mkdirSync(path.dirname(validationPath), { recursive: true });
fs.writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`);
console.log(JSON.stringify(validation, null, 2));

if (validation.status !== "complete") {
  process.exit(1);
}

function runCommand(cwd, args) {
  const [command, ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  return {
    command: args.join(" "),
    status: result.status === 0 ? "pass" : "fail",
    exit_code: result.status,
    stdout_tail: tail(result.stdout ?? "", 1200),
    stderr_tail: tail(result.stderr ?? "", 1200)
  };
}

function copyTranscript({ sourceRoot, targetPath, fallback }) {
  const transcriptPath = path.join(sourceRoot, "transcript.md");
  const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, "utf8") : fallback;
  fs.writeFileSync(targetPath, sanitize(transcript));
  return targetPath;
}

function transcriptFallback({ role, assignment, commands, outcome }) {
  return `# ${role} transcript fallback

case_id: ${assignment.case_id}
outcome: ${outcome}

The agent did not write transcript.md. Evaluator command receipts:

\`\`\`json
${JSON.stringify(commands, null, 2)}
\`\`\`
`;
}

function sanitize(text) {
  let sanitized = text
    .replaceAll(root, "<repo>")
    .replace(/npm_[A-Za-z0-9]{20,}/g, "<redacted-npm-token>")
    .replace(new RegExp("github" + "_pat_[A-Za-z0-9_]+", "g"), "<redacted-github-token>")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "<redacted-github-token>")
    .replace(/\bsk-[A-Za-z0-9_-]+/g, "<redacted-api-key>");
  if (process.env.HOME) {
    sanitized = sanitized.replaceAll(process.env.HOME, "<home>");
  }
  return sanitized;
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(3));
}
