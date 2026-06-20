#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const verdict = required(options.verdict, "--verdict");
if (!["pass", "fail"].includes(verdict)) {
  throw new Error("--verdict must be pass or fail");
}

const source = loadSource(options);
const sections = parseIssueSections(source.body);
const commandsText = section(sections, "Commands run");
const quotePermission = section(sections, "Quote permission");
const commands = [...parseCommands(commandsText), ...parseTrialSummaries(commandsText)];
const oneMinute = section(sections, "One-minute read");
const invariantUnderstanding = section(sections, "Invariant vs visible proof");
const adoption = section(sections, "Would you use it?");
const objection = section(sections, "First objection");
const codingAgentWorkflow = section(sections, "Coding-agent workflow");
const receiptLine = commandsText.split(/\r?\n/).find((line) => /receipt:/i.test(line)) ?? "";

const reviewErrors = reviewExternalTrial({
  verdict,
  commands,
  oneMinute,
  invariantUnderstanding,
  adoption,
  objection,
  commandsText
});

if (reviewErrors.length > 0 && verdict === "pass") {
  console.error("External user proof cannot be recorded as pass:");
  for (const error of reviewErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const proof = {
  schema: "replaypack.validation.external_user_proof.v0",
  checked_at: new Date().toISOString(),
  source,
  trial_runner: {
    relationship: options.relationship ?? "external developer not involved in building ReplayPack",
    name_or_alias: options.alias ?? source.author ?? "",
    permission_to_quote: quotePermission,
    coding_agent_workflow: codingAgentWorkflow
  },
  repo_visibility_during_trial: options.repoVisibility ?? "PUBLIC",
  trial_doc: "docs/trials/external-developer-trial.md",
  trial_receipt: {
    referenced: Boolean(receiptLine),
    line: receiptLine || null
  },
  commands_run: commands,
  comprehension: {
    one_minute_explanation: oneMinute,
    invariant_vs_visible_proof: invariantUnderstanding,
    understood_not_just_tests: !looksNegative(invariantUnderstanding),
    would_try_on_agent_pr_repo: !looksNegative(adoption),
    adoption_response: adoption
  },
  objections: objection ? [objection] : [],
  doc_or_product_changes_needed: options.changes ? [options.changes] : [],
  review: {
    reviewer: options.reviewer ?? null,
    errors: reviewErrors
  },
  verdict
};

const outPath = path.join(root, options.out ?? "docs/validation/external-user-proof.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));

function loadSource(opts) {
  if (opts.file) {
    const filePath = path.resolve(root, opts.file);
    return {
      kind: "issue_form_file",
      file: path.relative(root, filePath),
      url: opts.url ?? null,
      author: opts.author ?? null,
      title: opts.title ?? null,
      body: fs.readFileSync(filePath, "utf8")
    };
  }

  if (opts.issue) {
    const issue = runGh(["issue", "view", opts.issue, "--json", "number,title,body,author,url,createdAt"]);
    return {
      kind: "github_issue",
      number: issue.number,
      url: issue.url,
      author: issue.author?.login ?? null,
      title: issue.title,
      created_at: issue.createdAt,
      body: issue.body
    };
  }

  throw new Error("Provide --issue <number-or-url> or --file <issue-form.md>");
}

function parseIssueSections(markdown) {
  const sections = new Map();
  const headingPattern = /^###\s+(.+?)\s*$/gm;
  const matches = [...markdown.matchAll(headingPattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = normalizeLabel(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? markdown.length : markdown.length;
    sections.set(title, markdown.slice(start, end).trim());
  }
  return sections;
}

function section(sections, label) {
  return sections.get(normalizeLabel(label)) ?? "";
}

function normalizeLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCommands(text) {
  const commands = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*]\s+/, "");
    if (!line) continue;
    const match = line.match(/^(.*?)\s*(?:->|:)\s*(pass|passed|fail|failed|failed as expected|nonzero|ok)\b/i);
    if (!match) continue;
    commands.push({
      command: match[1].trim(),
      status: normalizeStatus(match[2]),
      raw: line
    });
  }
  return commands;
}

function parseTrialSummaries(text) {
  const summaries = [];
  const wrong = text.match(/wrong demo:\s*proof=ok\s+invariant=(nonzero|fail|failed)\s+replaypack=fail/i);
  if (wrong) {
    summaries.push({
      command: "wrong demo",
      status: "fail",
      expected_failure: true,
      raw: wrong[0]
    });
  }
  const fixed = text.match(/fixed demo:\s*proof=ok\s+invariant=ok\s+replaypack=pass/i);
  if (fixed) {
    summaries.push({
      command: "fixed demo",
      status: "pass",
      raw: fixed[0]
    });
  }
  const dogfood = text.match(/dogfood:\s*proof=ok\s+invariant=ok\s+replaypack=pass/i);
  if (dogfood) {
    summaries.push({
      command: "dogfood",
      status: "pass",
      raw: dogfood[0]
    });
  }
  return summaries;
}

function normalizeStatus(value) {
  const normalized = value.toLowerCase();
  if (["pass", "passed", "ok"].includes(normalized)) return "pass";
  if (["fail", "failed", "failed as expected", "nonzero"].includes(normalized)) return "fail";
  return normalized;
}

function reviewExternalTrial({ verdict, commands, oneMinute, invariantUnderstanding, adoption, objection, commandsText }) {
  const errors = [];
  expect(Boolean(oneMinute), errors, "one-minute explanation is required");
  expect(Boolean(invariantUnderstanding), errors, "invariant-vs-visible-proof response is required");
  expect(Boolean(adoption), errors, "adoption response is required");
  expect(Boolean(objection), errors, "first objection is required");
  expect(!looksNegative(invariantUnderstanding), errors, "invariant-vs-visible-proof response appears negative");
  expect(commands.some((item) => isTrialCommand(item.command) && item.status === "pass"), errors, "trial command must be recorded as pass");
  expect(/wrong demo:.*proof=ok.*invariant=(nonzero|fail|failed).*replaypack=fail/is.test(commandsText), errors, "wrong demo summary must show proof ok and ReplayPack fail");
  expect(/fixed demo:.*proof=ok.*invariant=ok.*replaypack=pass/is.test(commandsText), errors, "fixed demo summary must show proof ok and ReplayPack pass");
  expect(/dogfood:.*proof=ok.*invariant=ok.*replaypack=pass/is.test(commandsText), errors, "dogfood summary must show proof ok and ReplayPack pass");

  if (verdict === "fail") {
    return errors;
  }
  return errors;
}

function looksNegative(text) {
  return /\b(no|nope|not really|did not|didn't|unclear|confusing|confused|do not|don't)\b/i.test(text);
}

function isTrialCommand(command) {
  return command.includes("trial:external") || /replaypack(\.mjs)?\s+trial/.test(command);
}

function expect(condition, errors, message) {
  if (!condition) {
    errors.push(message);
  }
}

function runGh(args) {
  const result = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else {
      parsed[key] = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function required(value, label) {
  if (!value) {
    throw new Error(`Missing required argument ${label}`);
  }
  return value;
}

function printHelp() {
  console.log(`ReplayPack external user proof recorder

Usage:
  node scripts/record-external-user-proof.mjs --issue 2 --verdict pass --reviewer <name>
  node scripts/record-external-user-proof.mjs --file .tmp/external-issue.md --verdict pass --out .tmp/external-user-proof.json

Notes:
  This script records reviewed external-user proof. It does not create proof by itself.
  Use --verdict pass only after reviewing that the issue was filed by someone outside ReplayPack.
`);
}
