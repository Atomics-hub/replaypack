#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "docs/validation/evidence-manifest.json");
const manifest = readJson(manifestPath);
const errors = [];
const provenStatuses = new Set(["proven", "proven_small_sample", "proven_pre_publish"]);
const boundaryStatuses = new Set(["not_proven", "pending_current_version_publish"]);

expect(manifest.schema === "replaypack.validation.evidence_manifest.v0", "schema must be evidence_manifest.v0");
expect(Array.isArray(manifest.claims) && manifest.claims.length > 0, "claims must be a non-empty array");

const claimIds = new Set();
for (const claim of manifest.claims ?? []) {
  validateClaim(claim);
}

const requiredClaimIds = [
  "proofbench_mechanism",
  "agentbench_deterministic_loop",
  "agent_brief_handoff",
  "codex_live_recovery",
  "claude_code_live_recovery",
  "codex_full_generation",
  "codex_generated_brief_full_generation",
  "claude_code_full_generation",
  "packed_package_trial",
  "external_user_proof",
  "broad_large_sample_full_generation"
];

for (const id of requiredClaimIds) {
  expect(claimIds.has(id), `missing required claim ${id}`);
}

const provenCount = (manifest.claims ?? []).filter((claim) => provenStatuses.has(claim.status)).length;
const boundaryCount = (manifest.claims ?? []).filter((claim) => boundaryStatuses.has(claim.status)).length;

if (errors.length > 0) {
  console.error("ReplayPack evidence manifest: fail");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`ReplayPack evidence manifest: pass

Claims checked:
  proven: ${provenCount}
  boundary/pending: ${boundaryCount}
  total: ${(manifest.claims ?? []).length}

Current boundary:
  external user proof is not recorded
  npm 0.2.1 publish receipt is not recorded
`);

function validateClaim(claim) {
  const label = claim?.id ?? "unknown";

  expect(Boolean(claim?.id), "claim id is required");
  if (claim?.id) {
    expect(!claimIds.has(claim.id), `duplicate claim id ${claim.id}`);
    claimIds.add(claim.id);
  }

  expect(Boolean(claim?.claim), `${label}: claim text is required`);
  expect(provenStatuses.has(claim?.status) || boundaryStatuses.has(claim?.status), `${label}: unsupported status ${claim?.status}`);
  expect(Array.isArray(claim?.assertions) && claim.assertions.length > 0, `${label}: assertions are required`);

  for (const evidencePath of claim?.evidence ?? []) {
    const hasMissingFileAssertion = claim.assertions?.some(
      (assertion) => assertion.file === evidencePath && assertion.op === "missing_file"
    );
    if (!hasMissingFileAssertion) {
      expect(fs.existsSync(path.join(root, evidencePath)), `${label}: evidence file is missing: ${evidencePath}`);
    }
  }

  for (const assertion of claim?.assertions ?? []) {
    validateAssertion(label, assertion);
  }
}

function validateAssertion(claimId, assertion) {
  const file = assertion?.file;
  const op = assertion?.op;
  expect(Boolean(file), `${claimId}: assertion file is required`);
  expect(Boolean(op), `${claimId}: assertion op is required`);
  if (!file || !op) return;

  const filePath = path.join(root, file);

  if (op === "missing_file") {
    expect(!fs.existsSync(filePath), `${claimId}: expected file to be missing: ${file}`);
    return;
  }

  if (op === "file_exists") {
    expect(fs.existsSync(filePath), `${claimId}: expected file to exist: ${file}`);
    return;
  }

  expect(fs.existsSync(filePath), `${claimId}: assertion file is missing: ${file}`);
  if (!fs.existsSync(filePath)) return;

  const data = readJson(filePath);
  const actual = valueAtPath(data, assertion.path);
  const expected = assertion.value;

  switch (op) {
    case "eq":
      expect(Object.is(actual, expected), `${claimId}: ${file}:${assertion.path} expected ${format(expected)} got ${format(actual)}`);
      break;
    case "ne":
      expect(!Object.is(actual, expected), `${claimId}: ${file}:${assertion.path} should not equal ${format(expected)}`);
      break;
    case "gte":
      expect(actual >= expected, `${claimId}: ${file}:${assertion.path} expected >= ${format(expected)} got ${format(actual)}`);
      break;
    case "gt":
      expect(actual > expected, `${claimId}: ${file}:${assertion.path} expected > ${format(expected)} got ${format(actual)}`);
      break;
    case "lte":
      expect(actual <= expected, `${claimId}: ${file}:${assertion.path} expected <= ${format(expected)} got ${format(actual)}`);
      break;
    case "lt":
      expect(actual < expected, `${claimId}: ${file}:${assertion.path} expected < ${format(expected)} got ${format(actual)}`);
      break;
    case "exists":
      expect(actual !== undefined, `${claimId}: ${file}:${assertion.path} must exist`);
      break;
    default:
      expect(false, `${claimId}: unsupported assertion op ${op}`);
  }
}

function valueAtPath(data, dottedPath) {
  if (!dottedPath) return data;

  return dottedPath.split(".").reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (segment === "length") return current.length;
    if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)];
    return current[segment];
  }, data);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function expect(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function format(value) {
  return JSON.stringify(value);
}
