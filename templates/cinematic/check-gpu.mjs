// Tells you which graphics card the render browser really uses for WebGL. Run it before a long render.
// Usage: node check-gpu.mjs            (exit code 0 = a discrete NVIDIA/AMD card, 2 = integrated Intel/software, 1 = could not tell)
// It starts Chrome with the same flag Remotion uses for --gl=angle and reads the WebGL renderer name.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }
const extra = process.argv.slice(2); // extra Chrome flags to test, for example --use-angle=d3d11
const html = `<body><script>const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');let r='no webgl';if(g){const e=g.getExtension('WEBGL_debug_renderer_info');r=e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}document.body.textContent='GPU_RENDERER='+r;</script></body>`;
const run = spawnSync(chrome, ["--headless=new", "--use-gl=angle", "--disable-gpu-sandbox", ...extra, "--dump-dom", `data:text/html,${encodeURIComponent(html)}`], { encoding: "utf8", timeout: 60000 });
const m = /GPU_RENDERER=([^<\n]*)/.exec(run.stdout ?? "");
if (!m) { console.error("Could not read the WebGL renderer.", (run.stderr ?? "").slice(0, 300)); process.exit(1); }
const name = m[1].trim(); console.log(`WebGL renderer: ${name}`);
const discrete = /nvidia|geforce|rtx|gtx|radeon rx|amd radeon(?! graphics)/i.test(name), software = /swiftshader|llvmpipe|software/i.test(name);
if (discrete) { console.log("OK: a discrete graphics card is used."); process.exit(0); }
console.log(software ? "WARNING: software rendering (very slow)." : "WARNING: this is not a discrete card (probably the integrated GPU).");
console.log("On Windows: Settings > System > Display > Graphics > add chrome.exe > Options > High performance. Then run this check again.");
process.exit(2);
