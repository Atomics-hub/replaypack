import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const match = workflow.match(/run:\s*(mkdir -p dist && npm pack --pack-destination dist)/);

assert.ok(match, "CI package step must create dist before npm pack writes into it");

fs.rmSync("dist", { recursive: true, force: true });

const result = spawnSync("bash", ["-lc", match[1]], {
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" }
});

assert.equal(
  result.status,
  0,
  `fresh-runner package command failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
);
assert.ok(fs.existsSync("dist/replaypack-0.2.0.tgz"), "package tarball should exist in dist");
