#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , command, ...rawArgs] = process.argv;

if (!command || command === "--help" || command === "-h" || command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log("0.2.0");
  process.exit(0);
}

const scriptByCommand = {
  capture: "replaypack-capture.mjs",
  verify: "replaypack-verify.mjs"
};

const script = scriptByCommand[command];
if (!script) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(2);
}

const args = command === "verify" ? normalizeVerifyArgs(rawArgs) : rawArgs;
const child = spawn(process.execPath, [path.join(here, script), ...args], {
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
  if (!hasCapsuleFlag && normalized[0] && !normalized[0].startsWith("--")) {
    const [capsule, ...rest] = normalized;
    return ["--capsule", capsule, ...rest];
  }
  return normalized;
}

function printHelp() {
  console.log(`ReplayPack

Usage:
  replaypack capture --from-command "npm test -- ..." --out replaypack/issue.json
  replaypack verify replaypack/issue.json

Commands:
  capture   Run a failing proof command and write a portable capsule.
  verify    Run the capsule proof command and invariant commands.

Useful capture flags:
  --id <id>
  --title <title>
  --from-command <command>
  --invariant-command <command>   Repeatable. Verification requires all to pass.
  --issue-file <path>             GitHub-style issue export to include as workflow context.
  --ci-log <path>                 Saved CI/test log to include as workflow context.
  --out <path>
  --packet <path>
`);
}
