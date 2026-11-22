import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

// An advisory checkout-local receipt. Deployment builds always run their own
// checks; neither this receipt nor a caller-provided flag authorizes a build.
const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const receiptPath = join(root, ".next/cache/kylon-validation/success.json");
const excluded = new Set([
  ".git",
  ".next",
  "node_modules",
  "generated",
  "dist",
  "coverage",
  "output",
  ".data",
  ".playwright-cli",
  ".chrome-mcp-profile",
]);
const startedAt = performance.now();
let cacheable = true;

function hashTree(hash, path, label, filter = () => true) {
  if (!existsSync(path)) {
    hash.update(`${label}:missing\0`);
    return;
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    // Arbitrary source symlinks can point outside the input tree or form cycles.
    cacheable = false;
    hash.update(`${label}:symlink\0`);
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path).sort()) {
      if (filter(entry)) hashTree(hash, join(path, entry), `${label}/${entry}`, filter);
    }
  } else if (stat.isFile()) {
    hash.update(`${label}\0`).update(readFileSync(path)).update("\0");
  }
}

function sourceKey() {
  const hash = createHash("sha256");
  hashTree(
    hash,
    root,
    ".",
    (name) => !excluded.has(name) && name !== "next-env.d.ts" && !name.endsWith(".tsbuildinfo"),
  );
  // Include workspace installs as well as standalone pulls. Lockfiles alone
  // cannot distinguish a newly installed dependency tree from an older one.
  for (let dir = root; ; dir = dirname(dir)) {
    for (const name of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "node_modules/.modules.yaml"]) {
      const path = join(dir, name);
      if (existsSync(path)) hashTree(hash, path, path);
    }
    if (dirname(dir) === dir) break;
  }
  for (const name of ["next", "typescript", "typescript-native", "tsx"]) {
    const path = require.resolve(`${name}/package.json`);
    hash.update(realpathSync(path)).update(readFileSync(path));
  }
  // Git's hook dispatcher changes process metadata, not build inputs. Keep
  // arbitrary npm/application variables; remove only known invocation metadata
  // and the helper directory Git prepends to PATH before launching the hook.
  const metadata = new Set([
    "KYLON_VALIDATE_REUSE",
    "PWD",
    "OLDPWD",
    "SHLVL",
    "_",
    "INIT_CWD",
    "GIT_EXEC_PATH",
    "GIT_PREFIX",
  ]);
  const environment = Object.entries(process.env)
    .filter(([name]) => !metadata.has(name))
    .map(([name, value]) => {
      if (name !== "PATH" || !process.env.GIT_EXEC_PATH) return [name, value];
      const entries = value.split(delimiter);
      const helper = entries.indexOf(process.env.GIT_EXEC_PATH);
      if (helper >= 0) entries.splice(helper, 1);
      return [name, entries.join(delimiter)];
    })
    .sort(([a], [b]) => a.localeCompare(b));
  hash.update(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      environment,
    }),
  );
  return hash.digest("hex");
}

function outputKey() {
  const hash = createHash("sha256");
  for (const name of ["generated", ".next/types", ".next/dev/types", "next-env.d.ts"]) {
    hashTree(hash, join(root, name), name);
  }
  return hash.digest("hex");
}

function report(stage, durationMs, outcome, extra = {}) {
  console.log(
    JSON.stringify({
      event: "app_validation.stage",
      stage,
      durationMs: Math.round(durationMs),
      outcome,
      ...extra,
    }),
  );
}

function run(stage, args) {
  const start = performance.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  report(stage, performance.now() - start, result.status === 0 ? "success" : "error");
  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
}

const fingerprintStartedAt = performance.now();
const source = sourceKey();
const outputs = outputKey();
report("fingerprint", performance.now() - fingerprintStartedAt, "success");
let receipt;
try {
  receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
} catch {
  /* A missing or corrupt receipt requires validation. */
}
const reuse = process.env.KYLON_VALIDATE_REUSE === "1" && !process.env.CI && !process.env.VERCEL;
if (
  reuse &&
  cacheable &&
  receipt?.version === 1 &&
  receipt.source === source &&
  receipt.outputs === outputs
) {
  report("total", performance.now() - startedAt, "success", { cacheHit: true });
  process.exit(0);
}
rmSync(receiptPath, { force: true });
run("generate_contracts", ["--import", "tsx", "scripts/generate-contracts.ts"]);
run("route_types", [require.resolve("next/dist/bin/next"), "typegen"]);
const checkedOutputs = outputKey();
run("typecheck", [resolve(root, "node_modules/typescript-native/bin/tsc"), "--noEmit"]);
// A concurrent edit must never earn a receipt for bytes the checker did not
// validate. Generated outputs are captured immediately before the checker.
const stable = sourceKey() === source && outputKey() === checkedOutputs && cacheable;
if (stable) {
  mkdirSync(dirname(receiptPath), { recursive: true });
  const temporaryPath = `${receiptPath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify({ version: 1, source, outputs: checkedOutputs }));
  renameSync(temporaryPath, receiptPath);
}
report("total", performance.now() - startedAt, "success", { cacheHit: false, reusable: stable });
