#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? process.cwd());
const capsulePath = path.resolve(root, required(args.capsule, "<capsule>"));
const outPath = args.out ? path.resolve(root, args.out) : null;
const capsule = readJson(capsulePath);
const capsuleRel = relativePath(root, capsulePath);
const brief = renderBrief(capsule, capsuleRel);

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, brief);
  console.log(`Wrote ${relativePath(root, outPath)}`);
} else {
  process.stdout.write(brief);
}

function renderBrief(value, capsuleReference) {
  const lines = [];
  const proofCommand = value?.entrypoint?.proof_command ?? "(missing entrypoint.proof_command)";
  const invariantCommands = toArray(value?.entrypoint?.invariant_commands).filter(Boolean);
  const issueFiles = toReferencePaths(value?.workflow?.issue_files);
  const traceFiles = [
    ...toReferencePaths(value?.trace?.browser_repro),
    ...toReferencePaths(value?.trace?.http_repro),
    ...toReferencePaths(value?.trace?.repro)
  ];
  const entrypointFiles = collectEntrypointFiles(value);
  const stateFiles = collectNamedReferences(value?.state);
  const mockFiles = collectNamedReferences(value?.mocks);
  const verifyCommand = `npx replaypack verify ${shellQuote(capsuleReference)} --out dist/replaypack-verify.json`;
  const checkoutVerifyCommand = fs.existsSync(path.join(root, "bin", "replaypack.mjs"))
    ? `node bin/replaypack.mjs verify ${shellQuote(capsuleReference)} --out dist/replaypack-verify.json`
    : null;

  lines.push("# ReplayPack Agent Brief", "");
  lines.push(`Capsule: \`${capsuleReference}\``);
  lines.push(`ID: \`${value?.id ?? "unknown"}\``);
  lines.push(`Title: ${value?.title ?? "Untitled ReplayPack task"}`);
  lines.push(`Schema: \`${value?.schema ?? "unknown"}\``);
  lines.push("");

  lines.push("## Goal", "");
  lines.push("Make the smallest correct code change that satisfies the issue, visible proof, and ReplayPack invariants.");
  lines.push("Do not say done until ReplayPack verify passes.");
  lines.push("");

  lines.push("## Finish Gate", "");
  lines.push("Run one of these from the repo root after your edit:");
  lines.push("");
  lines.push("```bash");
  lines.push(verifyCommand);
  if (checkoutVerifyCommand) {
    lines.push("# from this repository checkout:");
    lines.push(checkoutVerifyCommand);
  }
  lines.push("```");
  lines.push("");
  lines.push("Done means the verification packet status is `pass`. If the visible proof passes but ReplayPack fails, repair the invariant failure and rerun the finish gate.");
  lines.push("");

  lines.push("## Commands", "");
  lines.push(`Visible proof: \`${proofCommand}\``);
  if (invariantCommands.length > 0) {
    lines.push("");
    lines.push("Invariant commands:");
    for (const command of invariantCommands) {
      lines.push(`- \`${command}\``);
    }
  } else {
    lines.push("");
    lines.push("Invariant commands: none listed in the capsule.");
  }
  lines.push("");

  addPathList(lines, "## Relevant Files", [
    ...entrypointFiles,
    ...stateFiles.map((item) => ({ kind: item.kind, path: item.path })),
    ...mockFiles.map((item) => ({ kind: item.kind, path: item.path }))
  ]);
  addPathList(lines, "## Issue Context", issueFiles.map((filePath) => ({ kind: "issue", path: filePath })));
  addPathList(lines, "## Trace Context", traceFiles.map((filePath) => ({ kind: "trace", path: filePath })));

  addTextBlock(lines, "## Acceptance", toArray(value?.acceptance));
  addTextBlock(lines, "## Agent Instructions", toArray(value?.agent_instructions));

  if (issueFiles.length > 0 || traceFiles.length > 0) {
    lines.push("## Context Excerpts", "");
    for (const filePath of [...issueFiles, ...traceFiles]) {
      addExcerpt(lines, filePath);
    }
  }

  lines.push("## Agent Loop", "");
  lines.push("1. Read the issue and trace context.");
  lines.push("2. Inspect the relevant source and proof files.");
  lines.push("3. Make the smallest contract-correct change.");
  lines.push("4. Run the finish gate.");
  lines.push("5. If ReplayPack fails, use the proof or invariant output as the next repair target and repeat.");
  lines.push("");

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function collectEntrypointFiles(value) {
  const entrypoint = value?.entrypoint ?? {};
  const files = [];
  for (const [kind, referencePath] of [
    ["primary", entrypoint.primary_file],
    ["proof", entrypoint.proof_file],
    ["http", entrypoint.http_surface]
  ]) {
    if (typeof referencePath === "string" && referencePath) {
      files.push({ kind, path: referencePath });
    }
  }
  for (const referencePath of toArray(entrypoint.related_files)) {
    if (typeof referencePath === "string" && referencePath) {
      files.push({ kind: "related", path: referencePath });
    }
  }
  return dedupeFiles(files);
}

function collectNamedReferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([, referencePath]) => typeof referencePath === "string" && referencePath)
    .map(([name, referencePath]) => ({ kind: name, path: referencePath }));
}

