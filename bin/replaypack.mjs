#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const [, , command, ...rawArgs] = process.argv;

if (!command || command === "--help" || command === "-h" || command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log(readVersion());
  process.exit(0);
}

const scriptByCommand = {
  brief: path.join(here, "replaypack-brief.mjs"),
  capture: path.join(here, "replaypack-capture.mjs"),
  verify: path.join(here, "replaypack-verify.mjs"),
  trial: path.join(packageRoot, "scripts", "run-external-trial.mjs")
};

const script = scriptByCommand[command];
if (!script) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(2);
}

const args = command === "verify" ? normalizeVerifyArgs(rawArgs) : rawArgs;
const child = spawn(process.execPath, [script, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});

function normalizeVerifyArgs(args) {
  const normalized = [...args];
  const hasCapsuleFlag = normalized.some((arg) => arg === "--capsule" || arg.startsWith("--capsule="));
  if (hasCapsuleFlag) {
    return normalized;
  }

  const positionalIndex = firstPositionalIndex(normalized);
  if (positionalIndex !== -1) {
    const capsule = normalized[positionalIndex];
    return [
      ...normalized.slice(0, positionalIndex),
      "--capsule",
      capsule,
      ...normalized.slice(positionalIndex + 1)
    ];
  }

  return normalized;
}

function firstPositionalIndex(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) {
      return index;
    }
    if (!arg.includes("=")) {
      index += 1;
    }
  }
  return -1;
}

function printHelp() {
  console.log(`ReplayPack

Usage:
  replaypack brief replaypack/issue.json
  replaypack brief --root examples/account-access/fixed replaypack/account-access.json
  replaypack capture --proof-command "npm test -- ..." --out replaypack/issue.json
  replaypack verify replaypack/issue.json
  replaypack verify --root examples/account-access/fixed replaypack/account-access.json
  replaypack trial

Commands:
  brief    Print an agent-ready task brief from a capsule.
  capture   Run a failing proof command and write a portable capsule.
  verify    Run the capsule proof command and invariant commands.
  trial     Run the 10-minute external developer trial and write a receipt.

Useful capture flags:
  --id <id>
  --title <title>
  --proof-command <command>
  --from-command <command>        Alias for --proof-command; enables best-effort file inference.
  --primary-file <path>
  --proof-file <path>
  --trace <path>
  --invariant-command <command>   Repeatable. Verification requires all to pass.
  --issue-file <path>             GitHub-style issue export to include as workflow context.
  --ci-log <path>                 Saved CI/test log to include as workflow context.
  --out <path>
  --packet <path>

Useful verify flags:
  --root <path>                   Run proof and invariant commands from this directory.
  --out <path>                    Write the verification packet.
`);
}

function readVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
