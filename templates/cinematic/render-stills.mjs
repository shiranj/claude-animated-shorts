// Generic still renderer for any composition (not tied to the bridge short).
// Usage: node render-stills.mjs <entry> <compositionId> <outPrefix> <frame,frame,...> [scale=0.5]
// Env:   CHROME_PATH   path to Chrome/Chromium (optional; Remotion's own browser is used if unset and none is found)
//        REMOTION_TMP  folder on a big drive for Remotion's temporary bundle (optional)
//        REMOTION_PUBLIC  public folder to bundle (default: ./public if it exists, otherwise none)
import fs from "node:fs";
import path from "node:path";

if (process.env.REMOTION_TMP) {
  fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP;
}
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");

const [entry, id, prefix, frames, scale = "0.5"] = process.argv.slice(2);
if (!entry || !id || !prefix || !frames) {
  console.error("Usage: node render-stills.mjs <entry> <compositionId> <outPrefix> <frame,frame,...> [scale]");
  process.exit(1);
}
const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const browserExecutable = candidates.find((p) => fs.existsSync(p));
const chromiumOptions = { gl: "angle" };

fs.mkdirSync(path.dirname(path.resolve(prefix)), { recursive: true });
const publicDir = process.env.REMOTION_PUBLIC ?? (fs.existsSync("public") ? path.resolve("public") : undefined);
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve(entry), publicDir });
console.log(`bundle ${((Date.now() - t0) / 1000).toFixed(1)}s, browser: ${browserExecutable ?? "Remotion default"}`);
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88,
    scale: Number(scale), browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log(`still ${f} ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
