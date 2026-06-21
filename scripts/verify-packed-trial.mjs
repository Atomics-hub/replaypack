#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tmpRoot = path.join(root, ".tmp", "packed-trial");
const distRoot = path.join(tmpRoot, "dist");
const installRoot = path.join(tmpRoot, "install");

fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });
fs.mkdirSync(installRoot, { recursive: true });

const pack = run("npm", ["pack", "--pack-destination", distRoot], {
  cwd: root,
  label: "npm pack"
});
const tarball = findTarball(pack.stdout);

run("npm", ["init", "-y"], {
  cwd: installRoot,
  label: "npm init"
});
run("npm", ["install", tarball], {
  cwd: installRoot,
  label: "npm install packed replaypack"
});

const replaypackBin = path.join(
  installRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "replaypack.cmd" : "replaypack"
);
const version = run(replaypackBin, ["--version"], {
  cwd: installRoot,
  label: "replaypack --version"
});

if (version.stdout.trim() !== packageJson.version) {
  fail(
    `Packed CLI version mismatch: expected ${packageJson.version}, got ${version.stdout.trim() || "empty output"}.`
  );
}

const trial = run(replaypackBin, ["trial"], {
  cwd: installRoot,
  label: "replaypack trial"
});

if (!/ReplayPack external trial: pass/.test(trial.stdout)) {
  fail("Packed CLI trial did not print the expected pass summary.");
}

const receiptPath = path.join(installRoot, "dist", "external-trial", "receipt.json");
const feedbackPath = path.join(installRoot, "dist", "external-trial", "feedback.md");

if (!fs.existsSync(receiptPath)) {
  fail("Packed CLI trial did not write dist/external-trial/receipt.json in the caller project.");
}

if (!fs.existsSync(feedbackPath)) {
  fail("Packed CLI trial did not write dist/external-trial/feedback.md in the caller project.");
}

const feedback = fs.readFileSync(feedbackPath, "utf8");
for (const required of [
  "### Coding-agent workflow",
  "### One-minute read",
  "### Commands run",
  "node bin/replaypack.mjs trial -> pass",
  "wrong demo: proof=ok invariant=nonzero replaypack=fail",
  "fixed demo: proof=ok invariant=ok replaypack=pass",
  "dogfood: proof=ok invariant=ok replaypack=pass",
  "### First objection"
]) {
  if (!feedback.includes(required)) {
    fail(`Packed CLI trial feedback draft is missing: ${required}`);
  }
}

console.log(`Packed ReplayPack trial: pass

Tarball:
  ${path.relative(root, tarball)}

Verified:
  replaypack --version -> ${version.stdout.trim()}
  replaypack trial -> pass
  receipt -> ${path.relative(installRoot, receiptPath)}
  feedback -> ${path.relative(installRoot, feedbackPath)}
`);

function findTarball(stdout) {
  const tarballName = stdout
    .trim()
    .split(/\s+/)
    .reverse()
    .find((item) => item.endsWith(".tgz"));
  const fallback = path.join(distRoot, `replaypack-${packageJson.version}.tgz`);
  const tarballPath = tarballName ? path.resolve(distRoot, tarballName) : fallback;

  if (!fs.existsSync(tarballPath)) {
    const available = fs.existsSync(distRoot) ? fs.readdirSync(distRoot).join(", ") : "none";
    fail(`Could not find packed tarball. Available files: ${available}`);
  }

  return tarballPath;
}

function run(command, args, { cwd, label }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1"
    }
  });

  if (result.status !== 0) {
    console.error(`${label} failed with exit ${result.status ?? "null"}`);
    printTail("stdout", result.stdout);
    printTail("stderr", result.stderr);
    process.exit(result.status ?? 1);
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function printTail(label, text) {
  const value = text ?? "";
  if (!value.trim()) return;
  console.error(`${label}:`);
  console.error(value.length > 2000 ? value.slice(value.length - 2000) : value);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
