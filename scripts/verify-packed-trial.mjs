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

writeBriefFixture(installRoot);
const brief = run(replaypackBin, ["brief", "replaypack/case.json", "--out", "dist/agent-brief.md"], {
  cwd: installRoot,
  label: "replaypack brief"
});

if (!/Wrote dist\/agent-brief\.md/.test(brief.stdout)) {
  fail("Packed CLI brief did not print the expected write summary.");
}

const agentBriefPath = path.join(installRoot, "dist", "agent-brief.md");
if (!fs.existsSync(agentBriefPath)) {
  fail("Packed CLI brief did not write dist/agent-brief.md in the caller project.");
}

const agentBrief = fs.readFileSync(agentBriefPath, "utf8");
for (const required of [
  "# ReplayPack Agent Brief",
  "Packed package brief fixture",
  "npx replaypack verify replaypack/case.json --out dist/replaypack-verify.json",
  "issues/issue.md",
  "fixtures/trace/repro.md",
  "Do not say done until ReplayPack verify passes."
]) {
  if (!agentBrief.includes(required)) {
    fail(`Packed CLI brief is missing: ${required}`);
  }
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
const agentReportPath = path.join(installRoot, "dist", "external-trial", "agent-report.md");

if (!fs.existsSync(receiptPath)) {
  fail("Packed CLI trial did not write dist/external-trial/receipt.json in the caller project.");
}

if (!fs.existsSync(feedbackPath)) {
  fail("Packed CLI trial did not write dist/external-trial/feedback.md in the caller project.");
}

if (!fs.existsSync(agentReportPath)) {
  fail("Packed CLI trial did not write dist/external-trial/agent-report.md in the caller project.");
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
if (receipt.agent_report_markdown !== "dist/external-trial/agent-report.md") {
  fail("Packed CLI trial receipt did not reference dist/external-trial/agent-report.md.");
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

const agentReport = fs.readFileSync(agentReportPath, "utf8");
for (const required of [
  "# ReplayPack Agent Trial Report",
  "## Agent Task",
  "## Machine Result",
  "## Issue-Ready Agent Response",
  "Do not claim this is external-user proof unless the runner is actually outside the ReplayPack project.",
  "wrong demo: proof=ok invariant=nonzero replaypack=fail",
  "fixed demo: proof=ok invariant=ok replaypack=pass",
  "dogfood: proof=ok invariant=ok replaypack=pass"
]) {
  if (!agentReport.includes(required)) {
    fail(`Packed CLI trial agent report is missing: ${required}`);
  }
}

console.log(`Packed ReplayPack trial: pass

Tarball:
  ${path.relative(root, tarball)}

Verified:
  replaypack --version -> ${version.stdout.trim()}
  replaypack brief -> pass
  agent brief -> ${path.relative(installRoot, agentBriefPath)}
  replaypack trial -> pass
  receipt -> ${path.relative(installRoot, receiptPath)}
  feedback -> ${path.relative(installRoot, feedbackPath)}
  agent report -> ${path.relative(installRoot, agentReportPath)}
`);

function writeBriefFixture(base) {
  fs.mkdirSync(path.join(base, "src"), { recursive: true });
  fs.mkdirSync(path.join(base, "test"), { recursive: true });
  fs.mkdirSync(path.join(base, "issues"), { recursive: true });
  fs.mkdirSync(path.join(base, "fixtures", "trace"), { recursive: true });
  fs.mkdirSync(path.join(base, "replaypack"), { recursive: true });
  fs.writeFileSync(path.join(base, "src", "system.js"), "export const ok = true;\n");
  fs.writeFileSync(path.join(base, "test", "proof.mjs"), "console.log('proof ok');\n");
  fs.writeFileSync(path.join(base, "test", "invariant.mjs"), "console.log('invariant ok');\n");
  fs.writeFileSync(path.join(base, "issues", "issue.md"), "# Packed package brief fixture\n\nThe agent must use ReplayPack as the finish gate.\n");
  fs.writeFileSync(path.join(base, "fixtures", "trace", "repro.md"), "# Trace\n\nVisible proof can pass before the invariant is checked.\n");
  fs.writeFileSync(
    path.join(base, "replaypack", "case.json"),
    `${JSON.stringify(
      {
        schema: "replaypack.capsule.v0",
        id: "packed-brief-fixture",
        title: "Packed package brief fixture",
        created_at: "2026-06-20T00:00:00-07:00",
        entrypoint: {
          repo_root: ".",
          primary_file: "src/system.js",
          proof_file: "test/proof.mjs",
          proof_command: "npm run proof",
          invariant_commands: ["npm run invariant"]
        },
        workflow: {
          issue_files: ["issues/issue.md"]
        },
        trace: {
          repro: "fixtures/trace/repro.md"
        },
        acceptance: ["agent brief is generated in the caller project"],
        agent_instructions: ["Do not stop at the visible proof."]
      },
      null,
      2
    )}\n`
  );
}

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
