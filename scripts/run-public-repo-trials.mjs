#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const workRoot = path.join(root, ".tmp", "public-repo-trials");
const resultsPath = path.join(root, "docs", "public-repo-trials", "results.json");
const cli = path.join(root, "bin", "replaypack.mjs");

fs.rmSync(workRoot, { recursive: true, force: true });
fs.mkdirSync(workRoot, { recursive: true });

const trials = [];
for (const trial of trialDefinitions()) {
  const started = Date.now();
  const checkout = path.join(workRoot, trial.id);
  const clone = run(root, ["git", "clone", "--depth", "1", trial.url, checkout], safeEnv());

  if (clone.status !== "pass") {
    trials.push({
      id: trial.id,
      repository: trial.repository,
      url: trial.url,
      status: "clone_failed",
      clone,
      duration_ms: Date.now() - started
    });
    continue;
  }

  const commit = run(checkout, ["git", "rev-parse", "HEAD"], safeEnv());
  writeTrialFiles(checkout, trial);

  const verify = run(
    checkout,
    [
      process.execPath,
      cli,
      "verify",
      ".replaypack-trial/replaypack.json",
      "--out",
      ".replaypack-trial/verify.json"
    ],
    safeEnv(path.join(workRoot, `${trial.id}-home`))
  );

  const packetPath = path.join(checkout, ".replaypack-trial", "verify.json");
  const packet = fs.existsSync(packetPath) ? JSON.parse(fs.readFileSync(packetPath, "utf8")) : null;

  trials.push({
    id: trial.id,
    repository: trial.repository,
    url: trial.url,
    commit: commit.status === "pass" ? commit.stdout_tail.trim() : null,
    package: readPackageSummary(checkout),
    primary_file: trial.primaryFile,
    proof_command: "node .replaypack-trial/proof.mjs",
    invariant_command: "node .replaypack-trial/invariant.mjs",
    replaypack_status: verify.status,
    packet_status: packet?.status ?? null,
    proof_status: packet?.proof?.status ?? null,
    invariant_status: packet?.invariants?.[0]?.status ?? null,
    capsule_sha256: packet?.capsule?.sha256 ?? null,
    duration_ms: Date.now() - started,
    clone_stdout_tail: clone.stdout_tail,
    verify_stderr_tail: verify.stderr_tail,
    notes: trial.notes
  });
}

const passed = trials.filter((trial) => trial.replaypack_status === "pass" && trial.packet_status === "pass");
const results = {
  schema: "replaypack.public_repo_private_trials.v0",
  generated_at: new Date().toISOString(),
  methodology: {
    mode: "private read-only public repository trials",
    writes: "local temp clone only",
    install_scripts: "not run",
    environment: "proof and invariant commands run with a scrubbed environment",
    limitation:
      "These trials prove portability on public code; they do not replace external developer comprehension proof."
  },
  summary: {
    attempted: trials.length,
    passed: passed.length,
    failed: trials.length - passed.length,
    pass_rate: trials.length === 0 ? 0 : Number((passed.length / trials.length).toFixed(3))
  },
  trials
};

fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

if (passed.length !== trials.length) {
  process.exit(1);
}

