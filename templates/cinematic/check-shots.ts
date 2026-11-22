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
type Data = { width?: number; height?: number; fps: number; frames: number; shots: Shot[]; targets: (m: Record<string, Motion>) => TargetTable; /** Props or places that must stay in view: `name` is a target name, `frames` limits when (default: the whole story). */ watch?: { name: string; frames?: [number, number] }[]; /** Camera speed limit in metres per second inside a shot (default 6). */ maxCameraSpeed?: number; actors: { id: string; script: CharacterScript; height: number; /** Frames where the actor must be in view (an actor may walk in or out of the picture on purpose). Default: all. */ visible?: [number, number] | [number, number][]; clips: { idle: string; walk: string; run: string }; feet: [string, string] }[] };
(globalThis as { ProgressEvent?: unknown }).ProgressEvent = class extends Event { constructor(t: string, i: object) { super(t); Object.assign(this, i); } };
const [, , dataPath, animPath = "public/cinematic/animations/UAL1_Standard.glb", outPath = "out/shot-check.json"] = process.argv;
const { STORY_DATA } = (await import(pathToFileURL(path.resolve(dataPath.replace(/\.ts$/, ".mjs"))).href)) as { STORY_DATA: Data };
const buf = (p: string) => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const loader = new GLTFLoader(); loader.register(() => ({ name: "skip", loadTexture: () => Promise.resolve(null) }) as never);
const g = await new Promise<never>((res, rej) => loader.parse(buf(animPath), "", res, rej));
const D = STORY_DATA, motions: Record<string, Motion> = {};
const stage1 = D.targets({});
for (const a of D.actors) motions[a.id] = buildMotion({ script: a.script, model: g, animations: (g as { animations: never[] }).animations, clips: a.clips, fps: D.fps, frames: D.frames, height: a.height, feet: a.feet, targets: stage1 });
// The story runtime adds `${id}` (feet) and `${id}.head` for every actor. Do the same here, so shots can use them.
const allTargets: TargetTable = { ...D.targets(motions) };
for (const a of D.actors) { const m = motions[a.id], at = (f: number) => Math.min(Math.max(Math.round(f), 0), D.frames); allTargets[a.id] = (f) => [m.x[at(f)], 0, m.z[at(f)]]; allTargets[`${a.id}.head`] = (f) => [m.x[at(f)], a.height * 0.93, m.z[at(f)]]; }
const { refs } = makeRefs(motions, allTargets, D.frames);

