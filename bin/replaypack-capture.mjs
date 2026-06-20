#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const COMMON_TOKENS = new Set([
  "test",
  "tests",
  "result",
  "running",
  "failed",
  "failures",
  "thread",
  "called",
  "value",
  "bytes",
  "input",
  "output",
  "source",
  "target",
  "debug",
  "cargo",
  "rustc",
  "compiling",
  "finished",
  "profile",
  "unoptimized",
  "debuginfo"
]);

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? process.cwd());
const outPath = path.resolve(root, required(args.out, "--out"));
const packetPath = args.packet ? path.resolve(root, args.packet) : null;
const fromCommand = args.fromCommand ?? args["from-command"] ?? null;
const proofCommand = fromCommand ?? required(args.proofCommand ?? args["proof-command"], "--proof-command");
const issueFiles = toArray(args.issueFile ?? args["issue-file"]).filter(Boolean);
const ciLogs = toArray(args.ciLog ?? args["ci-log"]).filter(Boolean);
const invariantCommands = [
  ...toArray(args.invariantCommand ?? args["invariant-command"]),
  ...toArray(args.acceptanceCommand ?? args["acceptance-command"]),
  ...toArray(args.checkCommand ?? args["check-command"])
].filter(Boolean);

const startedAt = new Date().toISOString();
const proof = await runProof(proofCommand);
const invariantPrechecks = [];
for (const command of invariantCommands) {
  invariantPrechecks.push({ command, ...(await runProof(command)) });
}
const inference = fromCommand ? inferCaptureInputs(proof, proofCommand) : null;
const primaryFile =
  args.primaryFile ?? args["primary-file"] ?? inference?.primary_file ?? required(null, "--primary-file");
const proofFile = args.proofFile ?? args["proof-file"] ?? inference?.proof_file ?? null;
const traceFile =
  args.trace ??
  args.repro ??
  inference?.trace_file ??
  required(null, "--trace");

if (inference?.trace_file && !fs.existsSync(path.resolve(root, inference.trace_file))) {
  writeInferredTrace(inference.trace_file, proofCommand, proof, inference);
}
const references = [
  { kind: "entrypoint.primary_file", path: primaryFile },
  ...(inference?.related_files ?? []).map((relatedPath) => ({
    kind: "entrypoint.related_file",
    path: relatedPath
  })),
  ...(proofFile ? [{ kind: "entrypoint.proof_file", path: proofFile }] : []),
  ...issueFiles.map((issueFile) => ({ kind: "workflow.issue_file", path: issueFile })),
  ...ciLogs.map((ciLog) => ({ kind: "workflow.ci_log", path: ciLog })),
  { kind: "trace.repro", path: traceFile }
];

