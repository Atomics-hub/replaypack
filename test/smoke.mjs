import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin/replaypack.mjs");

const help = spawnSync(process.execPath, [cli, "--help"], {
  cwd: root,
  encoding: "utf8"
});
assert.strictEqual(help.status, 0, help.stderr);
assert.match(help.stdout, /replaypack capture/);
assert.match(help.stdout, /replaypack verify/);

const version = spawnSync(process.execPath, [cli, "--version"], {
  cwd: root,
  encoding: "utf8"
});
assert.strictEqual(version.status, 0, version.stderr);
assert.match(version.stdout, /^0\.2\.0/);

const captureCheck = spawnSync(process.execPath, [path.join(root, "bin/replaypack-capture.mjs"), "--help"], {
  cwd: root,
  encoding: "utf8"
});
assert.strictEqual(captureCheck.status, 2);
assert.match(captureCheck.stderr, /Missing required argument/);

const wrongRoot = path.join(root, "examples/account-access/wrong");
const wrongVerify = spawnSync(
  process.execPath,
  [cli, "verify", "replaypack/account-access.json", "--out", "dist/replaypack-verify.json"],
  { cwd: wrongRoot, encoding: "utf8" }
);
assert.notStrictEqual(wrongVerify.status, 0, wrongVerify.stdout);
const wrongPacket = readJson(path.join(wrongRoot, "dist/replaypack-verify.json"));
assert.strictEqual(wrongPacket.status, "fail");
assert.strictEqual(wrongPacket.proof.status, "ok");
assert.strictEqual(wrongPacket.invariants[0].status, "nonzero");

const fixedRoot = path.join(root, "examples/account-access/fixed");
const fixedVerify = spawnSync(
  process.execPath,
  [cli, "verify", "replaypack/account-access.json", "--out", "dist/replaypack-verify.json"],
  { cwd: fixedRoot, encoding: "utf8" }
);
assert.strictEqual(fixedVerify.status, 0, fixedVerify.stderr || fixedVerify.stdout);
const fixedPacket = readJson(path.join(fixedRoot, "dist/replaypack-verify.json"));
assert.strictEqual(fixedPacket.status, "pass");
assert.strictEqual(fixedPacket.proof.status, "ok");
assert.strictEqual(fixedPacket.invariants[0].status, "ok");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "replaypack-capture-"));
writeFixture(tmpRoot);
const capture = spawnSync(
  process.execPath,
  [
    cli,
    "capture",
    "--id",
    "repeatable-flags",
    "--title",
    "Repeatable flag capture",
    "--primary-file",
    "src/app.js",
    "--proof-file",
    "test/proof.mjs",
    "--trace",
    "fixtures/trace/manual.md",
    "--proof-command",
    "node test/proof.mjs",
    "--invariant-command",
    "node test/invariant-a.mjs",
    "--invariant-command",
    "node test/invariant-b.mjs",
    "--issue-file",
    "issues/one.md",
    "--issue-file",
    "issues/two.md",
    "--out",
    "replaypack/repeatable-flags.json",
    "--packet",
    "dist/capture.json"
  ],
  { cwd: tmpRoot, encoding: "utf8" }
);
assert.strictEqual(capture.status, 0, capture.stderr || capture.stdout);
const capsule = readJson(path.join(tmpRoot, "replaypack/repeatable-flags.json"));
assert.deepStrictEqual(capsule.entrypoint.invariant_commands, [
  "node test/invariant-a.mjs",
  "node test/invariant-b.mjs"
]);
assert.deepStrictEqual(capsule.workflow.issue_files, ["issues/one.md", "issues/two.md"]);

console.log("replaypack smoke ok");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFixture(base) {
  fs.mkdirSync(path.join(base, "src"), { recursive: true });
  fs.mkdirSync(path.join(base, "test"), { recursive: true });
  fs.mkdirSync(path.join(base, "issues"), { recursive: true });
  fs.mkdirSync(path.join(base, "fixtures/trace"), { recursive: true });
  fs.writeFileSync(path.join(base, "src/app.js"), "export const ok = true;\n");
  fs.writeFileSync(path.join(base, "test/proof.mjs"), "console.log('proof ok');\n");
  fs.writeFileSync(path.join(base, "test/invariant-a.mjs"), "console.log('invariant a ok');\n");
  fs.writeFileSync(path.join(base, "test/invariant-b.mjs"), "console.log('invariant b ok');\n");
  fs.writeFileSync(path.join(base, "issues/one.md"), "# One\n");
  fs.writeFileSync(path.join(base, "issues/two.md"), "# Two\n");
  fs.writeFileSync(path.join(base, "fixtures/trace/manual.md"), "# Manual Trace\n");
}
