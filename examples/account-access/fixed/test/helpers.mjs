import fs from "node:fs";
import path from "node:path";
import { resolveExportAccess } from "../src/access.js";

export { resolveExportAccess };

export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.resolve("fixtures/state", name), "utf8"));
}