const ASPECT = (D.width ?? 1080) / (D.height ?? 1920), PX_H = D.height ?? 1920;
if (process.env.SHOT_POSITIONS) for (let f = 0; f <= D.frames; f += 60) console.log(`pos f${f}: ` + D.actors.map((a) => `${a.id} (${motions[a.id].x[f].toFixed(2)}, ${motions[a.id].z[f].toFixed(2)}) yaw ${(motions[a.id].yaw[f] * 180 / Math.PI).toFixed(0)}`).join("   "));
const SAFE_X = 0.86, SAFE_Y = 0.9; // keep important things inside this part of the frame (-1..1)
type Issue = { frame: number; shot: string; actor: string; what: string; detail: string };
const warnings: Issue[] = [];
const issues: Issue[] = [], perShot: Record<string, { frames: number; minHeadMargin: number; maxHeadPx: number; minHeadPx: number }> = {};
let prev: ReturnType<typeof evaluateCamera> | null = null, maxStep = 0, maxStepFrame = 0;
for (let f = 0; f <= D.frames; f++) {
  const cam = evaluateCamera(D.shots, f, refs, ASPECT), shot = D.shots[cam.shot], name = shot.name ?? `shot${cam.shot}`;
  const ps = (perShot[name] ??= { frames: 0, minHeadMargin: 9, maxHeadPx: 0, minHeadPx: 1e9 }); ps.frames++;
  // Over-the-shoulder shots show the subject only in part on purpose: for them the thing being looked at must be in frame instead.
  if (shot.start.behind) {
    const r = refs(shot.start.focus.target as string, f, false), p = r ? projectNDC(cam, [r.pos[0], r.pos[1] + (shot.start.focus.height ?? 0), r.pos[2]], ASPECT) : null;
    if (!p || p.depth < 0.3 || Math.abs(p.x) > SAFE_X || Math.abs(p.y) > SAFE_Y) issues.push({ frame: f, shot: name, actor: String(shot.start.focus.target), what: "focus object not in the safe area", detail: p ? `x ${p.x.toFixed(2)} y ${p.y.toFixed(2)}` : "unknown" });
    else ps.minHeadMargin = Math.min(ps.minHeadMargin, Math.min(SAFE_X - Math.abs(p.x), SAFE_Y - Math.abs(p.y)));
    for (const a of D.actors) { const m = motions[a.id], i = Math.min(f, D.frames), h = projectNDC(cam, [m.x[i], a.height, m.z[i]], ASPECT); if (f % 13 === 0) console.log(`  [${name}] f${f} ${a.id} head at x ${h.x.toFixed(2)} y ${h.y.toFixed(2)}, focus at x ${p?.x.toFixed(2)} y ${p?.y.toFixed(2)}`); }
    prev = cam; continue;
  }
  for (const w of D.watch ?? []) {
    if (w.frames && (f < w.frames[0] || f > w.frames[1])) continue;
    const r = refs(w.name, f, false); if (!r) { if (f === 0) issues.push({ frame: f, shot: name, actor: w.name, what: "watched prop has no position", detail: "unknown target name" }); continue; }
    const p = projectNDC(cam, r.pos, ASPECT);
    if (p.depth < 0.3 || Math.abs(p.x) > SAFE_X || Math.abs(p.y) > SAFE_Y) issues.push({ frame: f, shot: name, actor: w.name, what: p.depth < 0.3 ? "important prop behind the camera" : "important prop outside the safe area", detail: `x ${p.x.toFixed(2)} y ${p.y.toFixed(2)}` });
  }
  for (const a of D.actors) {
    if (a.visible && !(Array.isArray(a.visible[0]) ? (a.visible as [number, number][]) : [a.visible as [number, number]]).some(([from, to]) => f >= from && f <= to)) continue;
    const m = motions[a.id], i = Math.min(f, D.frames), x = m.x[i], z = m.z[i];
    const head = projectNDC(cam, [x, a.height * 1.0, z], ASPECT), top = projectNDC(cam, [x, a.height * 1.05, z], ASPECT), feet = projectNDC(cam, [x, 0.05, z], ASPECT);
    if (head.depth < 0.3) { issues.push({ frame: f, shot: name, actor: a.id, what: "behind camera", detail: `depth ${head.depth.toFixed(2)}` }); continue; }
    const margin = Math.min(SAFE_X - Math.abs(head.x), SAFE_Y - Math.abs(top.y));
    ps.minHeadMargin = Math.min(ps.minHeadMargin, margin);
    if (margin < 0) issues.push({ frame: f, shot: name, actor: a.id, what: Math.abs(top.y) > 1 || Math.abs(head.x) > 1 ? "head outside frame" : "head too near the edge", detail: `x ${head.x.toFixed(2)} top y ${top.y.toFixed(2)}` });
    const headPx = Math.abs(top.y - projectNDC(cam, [x, a.height * 0.85, z], ASPECT).y) * 0.5 * PX_H; // the 20 cm from the chin to above the head, in pixels
    // Poor positioning (warnings, not failures): a tight shot with the head far down leaves a big empty top; a head too small to read on a phone.
    if (shot.start.fit <= 2.2 && head.y < -0.3 && f > 8) warnings.push({ frame: f, shot: name, actor: a.id, what: "subject low in a tight shot (empty space above)", detail: `head y ${head.y.toFixed(2)}` });
    if (Math.abs(head.x) > 0.7 && shot.start.fit <= 2.2) warnings.push({ frame: f, shot: name, actor: a.id, what: "subject far to the side", detail: `head x ${head.x.toFixed(2)}` });
    ps.maxHeadPx = Math.max(ps.maxHeadPx, headPx); ps.minHeadPx = Math.min(ps.minHeadPx, headPx);
    if (shot.start.fit <= 3.2 && headPx < 14 && f > 8) warnings.push({ frame: f, shot: name, actor: a.id, what: "face may be too small to read on a phone", detail: `${headPx.toFixed(0)} px per 20 cm` });
    if (shot.start.fit > 2.2 && (feet.y < -1 || feet.y > 1) && f > 8) issues.push({ frame: f, shot: name, actor: a.id, what: "feet outside a full-body shot", detail: `feet y ${feet.y.toFixed(2)}` });
  }
  if (prev && cam.shot === prev.shot) { const step = cam.pos.distanceTo(prev.pos); if (step > maxStep) { maxStep = step; maxStepFrame = f; } }
  prev = cam;
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
// Fast camera: a hard limit, because it is the most common thing that makes a short feel cheap.
const speedLimit = D.maxCameraSpeed ?? 6;
if (maxStep * D.fps > speedLimit) issues.push({ frame: maxStepFrame, shot: D.shots[evaluateCamera(D.shots, maxStepFrame, refs, ASPECT).shot].name ?? "?", actor: "camera", what: "camera moves too fast inside a shot", detail: `${(maxStep * D.fps).toFixed(1)} m/s, limit ${speedLimit}` });
const brief = (list: Issue[]) => { const by = new Map<string, { first: number; last: number; n: number; e: Issue }>(); for (const e of list) { const k = `${e.shot}|${e.actor}|${e.what}`, v = by.get(k); if (v) { v.last = e.frame; v.n++; } else by.set(k, { first: e.frame, last: e.frame, n: 1, e }); } return [...by.values()].map((v) => ({ ...v.e, frame: v.first, lastFrame: v.last, frames: v.n })); };
fs.writeFileSync(outPath, JSON.stringify({ perShot, issues: brief(issues), warnings: brief(warnings), maxCameraStepPerFrame: maxStep, maxCameraStepPerFrame: maxStep, maxCameraStepFrame: maxStepFrame }, null, 1));
console.log("shot".padEnd(16), "frames", "min head margin", "head size px (min-max, per 20 cm)");
for (const [k, v] of Object.entries(perShot)) console.log(k.padEnd(16), String(v.frames).padStart(6), v.minHeadMargin.toFixed(2).padStart(15), `${v.minHeadPx.toFixed(0)}-${v.maxHeadPx.toFixed(0)}`.padStart(14));
console.log(`camera speed (inside a shot): max ${(maxStep * D.fps).toFixed(2)} m/s at frame ${maxStepFrame}`);
if (warnings.length) console.log(`${warnings.length} warning frames (not failures): ${JSON.stringify(brief(warnings).slice(0, 6))}`);
console.log(issues.length ? `${issues.length} issue frames. First: ${JSON.stringify(brief(issues).slice(0, 6))}` : "No composition issues found.");
process.exit(issues.length ? 2 : 0);
