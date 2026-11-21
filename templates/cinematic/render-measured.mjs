// Render a composition and record time and memory. Only the processes started by this script (Node, Chrome, FFmpeg) are counted.
// Usage: node render-measured.mjs <entry> <compositionId> <out.mp4> [--allow-integrated] [--hardware-acceleration] [--concurrency N] [--public-dir dir] [--timeout ms] [--report report.json]
// Environment: CHROME_PATH (optional), REMOTION_TMP (folder on a big drive for the bundle).
// Browser errors and warnings are written to <out>.log, so a failed render can be diagnosed afterwards.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const [entry, id, out] = args;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
if (!entry || !id || !out) { console.error("Usage: node render-measured.mjs <entry> <compositionId> <out.mp4> [--concurrency N] [--public-dir dir] [--timeout ms] [--report file.json]"); process.exit(1); }
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
// Pre-flight: make sure the browser will render on the discrete graphics card, not the integrated one. Skip with --allow-integrated.
if (!args.includes("--allow-integrated")) {
  const gpu = (await import("node:child_process")).spawnSync(process.execPath, [new URL("./check-gpu.mjs", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")], { encoding: "utf8" });
  process.stdout.write(gpu.stdout ?? "");
  if (gpu.status !== 0) { console.error("Stopping: the render browser is not on a discrete GPU (see above). Fix it, or pass --allow-integrated to render anyway."); process.exit(3); }
}
const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

/** Working set (MB) of this process and all its children. */
const treeMB = () => {
  try {
    let rows;
    if (process.platform === "win32") {
      const j = execFileSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress"], { encoding: "utf8", maxBuffer: 1 << 26 });
      rows = [].concat(JSON.parse(j)).map((r) => ({ pid: r.ProcessId, ppid: r.ParentProcessId, bytes: r.WorkingSetSize }));
    } else {
      rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" }).trim().split("\n").map((l) => { const [pid, ppid, kb] = l.trim().split(/\s+/).map(Number); return { pid, ppid, bytes: kb * 1024 }; });
    }
    const kids = new Map(); for (const r of rows) { if (!kids.has(r.ppid)) kids.set(r.ppid, []); kids.get(r.ppid).push(r); }
    const byPid = new Map(rows.map((r) => [r.pid, r]));
    let sum = 0; const stack = [process.pid];
    while (stack.length) { const p = stack.pop(); sum += byPid.get(p)?.bytes ?? 0; for (const c of kids.get(p) ?? []) stack.push(c.pid); }
    return sum / 1048576;
  } catch { return NaN; }
};

const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const browserExecutable = candidates.find((p) => fs.existsSync(p));
const publicDir = opt("public-dir", fs.existsSync("public") ? path.resolve("public") : undefined);
const concurrency = opt("concurrency") ? Number(opt("concurrency")) : null;
const timeout = Number(opt("timeout", 120000));
const logFile = `${out}.log`; fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(logFile, "");
const chromiumOptions = { gl: "angle" };

const samples = []; const t0 = Date.now();
const timer = setInterval(() => samples.push({ s: Math.round((Date.now() - t0) / 1000), mb: Math.round(treeMB()) }), 2000);
let result = { ok: false };
try {
  const serveUrl = await bundle({ entryPoint: path.resolve(entry), publicDir });
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
  const tRender = Date.now(); let lastPct = -1;
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: 18, ...(args.includes("--hardware-acceleration") ? { hardwareAcceleration: "if-possible" } : {}), outputLocation: out, browserExecutable, chromiumOptions, concurrency, timeoutInMilliseconds: timeout,
    onBrowserLog: (l) => { if (l.type === "error" || l.type === "warning") fs.appendFileSync(logFile, `[${l.type}] ${l.text.slice(0, 400)}\n`); },
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== lastPct) { lastPct = p; process.stdout.write(`${p * 10}% `); } },
  });
  const renderSeconds = (Date.now() - tRender) / 1000;
  result = { ok: true, composition: id, frames: composition.durationInFrames, fps: composition.fps, width: composition.width, height: composition.height, concurrency: concurrency ?? "default", renderSeconds: +renderSeconds.toFixed(1), totalSeconds: +((Date.now() - t0) / 1000).toFixed(1), peakMB: Math.max(...samples.map((s) => s.mb).filter(Number.isFinite)), samples };
} catch (e) {
  result = { ok: false, error: String(e?.message ?? e).slice(0, 2000), totalSeconds: +((Date.now() - t0) / 1000).toFixed(1), peakMB: Math.max(0, ...samples.map((s) => s.mb).filter(Number.isFinite)), samples };
  fs.appendFileSync(logFile, `[fatal] ${result.error}\n`);
}
clearInterval(timer);
const report = opt("report", `${out}.report.json`); fs.writeFileSync(report, JSON.stringify(result, null, 1));
console.log(`\n${result.ok ? "OK" : "FAILED"}: ${JSON.stringify({ ...result, samples: undefined })}  (browser log: ${logFile})`);
process.exit(result.ok ? 0 : 1);
