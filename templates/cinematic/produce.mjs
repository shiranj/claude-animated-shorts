#!/usr/bin/env node
// One entry point for the common production steps. It only calls the tools that already exist; it adds no new logic.
//
//   node produce.mjs doctor                                  check Node, Python, ffmpeg, GPU and assets
//   node produce.mjs check <data.ts | template:NAME>         composition check (heads, feet, watched props, camera speed)
//   node produce.mjs stills <entry> <Comp> <frames> [scale]  review stills, for example: stills index.ts FiveSeconds 40,150,300 0.5
//   node produce.mjs render <entry> <Comp> <out.mp4> [...]   measured render on the discrete GPU (extra flags go to render-measured.mjs)
//   node produce.mjs audio <audio.json> <outdir>             placeholder narration (Windows voice) + sound design -> <outdir>/mix.wav
//   node produce.mjs mux <video.mp4> <mix.wav> <out.mp4>     put the sound under the picture (normalised to about -16 LUFS)
//   node produce.mjs qa <video.mp4> <outdir> [qa-video flags] automatic video QA, contact sheet, phone-size sheets
//   node produce.mjs spec <NAME> [seconds]                   print the audio.json of a template (to edit and use with `audio`)
//
// Folders: run it from the Remotion project (the folder that has public/ and node_modules/). Paths are relative to the current folder.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const here = import.meta.dirname;
const [cmd, ...args] = process.argv.slice(2);
const run = (exe, a, opt = {}) => { const r = spawnSync(exe, a, { stdio: "inherit", ...opt }); return r.status ?? 1; };
const node = (script, a) => run(process.execPath, [path.join(here, script), ...a]);
const py = (script, a) => run(process.platform === "win32" ? "python" : "python3", ["-I", path.join(here, script), ...a]);
const need = (n, usage) => { if (args.length < n) { console.error("Usage: node produce.mjs " + usage); process.exit(1); } };

const tool = (exe, flag = "--version") => { const r = spawnSync(exe, [flag], { encoding: "utf8" }); return r.status === 0 ? (r.stdout || r.stderr).split("\n")[0].trim() : null; };

switch (cmd) {
  case "doctor": {
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    console.log(`Node    ${process.version} ${nodeMajor >= 18 && nodeMajor <= 22 ? "OK (18 to 22 tested; 22 used)" : "WARNING: use Node 18 to 22"}`);
    console.log(`Python  ${tool("python") ?? tool("python3") ?? "MISSING (install Python 3.10+)"}`);
    console.log(`ffmpeg  ${tool("ffmpeg", "-version") ?? "MISSING (install ffmpeg and put it on PATH)"}`);
    console.log(`public/ ${fs.existsSync("public") ? "found" : "MISSING: the folder with cinematic/ assets, see ASSETS.md"}`);
    console.log("--- assets"); const a = node("check-assets.mjs", []);
    console.log("--- GPU"); const g = node("check-gpu.mjs", []);
    process.exit(a === 0 && g === 0 ? 0 : 1);
  }
  case "check": {
    need(1, "check <story data .ts | template:NAME> [animations.glb] [out.json]");
    let data = args[0];
    if (data.startsWith("template:")) {
      const name = data.slice(9), tmp = path.join(here, `.tmp-${name}.ts`);
      fs.writeFileSync(tmp, `import { TEMPLATES, toCheckData } from "./story-templates/index";\nexport const STORY_DATA = toCheckData(TEMPLATES[${JSON.stringify(name)}]());\n`);
      data = tmp;
    }
    const code = node("check-shots.mjs", [data, ...args.slice(1)]);
    for (const f of [data.replace(/\.ts$/, ".mjs")]) if (path.basename(f).startsWith(".tmp-")) { fs.rmSync(f, { force: true }); fs.rmSync(data, { force: true }); }
    process.exit(code);
  }
  case "stills": need(3, "stills <entry> <Comp> <frames> [scale]"); process.exit(node("render-stills.mjs", [args[0], args[1], `out/${args[1]}_`, args[2], args[3] ?? "0.5"]));
  case "render": need(3, "render <entry> <Comp> <out.mp4> [--concurrency 4] [--public-dir dir]"); process.exit(node("render-measured.mjs", args.includes("--concurrency") ? args : [...args, "--concurrency", "4"]));
  case "audio": {
    need(2, "audio <audio.json> <outdir>");
    fs.mkdirSync(args[1], { recursive: true });
    const ps = path.join(here, "..", "audio", "narration_sapi.ps1"), voice = path.join(args[1], "voice");
    if (process.platform === "win32") { const c = run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps, args[0], voice]); if (c) process.exit(c); }
    else console.log("No Windows voice here: put your own <id>.wav files in " + voice + " (see narration ids in the JSON).");
    process.exit(run(process.platform === "win32" ? "python" : "python3", ["-I", path.join(here, "..", "audio", "story_sound.py"), args[0], path.join(args[1], "mix.wav"), "--voice-dir", voice]));
  }
  case "mux": need(3, "mux <video.mp4> <mix.wav> <out.mp4>"); process.exit(run("ffmpeg", ["-y", "-v", "error", "-i", args[0], "-i", args[1], "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", args[2]]));  // loudnorm: about -16 LUFS, the usual level for Shorts
  case "qa": need(2, "qa <video.mp4> <outdir> [--frames N --cuts a,b --fades a,b --shot-check file --render-report file]"); process.exit(py("qa-video.py", args));
  case "spec": {
    need(1, "spec <NAME> [seconds]");
    const require = createRequire(import.meta.url), esbuild = require("esbuild"), out = path.join(here, `.tmp-spec-${process.pid}.mjs`);  // next to produce.mjs so that `three` can be found
    esbuild.buildSync({ entryPoints: [path.join(here, "story-templates", "index.ts")], bundle: true, platform: "node", format: "esm", external: ["three", "three/*"], outfile: out, logLevel: "error" });
    const { TEMPLATES } = await import("file://" + out.replace(/\\/g, "/")); fs.rmSync(out, { force: true });
    if (!TEMPLATES[args[0]]) { console.error("Unknown template. Choose: " + Object.keys(TEMPLATES).join(", ")); process.exit(1); }
    console.log(JSON.stringify(TEMPLATES[args[0]](args[1] ? { seconds: Number(args[1]) } : {}).audio, null, 2));
    process.exit(0);
  }
  default:
    console.log(fs.readFileSync(import.meta.filename, "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
    process.exit(cmd ? 1 : 0);
}
