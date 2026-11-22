// Renders the same frame range several times (PNG, no lossy step) and counts the pixels that differ between runs.
// Usage: node check-determinism.mjs <entry> <compositionId> [from-to=250-300] [runs=3] [--public-dir <dir>]
// Needs Python with Pillow and numpy for the comparison. Exit code 2 = frames differ by more than 2 levels anywhere.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process";
const argv = process.argv.slice(2); const pi = argv.indexOf("--public-dir"); const publicDir = pi >= 0 ? path.resolve(argv.splice(pi, 2)[1]) : (fs.existsSync("public") ? path.resolve("public") : undefined);
const [entry, id, range = "250-300", runsArg = "3"] = argv;
if (!entry || !id) { console.error("Usage: node check-determinism.mjs <entry> <compositionId> [from-to] [runs] [--public-dir dir]"); process.exit(1); }
const { bundle } = await import("@remotion/bundler"); const { renderFrames, selectComposition } = await import("@remotion/renderer");
const browserExecutable = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find((p) => fs.existsSync(p));
const chromiumOptions = { gl: "angle" }; const [a, b] = range.split("-").map(Number); const runs = Number(runsArg);
const work = fs.mkdtempSync(path.join(os.tmpdir(), "determinism-"));
const serveUrl = await bundle({ entryPoint: path.resolve(entry), publicDir });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
for (let r = 0; r < runs; r++) {
  await renderFrames({ composition, serveUrl, outputDir: path.join(work, `run${r}`), imageFormat: "png", frameRange: [a, b], concurrency: 1, browserExecutable, chromiumOptions, timeoutInMilliseconds: 120000, onStart: () => {}, onFrameUpdate: () => {} });
  console.log(`run ${r + 1}/${runs} rendered`);
}
const py = `
import sys, numpy as np
from PIL import Image
w, runs, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
L = lambda r, i: np.asarray(Image.open(f"{w}/run{r}/element-{i}.png").convert("RGB")).astype(int)
worst = 0
for i in range(a, b + 1):
    ref = L(0, i)
    for r in range(1, runs):
        d = np.abs(ref - L(r, i)).max(axis=2)
        if d.max() > 0:
            print(f"frame {i}: run 1 vs run {r+1}: {int((d>0).sum())} pixels differ, largest difference {int(d.max())}/255")
            worst = max(worst, int(d.max()))
print("identical in every run" if worst == 0 and True else f"largest difference overall: {worst}/255")
sys.exit(2 if worst > 2 else 0)
`;
try { const out = execFileSync("python", ["-I", "-c", py, work, String(runs), String(a), String(b)], { encoding: "utf8" }); console.log(out.trim()); }
catch (e) { console.log((e.stdout ?? "").trim()); process.exitCode = e.status ?? 1; }
fs.rmSync(work, { recursive: true, force: true });
