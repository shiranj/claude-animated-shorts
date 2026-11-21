// Checks that every asset needed by the cinematic starter is in public/ and that downloaded files match their recorded checksums.
// Usage (from the folder that contains public/): node check-assets.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const manifest = JSON.parse(fs.readFileSync(new URL("./asset-manifest.json", import.meta.url), "utf8"));
const hash = (file, algo) => crypto.createHash(algo).update(fs.readFileSync(file)).digest("hex");
let problems = 0;
const report = (ok, msg) => { console.log(`${ok ? "OK     " : "MISSING"} ${msg}`); if (!ok) problems++; };

for (const a of manifest.assets) {
  if (a.files) {
    for (const [name, sum] of Object.entries(a.files)) {
      const file = path.join(a.localPath.endsWith("/") ? a.localPath : path.dirname(a.localPath), name);
      if (!fs.existsSync(file)) { report(false, `${file}  (${a.name})`); continue; }
      const ok = hash(file, a.filesHashAlgorithm ?? "md5") === sum;
      report(ok, `${file}${ok ? "" : "  checksum differs: the file may be damaged or a different version"}`);
    }
  } else if (a.filesInZip) {
    for (const f of a.filesInZip) report(fs.existsSync(path.join(a.localPath, path.basename(f))), `${path.join(a.localPath, path.basename(f))}  (${a.name})`);
  } else {
    report(fs.existsSync(a.localPath), `${a.localPath}  (${a.name})`);
  }
}
console.log(problems ? `\n${problems} problem(s). See ASSETS.md for download steps.` : "\nAll assets found.");
process.exit(problems ? 1 : 0);