function trialDefinitions() {
  return [
    {
      id: "escape-string-regexp",
      repository: "sindresorhus/escape-string-regexp",
      url: "https://github.com/sindresorhus/escape-string-regexp.git",
      primaryFile: "index.js",
      title: "Regex escaping preserves literal matching",
      issue:
        "# Regex escaping invariant\n\nEscaped strings should compile under the Unicode regex flag and match only the original literal.",
      trace:
        "# Trace\n\nAgent fixes often satisfy one visible metacharacter case while missing hyphen, Unicode regex, or anchored literal behavior.",
      proof: `import assert from "node:assert/strict";
import escapeStringRegexp from "../index.js";

assert.equal(escapeStringRegexp("a+b"), "a\\\\+b");
`,
      invariant: `import assert from "node:assert/strict";
import escapeStringRegexp from "../index.js";

const literals = [
  "a+b",
  "price is $5.00?",
  "path\\\\to\\\\file",
  "foo - bar",
  "[literal](group){1}|end^"
];

for (const literal of literals) {
  const escaped = escapeStringRegexp(literal);
  const regex = new RegExp(\`^\${escaped}$\`, "u");
  assert.equal(regex.test(literal), true, \`escaped literal should match: \${literal}\`);
  assert.equal(regex.test(\`\${literal}x\`), false, \`escaped literal should be anchored: \${literal}\`);
}

assert.equal(escapeStringRegexp("-"), "\\\\x2d");
assert.doesNotThrow(() => new RegExp(escapeStringRegexp("-"), "u"));
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    },
    {
      id: "is-plain-obj",
      repository: "sindresorhus/is-plain-obj",
      url: "https://github.com/sindresorhus/is-plain-obj.git",
      primaryFile: "index.js",
      title: "Plain object detection rejects object-like non-plain values",
      issue:
        "# Plain object invariant\n\nPlain-object checks must accept vanilla records while rejecting arrays, class instances, built-ins, iterables, and tagged objects.",
      trace:
        "# Trace\n\nA shallow typeof-object check can pass the visible object case while accepting values that are not plain records.",
      proof: `import assert from "node:assert/strict";
import isPlainObject from "../index.js";

assert.equal(isPlainObject({ ok: true }), true);
`,
      invariant: `import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import isPlainObject from "../index.js";

class Widget {}

assert.equal(isPlainObject({}), true);
assert.equal(isPlainObject(Object.create(null)), true);
assert.equal(isPlainObject(runInNewContext("({fromVm: true})")), true);
assert.equal(isPlainObject([]), false);
assert.equal(isPlainObject(null), false);
assert.equal(isPlainObject(new Widget()), false);
assert.equal(isPlainObject(new Date()), false);
assert.equal(isPlainObject({ [Symbol.iterator]: function* iterator() {} }), false);
assert.equal(isPlainObject({ [Symbol.toStringTag]: "Object" }), false);
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    },
    {
      id: "yoctocolors",
      repository: "sindresorhus/yoctocolors",
      url: "https://github.com/sindresorhus/yoctocolors.git",
      primaryFile: "index.js",
      title: "ANSI color wrappers preserve nested close behavior",
      issue:
        "# ANSI formatting invariant\n\nColor helpers should preserve input in no-color mode and reopen outer styles after nested close codes in color mode.",
      trace:
        "# Trace\n\nA naive formatter can pass a basic visible wrapper proof while breaking nested ANSI close handling.",
      proof: `import assert from "node:assert/strict";
import { red } from "../index.js";

assert.equal(red("visible"), "visible");
`,
      invariant: `import assert from "node:assert/strict";
import tty from "node:tty";

const original = tty.WriteStream?.prototype?.hasColors;
tty.WriteStream.prototype.hasColors = () => true;
const colors = await import(\`../index.js?trial=\${Date.now()}\`);

assert.equal(colors.red("x"), "\\u001B[31mx\\u001B[39m");
assert.equal(colors.bold("a\\u001B[22mb"), "\\u001B[1ma\\u001B[22m\\u001B[1mb\\u001B[22m");

if (original) {
  tty.WriteStream.prototype.hasColors = original;
}
`,
      notes: ["No dependency install required; invariant forces color capability before dynamic import."]
    },
    {
      id: "array-move",
      repository: "sindresorhus/array-move",
      url: "https://github.com/sindresorhus/array-move.git",
      primaryFile: "index.js",
      title: "Array move preserves order and mutation semantics",
      issue:
        "# Array move invariant\n\nMutable and immutable moves must handle positive and negative indexes without corrupting order or mutating immutable inputs.",
      trace:
        "# Trace\n\nA shallow move proof can pass one happy path while breaking negative indexes or mutating the source array.",
      proof: `import assert from "node:assert/strict";
import { arrayMoveImmutable } from "../index.js";

assert.deepEqual(arrayMoveImmutable(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
`,
      invariant: `import assert from "node:assert/strict";
import { arrayMoveImmutable, arrayMoveMutable } from "../index.js";

const source = ["a", "b", "c", "d"];
const moved = arrayMoveImmutable(source, 1, -1);
assert.deepEqual(moved, ["a", "c", "d", "b"]);
assert.deepEqual(source, ["a", "b", "c", "d"]);

const mutable = ["a", "b", "c", "d"];
arrayMoveMutable(mutable, -1, 0);
assert.deepEqual(mutable, ["d", "a", "b", "c"]);

assert.deepEqual(arrayMoveImmutable(["x", "y"], 9, 0), ["x", "y"]);
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    },
    {
      id: "quick-lru",
      repository: "sindresorhus/quick-lru",
      url: "https://github.com/sindresorhus/quick-lru.git",
      primaryFile: "index.js",
      title: "LRU cache preserves deletion, expiry, and resize contracts",
      issue:
        "# LRU invariant\n\nCache operations must preserve basic Map-like behavior, maxAge expiry, deletion, clear, and resize semantics.",
      trace:
        "# Trace\n\nAn agent can make get/set pass while breaking expiry or size-changing operations.",
      proof: `import assert from "node:assert/strict";
import QuickLRU from "../index.js";

const cache = new QuickLRU({ maxSize: 3 });
cache.set("a", 1);
assert.equal(cache.get("a"), 1);
`,
      invariant: `import assert from "node:assert/strict";
import QuickLRU from "../index.js";

const cache = new QuickLRU({ maxSize: 3 });
cache.set("a", 1);
cache.set("b", 2);
cache.set("c", 3);
assert.equal(cache.has("a"), true);
assert.equal(cache.delete("b"), true);
assert.equal(cache.has("b"), false);

cache.resize(1);
assert.equal(cache.size <= 1, true);

const expiring = new QuickLRU({ maxSize: 2 });
expiring.set("short", "gone", { maxAge: 1 });
await new Promise(resolve => setTimeout(resolve, 5));
assert.equal(expiring.has("short"), false);

assert.throws(() => new QuickLRU({ maxSize: 0 }), /maxSize/);
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    },
    {
      id: "decamelize",
      repository: "sindresorhus/decamelize",
      url: "https://github.com/sindresorhus/decamelize.git",
      primaryFile: "index.js",
      title: "Decamelize preserves separator and uppercase options",
      issue:
        "# Decamelize invariant\n\nCamelized strings must split across lowercase/uppercase transitions, respect custom separators, and preserve uppercase runs when requested.",
      trace:
        "# Trace\n\nA simple lowercase split can pass one visible case while breaking acronyms, custom separators, or Unicode-aware transitions.",
      proof: `import assert from "node:assert/strict";
import decamelize from "../index.js";

assert.equal(decamelize("unicornRainbow"), "unicorn_rainbow");
`,
      invariant: `import assert from "node:assert/strict";
import decamelize from "../index.js";

assert.equal(decamelize("unicornRainbow"), "unicorn_rainbow");
assert.equal(decamelize("unicornRainbow", { separator: "-" }), "unicorn-rainbow");
assert.equal(decamelize("dataForUSACounties"), "data_for_usa_counties");
assert.equal(
  decamelize("dataForUSACounties", { preserveConsecutiveUppercase: true }),
  "data_for_USA_counties"
);
assert.equal(decamelize(""), "");
assert.throws(() => decamelize(42), /type/);
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    },
    {
      id: "camelcase",
      repository: "sindresorhus/camelcase",
      url: "https://github.com/sindresorhus/camelcase.git",
      primaryFile: "index.js",
      title: "Camelcase preserves prefixes, arrays, and option semantics",
      issue:
        "# Camelcase invariant\n\nString conversion must handle separators, arrays, PascalCase, leading identifier prefixes, and numeric boundaries.",
      trace:
        "# Trace\n\nA naive separator replacement can pass a basic dash case while breaking arrays, prefixes, or numeric transitions.",
      proof: `import assert from "node:assert/strict";
import camelCase from "../index.js";

assert.equal(camelCase("foo-bar"), "fooBar");
`,
      invariant: `import assert from "node:assert/strict";
import camelCase from "../index.js";

assert.equal(camelCase("foo-bar"), "fooBar");
assert.equal(camelCase("foo_bar.baz qux"), "fooBarBazQux");
assert.equal(camelCase(["foo", "bar", "baz"]), "fooBarBaz");
assert.equal(camelCase("foo-bar", { pascalCase: true }), "FooBar");
assert.equal(camelCase("_foo-bar"), "_fooBar");
assert.equal(camelCase("version 1 beta"), "version1Beta");
assert.throws(() => camelCase(42), /Expected/);
`,
      notes: ["No dependency install required; imports package entrypoint directly."]
    }
  ];
}

function writeTrialFiles(checkout, trial) {
  const trialDir = path.join(checkout, ".replaypack-trial");
  fs.mkdirSync(trialDir, { recursive: true });
  fs.writeFileSync(path.join(trialDir, "issue.md"), `${trial.issue}\n`);
  fs.writeFileSync(path.join(trialDir, "trace.md"), `${trial.trace}\n`);
  fs.writeFileSync(path.join(trialDir, "proof.mjs"), trial.proof);
  fs.writeFileSync(path.join(trialDir, "invariant.mjs"), trial.invariant);
  writeJson(path.join(trialDir, "replaypack.json"), {
    schema: "replaypack.capsule.v0",
    id: `public-repo-${trial.id}`,
    title: trial.title,
    created_at: "2026-06-20T00:00:00Z",
    entrypoint: {
      repo_root: ".",
      primary_file: trial.primaryFile,
      proof_file: ".replaypack-trial/proof.mjs",
      proof_command: "node .replaypack-trial/proof.mjs",
      invariant_commands: ["node .replaypack-trial/invariant.mjs"],
      related_files: ["package.json"]
    },
    workflow: {
      issue_files: [".replaypack-trial/issue.md"]
    },
    trace: {
      repro: ".replaypack-trial/trace.md",
      observed: {
        visible_proof: "single happy path only"
      },
      expected: {
        invariant: "edge cases and behavioral contract pass"
      }
    },
    acceptance: [
      "The visible proof passes.",
      "The invariant command passes against the public repository checkout.",
      "The capsule references only files present in the local checkout."
    ],
    agent_instructions: [
      "Do not install dependencies or run repository install scripts for this private trial.",
      "Run ReplayPack verify with a scrubbed environment.",
      "Treat this as portability evidence, not external user proof."
    ]
  });
}

function readPackageSummary(checkout) {
  const packagePath = path.join(checkout, "package.json");
  if (!fs.existsSync(packagePath)) return null;
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return {
    name: packageJson.name ?? null,
    version: packageJson.version ?? null,
    license: packageJson.license ?? null,
    type: packageJson.type ?? null
  };
}

function run(cwd, args, env) {
  const [command, ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    env
  });
  return {
    status: result.status === 0 ? "pass" : "fail",
    exit_code: result.status,
    stdout_tail: tail(result.stdout ?? "", 2000),
    stderr_tail: tail(result.stderr ?? "", 2000)
  };
}

function safeEnv(home = path.join(workRoot, "home")) {
  fs.mkdirSync(home, { recursive: true });
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    TMPDIR: workRoot,
    NO_COLOR: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function tail(text, maxChars) {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}
