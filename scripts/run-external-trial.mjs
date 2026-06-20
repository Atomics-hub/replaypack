#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "bin", "replaypack.mjs");
const packageJson = readJson(path.join(root, "package.json"));
const workRoot = path.join(root, ".tmp", "external-trial");
const publicRoot = path.join(root, "dist", "external-trial");
const issueUrl = "https://github.com/Atomics-hub/replaypack/issues/new?template=external-developer-trial.yml";

fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(workRoot, { recursive: true });
cleanupExampleOutput("examples/account-access/wrong");
cleanupExampleOutput("examples/account-access/fixed");

const commands = [
  runStep({
    id: "cli_smoke",
    command: [process.execPath, cli, "--version"],
    display: "node bin/replaypack.mjs --version",
    cwd: root,
    expectedExit: 0
  }),
  runStep({
    id: "wrong_demo",
    command: [
      process.execPath,
      cli,
      "verify",
      "--root",
      "examples/account-access/wrong",
      "replaypack/account-access.json",
      "--out",
      path.join(workRoot, "wrong-verify.json")
    ],
    display: "node bin/replaypack.mjs verify --root examples/account-access/wrong replaypack/account-access.json",
    cwd: root,
    expectedExit: "nonzero",
    packetPath: path.join(workRoot, "wrong-verify.json")
  }),
  runStep({
    id: "fixed_demo",
    command: [
      process.execPath,
      cli,
      "verify",
      "--root",
      "examples/account-access/fixed",
      "replaypack/account-access.json",
      "--out",
      path.join(workRoot, "fixed-verify.json")
    ],
    display: "node bin/replaypack.mjs verify --root examples/account-access/fixed replaypack/account-access.json",
    cwd: root,
    expectedExit: 0,
    packetPath: path.join(workRoot, "fixed-verify.json")
  }),
  runStep({
    id: "dogfood",
    command: [
      process.execPath,
      cli,
      "verify",
      "docs/dogfood/ci-pack-destination/replaypack.json",
      "--out",
      path.join(workRoot, "dogfood-ci-pack-verify.json")
    ],
    display: "node bin/replaypack.mjs verify docs/dogfood/ci-pack-destination/replaypack.json --out dist/external-trial/dogfood-ci-pack-verify.json",
    cwd: root,
    expectedExit: 0,
    packetPath: path.join(workRoot, "dogfood-ci-pack-verify.json")
  })
];

const wrongPacket = readPacket(path.join(workRoot, "wrong-verify.json"));
const fixedPacket = readPacket(path.join(workRoot, "fixed-verify.json"));
const dogfoodPacket = readPacket(path.join(workRoot, "dogfood-ci-pack-verify.json"));
const wrongInvariant = wrongPacket?.invariants?.[0] ?? {};
const fixedInvariant = fixedPacket?.invariants?.[0] ?? {};
const dogfoodInvariant = dogfoodPacket?.invariants?.[0] ?? {};

const checks = {
  cli_smoke_passed: stepById("cli_smoke").passed,
  wrong_demo_rejected: stepById("wrong_demo").passed && wrongPacket?.status === "fail",
  wrong_visible_proof_passed: wrongPacket?.proof?.status === "ok",
  wrong_invariant_failed: wrongInvariant.status && wrongInvariant.status !== "ok",
  fixed_demo_accepted: stepById("fixed_demo").passed && fixedPacket?.status === "pass",
  fixed_visible_proof_passed: fixedPacket?.proof?.status === "ok",
  fixed_invariant_passed: fixedInvariant.status === "ok",
  dogfood_accepted: stepById("dogfood").passed && dogfoodPacket?.status === "pass",
  dogfood_invariant_passed: dogfoodInvariant.status === "ok"
};
const passed = Object.values(checks).every(Boolean);

