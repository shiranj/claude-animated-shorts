import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildMotion, type Motion } from "./animation/motion";
import { evaluateCamera, projectNDC, type Shot } from "./camera/shots";
import { makeRefs } from "./camera/refs";
import type { CharacterScript, TargetTable } from "./animation/script";

/* Composition check for a story: for every frame, projects each actor's head and feet through the camera and reports problems.
 * Usage: node check-shots.mjs <story data file> [path to animations.glb] [out.json]. The data file exports STORY_DATA (see storyDemoData.ts). */
type Data = { fps: number; frames: number; shots: Shot[]; targets: (m: Record<string, Motion>) => TargetTable; actors: { id: string; script: CharacterScript; height: number; /** Frames where the actor must be in view (an actor may walk in or out of the picture on purpose). Default: all. */ visible?: [number, number]; clips: { idle: string; walk: string; run: string }; feet: [string, string] }[] };
(globalThis as { ProgressEvent?: unknown }).ProgressEvent = class extends Event { constructor(t: string, i: object) { super(t); Object.assign(this, i); } };
const [, , dataPath, animPath = "public/cinematic/animations/UAL1_Standard.glb", outPath = "out/shot-check.json"] = process.argv;
const { STORY_DATA } = (await import(pathToFileURL(path.resolve(dataPath.replace(/\.ts$/, ".mjs"))).href)) as { STORY_DATA: Data };
const buf = (p: string) => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const loader = new GLTFLoader(); loader.register(() => ({ name: "skip", loadTexture: () => Promise.resolve(null) }) as never);
const g = await new Promise<never>((res, rej) => loader.parse(buf(animPath), "", res, rej));
const D = STORY_DATA, motions: Record<string, Motion> = {};
const stage1 = D.targets({});
for (const a of D.actors) motions[a.id] = buildMotion({ script: a.script, model: g, animations: (g as { animations: never[] }).animations, clips: a.clips, fps: D.fps, frames: D.frames, height: a.height, feet: a.feet, targets: stage1 });
const { refs } = makeRefs(motions, D.targets(motions), D.frames);

const SAFE_X = 0.86, SAFE_Y = 0.9; // keep important things inside this part of the frame (-1..1)
type Issue = { frame: number; shot: string; actor: string; what: string; detail: string };
const issues: Issue[] = [], perShot: Record<string, { frames: number; minHeadMargin: number; maxHeadPx: number; minHeadPx: number }> = {};
let prev: ReturnType<typeof evaluateCamera> | null = null, maxStep = 0, maxStepFrame = 0;
for (let f = 0; f <= D.frames; f++) {
  const cam = evaluateCamera(D.shots, f, refs), shot = D.shots[cam.shot], name = shot.name ?? `shot${cam.shot}`;
  const ps = (perShot[name] ??= { frames: 0, minHeadMargin: 9, maxHeadPx: 0, minHeadPx: 1e9 }); ps.frames++;
  // Over-the-shoulder shots show the subject only in part on purpose: for them the thing being looked at must be in frame instead.
  if (shot.start.behind) {
    const r = refs(shot.start.focus.target as string, f, false), p = r ? projectNDC(cam, [r.pos[0], r.pos[1] + (shot.start.focus.height ?? 0), r.pos[2]]) : null;
    if (!p || p.depth < 0.3 || Math.abs(p.x) > SAFE_X || Math.abs(p.y) > SAFE_Y) issues.push({ frame: f, shot: name, actor: String(shot.start.focus.target), what: "focus object not in the safe area", detail: p ? `x ${p.x.toFixed(2)} y ${p.y.toFixed(2)}` : "unknown" });
    else ps.minHeadMargin = Math.min(ps.minHeadMargin, Math.min(SAFE_X - Math.abs(p.x), SAFE_Y - Math.abs(p.y)));
    for (const a of D.actors) { const m = motions[a.id], i = Math.min(f, D.frames), h = projectNDC(cam, [m.x[i], a.height, m.z[i]]); if (f % 13 === 0) console.log(`  [${name}] f${f} ${a.id} head at x ${h.x.toFixed(2)} y ${h.y.toFixed(2)}, focus at x ${p?.x.toFixed(2)} y ${p?.y.toFixed(2)}`); }
    prev = cam; continue;
  }
  for (const a of D.actors) {
    if (a.visible && (f < a.visible[0] || f > a.visible[1])) continue;
    const m = motions[a.id], i = Math.min(f, D.frames), x = m.x[i], z = m.z[i];
    const head = projectNDC(cam, [x, a.height * 1.0, z]), top = projectNDC(cam, [x, a.height * 1.05, z]), feet = projectNDC(cam, [x, 0.05, z]);
    if (head.depth < 0.3) { issues.push({ frame: f, shot: name, actor: a.id, what: "behind camera", detail: `depth ${head.depth.toFixed(2)}` }); continue; }
    const margin = Math.min(SAFE_X - Math.abs(head.x), SAFE_Y - Math.abs(top.y));
    ps.minHeadMargin = Math.min(ps.minHeadMargin, margin);
    if (margin < 0) issues.push({ frame: f, shot: name, actor: a.id, what: Math.abs(top.y) > 1 || Math.abs(head.x) > 1 ? "head outside frame" : "head too near the edge", detail: `x ${head.x.toFixed(2)} top y ${top.y.toFixed(2)}` });
    const headPx = Math.abs(top.y - projectNDC(cam, [x, a.height * 0.85, z]).y) * 0.5 * 1920; // the 20 cm from the chin to above the head, in pixels
    ps.maxHeadPx = Math.max(ps.maxHeadPx, headPx); ps.minHeadPx = Math.min(ps.minHeadPx, headPx);
    if (shot.start.fit > 2.2 && (feet.y < -1 || feet.y > 1) && f > 8) issues.push({ frame: f, shot: name, actor: a.id, what: "feet outside a full-body shot", detail: `feet y ${feet.y.toFixed(2)}` });
  }
  if (prev && cam.shot === prev.shot) { const step = cam.pos.distanceTo(prev.pos); if (step > maxStep) { maxStep = step; maxStepFrame = f; } }
  prev = cam;
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ perShot, issues, maxCameraStepPerFrame: maxStep, maxCameraStepFrame: maxStepFrame }, null, 1));
console.log("shot".padEnd(16), "frames", "min head margin", "head size px (min-max, per 20 cm)");
for (const [k, v] of Object.entries(perShot)) console.log(k.padEnd(16), String(v.frames).padStart(6), v.minHeadMargin.toFixed(2).padStart(15), `${v.minHeadPx.toFixed(0)}-${v.maxHeadPx.toFixed(0)}`.padStart(14));
console.log(`camera speed (inside a shot): max ${(maxStep * D.fps).toFixed(2)} m/s at frame ${maxStepFrame}`);
console.log(issues.length ? `${issues.length} issue frames. First: ${JSON.stringify(issues.slice(0, 6))}` : "No composition issues found.");
process.exit(issues.length ? 2 : 0);