function addPathList(lines, heading, files) {
  const deduped = dedupeFiles(files);
  if (deduped.length === 0) {
    return;
  }
  lines.push(heading, "");
  for (const item of deduped) {
    const exists = fs.existsSync(path.resolve(root, item.path));
    lines.push(`- ${item.kind}: \`${normalizePath(item.path)}\`${exists ? "" : " (missing)"}`);
  }
  lines.push("");
}

function addTextBlock(lines, heading, items) {
  const cleanItems = items.filter((item) => typeof item === "string" && item.trim());
  if (cleanItems.length === 0) {
    return;
  }
  lines.push(heading, "");
  for (const item of cleanItems) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

function addExcerpt(lines, filePath) {
  const absolutePath = path.resolve(root, filePath);
  lines.push(`### ${normalizePath(filePath)}`, "");
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    lines.push("_Missing file._", "");
    return;
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  const excerpt = truncate(text.trim(), 3000);
  const fence = excerpt.includes("```") ? "````" : "```";
  lines.push(`${fence}text`);
  lines.push(excerpt || "(empty file)");
  lines.push(fence, "");
}

function dedupeFiles(files) {
  const seen = new Set();
  const deduped = [];
  for (const item of files) {
    if (!item?.path || seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    deduped.push({ kind: item.kind, path: item.path });
  }
  return deduped;
}

function toReferencePaths(value) {
  return toArray(value).flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item.path === "string") return [item.path];
    return [];
  });
}

function parseArgs(raw) {
  const parsed = { positional: [] };
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item.startsWith("--")) {
      parsed.positional.push(item);
      continue;
    }
    const [key, inlineValue] = item.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[toCamel(key)] = inlineValue;
    } else {
      parsed[toCamel(key)] = raw[index + 1];
      index += 1;
    }
  }
  parsed.capsule ??= parsed.positional[0];
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function required(value, label) {
  if (!value) {
    console.error(`Missing required argument ${label}`);
    process.exit(2);
  }
  return value;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function relativePath(fromRoot, filePath) {
  return normalizePath(path.relative(fromRoot, filePath) || ".");
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n... [truncated]`;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function printHelp() {
  console.log(`ReplayPack brief

Usage:
  replaypack brief <capsule>
  replaypack brief --root <repo-or-example> <capsule>
  replaypack brief --root <repo-or-example> <capsule> --out dist/agent-brief.md

Notes:
  Capsule paths and excerpts are resolved from --root when --root is provided.
  This command does not run proof or invariant commands.
  Review generated briefs before sharing them outside a private repo.
`);
}