const referenceChecks = references.map((item) => checkReference(item));
const capsule = {
  schema: "replaypack.capsule.v0",
  id: required(args.id, "--id"),
  title: required(args.title, "--title"),
  created_at: new Date().toISOString(),
  entrypoint: {
    repo_root: ".",
    primary_file: primaryFile,
    ...(inference?.related_files?.length ? { related_files: inference.related_files } : {}),
    ...(proofFile ? { proof_file: proofFile } : {}),
    proof_command: proofCommand,
    ...(invariantCommands.length ? { invariant_commands: invariantCommands } : {})
  },
  ...(issueFiles.length || ciLogs.length
    ? {
        workflow: {
          ...(issueFiles.length ? { issue_files: issueFiles } : {}),
          ...(ciLogs.length ? { ci_logs: ciLogs } : {})
        }
      }
    : {}),
  trace: {
    repro: traceFile,
    observed: summarizeObserved(proof),
    expected: args.expected ?? "Proof command should pass after the source fix."
  },
  acceptance: toArray(args.acceptance),
  agent_instructions: toArray(args.instruction ?? args["agent-instruction"]),
  capture: {
    evidence_kind: "replaypack_capture_v01",
    captured_at: new Date().toISOString(),
    proof_status: proof.status,
    proof_exit_code: proof.exit_code,
    ...(invariantPrechecks.length ? { invariant_prechecks: invariantPrechecks } : {}),
    ...(inference ? { inference } : {}),
    references: referenceChecks
  }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(capsule, null, 2)}\n`);

const capturePacket = {
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  evidence_kind: "replaypack_capture_v01",
  root,
  capsule: {
    path: path.relative(root, outPath),
    sha256: fileSha256(outPath),
    id: capsule.id,
    title: capsule.title,
    schema: capsule.schema
  },
  reference_checks: referenceChecks,
  proof,
  ...(invariantPrechecks.length ? { invariant_prechecks: invariantPrechecks } : {}),
  ...(inference ? { inference } : {}),
  status: referenceChecks.every((item) => item.exists) ? "captured" : "partial"
};

if (packetPath) {
  fs.mkdirSync(path.dirname(packetPath), { recursive: true });
  fs.writeFileSync(packetPath, `${JSON.stringify(capturePacket, null, 2)}\n`);
}

console.log(JSON.stringify(capturePacket, null, 2));
process.exit(capturePacket.status === "captured" ? 0 : 1);

async function runProof(command) {
  const started = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        status: code === 0 ? "ok" : "nonzero",
        exit_code: code,
        duration_ms: Date.now() - started,
        stdout_tail: tail(stdout, 4000),
        stderr_tail: tail(stderr, 4000)
      });
    });
    child.on("error", (error) => {
      resolve({
        status: "spawn_error",
        exit_code: null,
        duration_ms: Date.now() - started,
        stdout_tail: tail(stdout, 4000),
        stderr_tail: tail(`${stderr}\n${error.stack ?? error.message}`, 4000)
      });
    });
  });
}

function checkReference(item) {
  const absolutePath = path.resolve(root, item.path);
  return {
    ...item,
    exists: fs.existsSync(absolutePath),
    sha256: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile() ? fileSha256(absolutePath) : null
  };
}

function summarizeObserved(proof) {
  if (proof.status === "ok") {
    return "Proof command already passes.";
  }
  const text = proof.stdout_tail.trim() || proof.stderr_tail.trim();
  return text.length <= 1200 ? text : text.slice(text.length - 1200);
}

function inferCaptureInputs(proof, command) {
  const observed = `${proof.stdout_tail}\n${proof.stderr_tail}`;
  const testName = cleanTestName(
    firstMatch(observed, /✖ ([^\n]+)/) ??
    firstMatch(observed, /not ok \d+ - ([^\n]+)/) ??
    firstMatch(observed, /test ([A-Za-z0-9_]+) \.\.\. FAILED/) ??
    firstMatch(command, /cargo test ([A-Za-z0-9_:]+)/)?.split("::").at(-1) ??
    firstMatch(command, /--test-name-pattern[= ]['"]?([^'"]+)/) ??
    "failing_proof"
  );
  const proofFile =
    firstMatch(observed, /panicked at ([^:\n]+):\d+:\d+:/) ??
    normalizeObservedPath(firstMatch(observed, /(?:at .*?\()?((?:file:\/\/)?[^\s()]+\.test\.[cm]?js):\d+:\d+/)) ??
    normalizeObservedPath(firstMatch(observed, /((?:file:\/\/)?[^\s()]+\.test\.[cm]?js):\d+:\d+/)) ??
    inferProofFileFromCommand(command);
  const primary = inferPrimaryFile(testName, proofFile, observed);
  const traceFile = `fixtures/trace/captured-${slugify(testName)}.md`;
  const relatedFiles = primary.candidates
    .filter((candidate) => candidate.path !== primary.path)
    .slice(0, 3)
    .map((candidate) => candidate.path);
  return {
    mode: "from_command",
    command,
    failing_test: testName,
    proof_file: proofFile,
    primary_file: primary.path,
    related_files: relatedFiles,
    primary_score: primary.score,
    primary_candidates: primary.candidates.slice(0, 5),
    trace_file: traceFile
  };
}

function inferProofFileFromCommand(command) {
  const nodeTest = firstMatch(command, /node\s+--test\s+([^\s]+)/);
  if (nodeTest) return nodeTest;
  const tests = listFiles(root).filter((filePath) => {
    if (command.includes("cargo test")) {
      return filePath.startsWith("tests/") && filePath.endsWith(".rs");
    }
    return /(^|\/)test\/.*\.test\.[cm]?js$/.test(filePath) || /\.test\.[cm]?js$/.test(filePath);
  });
  return tests.sort()[0] ?? null;
}

function inferPrimaryFile(testName, proofFile, observed) {
  const proofText = proofFile ? safeRead(path.resolve(root, proofFile)) : "";
  const tokens = tokenize(`${testName}\n${observed}\n${proofText}`)
    .filter((token) => token.length >= 4 && !COMMON_TOKENS.has(token));
  const uniqueTokens = [...new Set(tokens)];
  const candidates = sourceFiles()
    .map((filePath) => {
      const text = safeRead(path.resolve(root, filePath)).toLowerCase();
      const basename = path.basename(filePath).toLowerCase();
      let score = 0;
      for (const token of uniqueTokens) {
        if (text.includes(token)) score += token.length > 8 ? 3 : 1;
        if (basename.includes(token)) score += 2;
      }
      if (proofFile && filePath.includes(path.dirname(proofFile))) score += 1;
      return { path: filePath, score };
    })
    .sort((left, right) => right.score - left.score);
  const best = candidates[0] ?? sourceFiles().sort()[0] ?? { path: "src/index.js", score: 0 };
  return { ...best, candidates };
}

function sourceFiles() {
  return listFiles(root).filter((filePath) => {
    if (filePath.includes("/dist/") || filePath.startsWith("dist/")) return false;
    if (filePath.includes("/node_modules/") || filePath.startsWith("node_modules/")) return false;
    return (
      filePath.startsWith("src/") ||
      filePath.includes("/src/") ||
      filePath.startsWith("packages/")
    ) && /\.(rs|ts|tsx|js|mjs)$/.test(filePath);
  });
}

function writeInferredTrace(relativePath, command, proof, inference) {
  const absolutePath = path.resolve(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const body = [
    `# Captured ReplayPack Trace`,
    ``,
    `Trace id: \`${required(args.id, "--id")}\``,
    ``,
    `Capture mode: \`${inference.mode}\``,
    ``,
    `Command:`,
    ``,
    "```bash",
    command,
    "```",
    ``,
    `Inferred failing test: \`${inference.failing_test}\``,
    `Inferred proof file: \`${inference.proof_file ?? "unknown"}\``,
    `Inferred primary file: \`${inference.primary_file}\``,
    ...(inference.related_files?.length
      ? [`Related file candidates: ${inference.related_files.map((item) => `\`${item}\``).join(", ")}`]
      : []),
    ``,
    `Observed proof status: \`${proof.status}\` exit \`${proof.exit_code}\``,
    ``,
    `Observed output:`,
    ``,
    "```text",
    summarizeObserved(proof),
    "```",
    ``
  ].join("\n");
  fs.writeFileSync(absolutePath, body);
}

