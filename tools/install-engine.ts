/**
 * Packs the tse engine from a sibling checkout (../tse, or TSE_DIR) and installs the packs here without saving them, so
 * package.json keeps its plain `0.0.0` versions. The engine is not on npm yet; this is the loop until it is.
 *
 *   node tools/install-engine.ts          # pack ../tse and install
 *   TSE_DIR=/path/to/tse node tools/install-engine.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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
const tarballs = readdirSync(packs)
  .filter((file) => /^tsengine-.+\.tgz$/.test(file))
  .map((file) => join(packs, file));
execFileSync("npm", ["install", "--no-save", "--no-audit", "--no-fund", ...tarballs, "@types/node@^22.10.0"], {
  cwd: root,
  stdio: "inherit",
});
console.log("engine installed: npm run check");
