#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? process.cwd());
const capsulePath = path.resolve(root, required(args.capsule, "--capsule"));
const outPath = args.out ? path.resolve(root, args.out) : null;

const startedAt = new Date().toISOString();
const capsule = readJson(capsulePath);
const proofCommand = capsule?.entrypoint?.proof_command;
const invariantCommands = toArray(capsule?.entrypoint?.invariant_commands).filter((item) => typeof item === "string" && item.trim());
const references = collectReferences(capsule);
const referenceChecks = references.map((item) => {
  const absolutePath = path.resolve(root, item.path);
  return {
    kind: item.kind,
    path: item.path,
    exists: fs.existsSync(absolutePath),
    sha256: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile() ? fileSha256(absolutePath) : null
  };
});

const proof =
  referenceChecks.every((item) => item.exists) && typeof proofCommand === "string"
    ? await runProof(proofCommand)
    : {
        status: "skipped",
        exit_code: null,
        duration_ms: 0,
        stdout_tail: "",
        stderr_tail: missingProofReason(referenceChecks, proofCommand)
      };

const invariants = [];
if (referenceChecks.every((item) => item.exists)) {
  for (const command of invariantCommands) {
    invariants.push({ command, ...(await runProof(command)) });
  }
}
const invariantsOk = invariants.every((item) => item.status === "ok");

const report = {
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  evidence_kind: "replaypack_verify_v01",
  root,
  capsule: {
    path: path.relative(root, capsulePath),
    sha256: fileSha256(capsulePath),
    id: capsule?.id ?? null,
    title: capsule?.title ?? null,
    schema: capsule?.schema ?? null
  },
  entrypoint: capsule?.entrypoint ?? null,
  reference_checks: referenceChecks,
  proof,
  ...(invariants.length ? { invariants } : {}),
  status: referenceChecks.every((item) => item.exists) && proof.status === "ok" && invariantsOk ? "pass" : "fail"
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.status === "pass" ? 0 : 1);

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
        stdout_tail: tail(stdout, 2000),
        stderr_tail: tail(stderr, 2000)
      });
    });
    child.on("error", (error) => {
      resolve({
        status: "spawn_error",
        exit_code: null,
        duration_ms: Date.now() - started,
        stdout_tail: tail(stdout, 2000),
        stderr_tail: tail(`${stderr}\n${error.stack ?? error.message}`, 2000)
      });
    });
  });
}

function collectReferences(value) {
  const items = [];
  if (value?.entrypoint?.primary_file) {
    items.push({ kind: "entrypoint.primary_file", path: value.entrypoint.primary_file });
  }
  if (value?.entrypoint?.http_surface) {
    items.push({ kind: "entrypoint.http_surface", path: value.entrypoint.http_surface });
  }
  if (value?.entrypoint?.proof_file) {
    items.push({ kind: "entrypoint.proof_file", path: value.entrypoint.proof_file });
  }
  if (Array.isArray(value?.entrypoint?.related_files)) {
    for (const relatedPath of value.entrypoint.related_files) {
      if (typeof relatedPath === "string" && relatedPath !== value?.entrypoint?.primary_file) {
        items.push({ kind: "entrypoint.related_file", path: relatedPath });
      }
    }
  }
  for (const [kind, group] of [
    ["state", value?.state],
    ["mocks", value?.mocks]
  ]) {
    if (group && typeof group === "object" && !Array.isArray(group)) {
      for (const [name, referencePath] of Object.entries(group)) {
        if (typeof referencePath === "string") {
          items.push({ kind: `${kind}.${name}`, path: referencePath });
        }
      }
    }
  }
  if (typeof value?.trace?.browser_repro === "string") {
    items.push({ kind: "trace.browser_repro", path: value.trace.browser_repro });
  }
  if (typeof value?.trace?.http_repro === "string") {
    items.push({ kind: "trace.http_repro", path: value.trace.http_repro });
  }
  if (typeof value?.trace?.repro === "string") {
    items.push({ kind: "trace.repro", path: value.trace.repro });
  }
  for (const issueFile of toReferencePaths(value?.workflow?.issue_files)) {
    items.push({ kind: "workflow.issue_file", path: issueFile });
  }
  for (const ciLog of toReferencePaths(value?.workflow?.ci_logs)) {
    items.push({ kind: "workflow.ci_log", path: ciLog });
  }
  return items;
}

function toReferencePaths(value) {
  return toArray(value).flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item.path === "string") return [item.path];
    return [];
  });
}

function missingProofReason(referenceChecks, proofCommandValue) {
  const missing = referenceChecks.filter((item) => !item.exists).map((item) => item.path);
  if (missing.length > 0) {
    return `Missing references: ${missing.join(", ")}`;
  }
  if (typeof proofCommandValue !== "string") {
    return "Missing entrypoint.proof_command";
  }
  return "Proof skipped";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else {
      parsed[key] = raw[index + 1];
      index += 1;
    }
  }
  return parsed;
}
