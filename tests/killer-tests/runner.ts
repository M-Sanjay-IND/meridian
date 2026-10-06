/**
 * Killer Tests Runner CLI
 * Supports:
 *   npm run test:killer
 *   npm run test:killer -- --test=kt2
 *   npm run test:killer -- --test=kt3b
 * Owned by: DEV D (Verification)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rawArgs = process.argv.slice(2);
let testPattern = "";

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith("--test=")) {
    testPattern = arg.slice("--test=".length).toLowerCase();
  } else if (arg === "--test" && rawArgs[i + 1]) {
    testPattern = rawArgs[++i].toLowerCase();
  } else if (!arg.startsWith("-")) {
    testPattern = arg.toLowerCase();
  }
}

const vitestArgs = ["vitest", "run"];

if (testPattern) {
  const dir = path.resolve(process.cwd(), "tests/killer-tests");
  const files = fs.readdirSync(dir).filter(
    (f) => f.toLowerCase().includes(testPattern) && (f.endsWith(".test.ts") || f.endsWith(".spec.ts"))
  );
  if (files.length > 0) {
    vitestArgs.push(...files.map((f) => path.join("tests/killer-tests", f)));
  } else {
    vitestArgs.push("tests/killer-tests", "-t", testPattern);
  }
} else {
  vitestArgs.push("tests/killer-tests");
}

const result = spawnSync("npx", vitestArgs, { stdio: "inherit" });
process.exit(result.status ?? 0);
