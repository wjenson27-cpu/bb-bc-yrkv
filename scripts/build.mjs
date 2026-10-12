/**
 * Production bundle. Rewrites the test-build flag and strips every
 * TEST_HOOK block so localhost cannot reach a roll hook.
 */
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const name of ["index.html", "table", "js", "css", "assets", "robots.txt"]) {
  cpSync(join(root, name), join(dist, name), { recursive: true });
}

function strip(text) {
  return text
    .replace(/\/\*TEST_HOOK_START\*\/[\s\S]*?\/\*TEST_HOOK_END\*\//g, "")
    .replace("export const TEST_BUILD = true;", "export const TEST_BUILD = false;");
}

for (const rel of ["js/build-flags.mjs", "js/ui.mjs", "js/table-ui.mjs"]) {
  const path = join(dist, rel);
  writeFileSync(path, strip(readFileSync(path, "utf8")));
}

const flags = readFileSync(join(dist, "js/build-flags.mjs"), "utf8");
const ui = readFileSync(join(dist, "js/ui.mjs"), "utf8");
const engine = readFileSync(join(dist, "js/engine.mjs"), "utf8");
if (!/TEST_BUILD = false/.test(flags)) throw new Error("flag not stripped");
if (/__bb/.test(ui)) throw new Error("hook left in ui");
if (/Math\.random\(/.test(engine)) throw new Error("Math.random left in engine");
console.log("dist ready");
