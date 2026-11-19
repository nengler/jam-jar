/**
 * Packs the tse engine from a sibling checkout (../tse, or TSE_DIR) and installs the packs here, to try an engine change before it
 * is released. package.json and the lockfile are left pointing at the release they name; only node_modules changes, and a plain
 * `npm install` goes back to the release.
 *
 *   node tools/install-engine.ts          # pack ../tse and install
 *   TSE_DIR=/path/to/tse node tools/install-engine.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tse = resolve(process.env["TSE_DIR"] ?? join(root, "..", "tse"));
if (!existsSync(join(tse, "tools", "pack.ts"))) throw new Error(`no tse checkout at ${tse}: set TSE_DIR`);

// `npm ci` installs from the lockfile without rewriting it, so the tse checkout stays clean.
execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: tse, stdio: "inherit" });
if (!existsSync(join(tse, "native", "build-headless")))
  execFileSync("npm", ["run", "-s", "native:build:headless"], { cwd: tse, stdio: "inherit" });
execFileSync("npm", ["run", "-s", "pack"], { cwd: tse, stdio: "inherit" });

const packs = join(tse, "dist", "packs");
const tarballs = new Map(
  readdirSync(packs)
    .map((file) => [/^tsengine-(.+)-\d+\.\d+\.\d+.*\.tgz$/.exec(file)?.[1], join(packs, file)] as const)
    .filter((entry): entry is readonly [string, string] => entry[0] !== undefined)
);

// package.json points @tsengine/* (dependencies and overrides) at a release. For the install, point them at the local packs
// instead, then put package.json and the lockfile back as they were: only node_modules changes.
const manifestPath = join(root, "package.json");
const lockPath = join(root, "package-lock.json");
const manifest = readFileSync(manifestPath, "utf8");
const lock = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : null;
const local = (deps: Record<string, string> | undefined) =>
  deps === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(deps).map(([name, range]) => {
          const pack = name.startsWith("@tsengine/") ? tarballs.get(name.slice("@tsengine/".length)) : undefined;
          return [name, pack === undefined ? range : `file:${pack}`];
        })
      );
const pkg = JSON.parse(manifest) as Record<string, Record<string, string> | undefined>;
writeFileSync(
  manifestPath,
  JSON.stringify({ ...pkg, dependencies: local(pkg["dependencies"]), devDependencies: local(pkg["devDependencies"]), overrides: local(pkg["overrides"]) }, null, 2)
);
try {
  execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: root, stdio: "inherit" });
} finally {
  writeFileSync(manifestPath, manifest);
  if (lock === null) rmSync(lockPath, { force: true });
  else writeFileSync(lockPath, lock);
}
console.log("engine installed from ../tse: npm run check");