const report = {
  schema: "replaypack.external_trial_receipt.v0",
  generated_at: new Date().toISOString(),
  package: {
    name: packageJson.name,
    version: packageJson.version
  },
  node: {
    version: process.version
  },
  git: gitSnapshot(),
  trial_doc: "docs/trials/external-developer-trial.md",
  feedback_issue_url: issueUrl,
  commands,
  checks,
  status: passed ? "pass" : "fail",
  summary: passed
    ? "External trial commands passed: ReplayPack rejected the visible-green wrong fix, accepted the fixed version, and verified the real dogfood capsule."
    : "External trial did not match the expected result. Include this receipt when filing feedback.",
  paste_into_issue: [
    `Trial receipt: dist/external-trial/receipt.json`,
    `Status: ${passed ? "pass" : "fail"}`,
    `Node: ${process.version}`,
    `ReplayPack: ${packageJson.version}`,
    `Wrong demo: proof=${wrongPacket?.proof?.status ?? "missing"}, invariant=${wrongInvariant.status ?? "missing"}, replaypack=${wrongPacket?.status ?? "missing"}`,
    `Fixed demo: proof=${fixedPacket?.proof?.status ?? "missing"}, invariant=${fixedInvariant.status ?? "missing"}, replaypack=${fixedPacket?.status ?? "missing"}`,
    `Dogfood: proof=${dogfoodPacket?.proof?.status ?? "missing"}, invariant=${dogfoodInvariant.status ?? "missing"}, replaypack=${dogfoodPacket?.status ?? "missing"}`
  ]
};

const reportPath = path.join(workRoot, "receipt.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.rmSync(publicRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(publicRoot), { recursive: true });
fs.cpSync(workRoot, publicRoot, { recursive: true });

console.log(`ReplayPack external trial: ${report.status}

Receipt:
  ${path.relative(root, path.join(publicRoot, "receipt.json"))}

What happened:
  wrong demo   proof=${wrongPacket?.proof?.status ?? "missing"} invariant=${wrongInvariant.status ?? "missing"} replaypack=${wrongPacket?.status ?? "missing"}
  fixed demo   proof=${fixedPacket?.proof?.status ?? "missing"} invariant=${fixedInvariant.status ?? "missing"} replaypack=${fixedPacket?.status ?? "missing"}
  dogfood      proof=${dogfoodPacket?.proof?.status ?? "missing"} invariant=${dogfoodInvariant.status ?? "missing"} replaypack=${dogfoodPacket?.status ?? "missing"}

Send feedback:
  ${issueUrl}

Paste this into the issue:
${report.paste_into_issue.map((line) => `  ${line}`).join("\n")}
`);

process.exit(passed ? 0 : 1);

function runStep({ id, command, display, cwd, expectedExit, packetPath }) {
  const startedAt = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  const exitCode = result.status;
  const expectedExitMatched = expectedExit === "nonzero" ? exitCode !== 0 : exitCode === expectedExit;
  const packet = packetPath && fs.existsSync(packetPath) ? readPacket(packetPath) : null;
  return {
    id,
    command: display,
    expected_exit: expectedExit,
    exit_code: exitCode,
    expected_exit_matched: expectedExitMatched,
    passed: expectedExitMatched,
    duration_ms: Date.now() - startedAt,
    packet: packetPath
      ? {
          path: publicPacketPath(packetPath),
          status: packet?.status ?? "missing"
        }
      : null,
    stdout_tail: tail(result.stdout ?? "", 1200),
    stderr_tail: tail(result.stderr ?? "", 1200)
  };
}

function publicPacketPath(packetPath) {
  return path.join("dist", "external-trial", path.basename(packetPath));
}

function stepById(id) {
  return commands.find((item) => item.id === id) ?? {};
}

function cleanupExampleOutput(relativeRoot) {
  fs.rmSync(path.join(root, relativeRoot, "dist"), { recursive: true, force: true });
}

function readPacket(packetPath) {
  if (!fs.existsSync(packetPath)) return null;
  return readJson(packetPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function gitSnapshot() {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const dirty = spawnSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : null,
    dirty: dirty.status === 0 ? dirty.stdout.trim().length > 0 : null
  };
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}
