// Composition check for a story. Usage: node check-shots.mjs <story data .ts> [animations.glb] [out.json]
// Uses esbuild, which ships with Remotion, so nothing needs installing. Exit code 2 means issues were found.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
const require = createRequire(import.meta.url);
const [data, ...rest] = process.argv.slice(2);
if (!data) { console.error("Usage: node check-shots.mjs <story data .ts> [animations.glb] [out.json]"); process.exit(1); }
const esbuild = require("esbuild");
const common = { bundle: true, platform: "node", format: "esm", external: ["three", "three/*"], logLevel: "error", banner: { js: 'import {createRequire} from "module"; const require=createRequire(import.meta.url);' } };
esbuild.buildSync({ ...common, entryPoints: [data], outfile: data.replace(/\.ts$/, ".mjs") });
esbuild.buildSync({ ...common, entryPoints: [path.join(import.meta.dirname, "check-shots.ts")], outfile: path.join(import.meta.dirname, ".check-shots.bundle.mjs") });
const r = spawnSync(process.execPath, [path.join(import.meta.dirname, ".check-shots.bundle.mjs"), data, ...rest], { stdio: "inherit" });
process.exit(r.status ?? 1);