function listFiles(base) {
  const files = [];
  walk(base, "");
  return files;

  function walk(currentRoot, relativeRoot) {
    for (const entry of fs.readdirSync(currentRoot, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "target" || entry.name === "node_modules") {
        continue;
      }
      const relativePath = path.join(relativeRoot, entry.name);
      const absolutePath = path.join(currentRoot, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z_][a-z0-9_]+/g) ?? [];
}

function firstMatch(text, pattern) {
  return pattern.exec(text)?.[1] ?? null;
}

function normalizeObservedPath(value) {
  if (!value) return null;
  const withoutScheme = value.startsWith("file://") ? new URL(value).pathname : value;
  const absolutePath = path.resolve(withoutScheme);
  return path.relative(root, absolutePath);
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanTestName(value) {
  return value.replace(/\s+\(\d+(?:\.\d+)?ms\)\s*$/, "").trim();
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function required(value, label) {
  if (!value) {
    console.error(`Missing required argument ${label}`);
    process.exit(2);
  }
  return value;
}

function parseArgs(raw) {
  const parsed = {};
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item.startsWith("--")) continue;
    const [key, inlineValue] = item.slice(2).split("=", 2);
    const value = inlineValue !== undefined ? inlineValue : raw[index + 1];
    if (inlineValue === undefined) index += 1;
    if (parsed[key] === undefined) {
      parsed[key] = value;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
    } else {
      parsed[key] = [parsed[key], value];
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`ReplayPack capture

Usage:
  replaypack capture \\
    --id <id> \\
    --title <title> \\
    --primary-file src/file.js \\
    --proof-file test/proof.mjs \\
    --trace fixtures/trace/repro.md \\
    --proof-command "npm run proof" \\
    --invariant-command "npm run invariant" \\
    --out replaypack/issue.json

Useful flags:
  --from-command <command>        Alias for --proof-command; enables best-effort file inference.
  --primary-file <path>           Main source file the agent should inspect.
  --proof-file <path>             Focused proof file.
  --trace <path>                  Repro trace or notes.
  --issue-file <path>             Repeatable issue/context file.
  --ci-log <path>                 Repeatable CI/test log.
  --invariant-command <command>   Repeatable command required during verification.
  --packet <path>                 Optional capture evidence packet.
`);
}
