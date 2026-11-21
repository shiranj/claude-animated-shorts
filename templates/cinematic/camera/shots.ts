import * as THREE from "three";
import { DEG, clamp, ease, lerp } from "../animation/math";

/* ------------------------------------------------------------------------------------------------
 * Cinematic camera. A story gives a list of shots; `evaluateCamera(shots, frame, refs)` returns the camera for that frame.
 * Everything is a pure function of the frame number. Nothing is stored between frames, so any frame can be rendered alone.
 *
 * A framing says where the camera stands relative to a focus point (a character, an object, a fixed point):
 *   - `fit`: how many metres of the world should fit in the frame height at the focus. This sets the shot size
 *            (about 6.5 = wide, 2.4 = full body, 1.4 = waist up, 0.8 = head and shoulders) whatever the lens is.
 *   - `azimuth` / `elevation`: where the camera is around the focus. Azimuth 0 is in FRONT of the subject when `relative`
 *            is true (180 = behind it, for over-the-shoulder), or on the +z side of the world when it is false.
 *   - `screen`: where the focus sits in the frame, -1..1 (0.33 = on the right third line). Done with a lens shift, so
 *            the horizon stays level and perspective does not change.
 * A shot may have an `end` framing; the camera moves from `start` to `end` over the shot (push-in, pull-back, orbit, pan, track).
 * ---------------------------------------------------------------------------------------------- */

export type V3 = [number, number, number];

/** A thing the camera can look at. `pos` is in metres; `heading` (radians, 0 = facing +z) is needed for `relative` framings. */
export type RefPoint = { pos: V3; heading?: number };
/** Gives the position of a named character or object at a frame (`live`), or its smoothed position for camera tracking (`smooth`). */
export type Refs = (name: string, frame: number, smooth: boolean) => RefPoint | null;

export type Focus = {
  /** Name known to `Refs`, or a fixed point in world space. */
  target: string | V3;
  /** Added to the focus height, in metres (aim at the face, the chest, the hands ...). */
  height?: number;
  /** "live": follow the target every frame (tracking). "locked": stay on where the target was when the shot began. */
  follow?: "live" | "locked";
  /** Move the focus sideways (in the target's own frame) and forward, in metres. Useful for leading space. */
  offset?: { right?: number; forward?: number };
};

export type Framing = {
  focus: Focus;
  fit: number;
  azimuth: number;
  elevation: number;
  fov: number;
  relative?: boolean;
  screen?: { x?: number; y?: number };
  /** Roll in degrees (use rarely). */
  roll?: number;
  /** Extra distance in metres added after `fit` (to move behind a prop, for example). */
  push?: number;
  /**
   * Over-the-shoulder: put the camera `distance` metres behind `target` (opposite to the way it faces),
   * `side` metres to one side (+ = the camera's right) and `height` metres above the ground. The camera still looks at the focus.
   */
  behind?: { target: string | V3; distance: number; side?: number; height: number };
};

export type Transition =
  | { type: "cut" }
  /** The camera moves smoothly from the previous shot's last pose to this shot's pose. */
  | { type: "blend"; frames: number }
  /** Fade through a colour around the cut. */
  | { type: "fade"; frames: number; color?: string };

export type Shot = {
  name?: string;
  from: number;
  to: number;
  start: Framing;
  /** If set, the camera moves from `start` to `end` during the shot. */
  end?: Framing;
  /** "smooth" is ease in and out, "linear" is constant speed, "late" is slow at first. */
  motion?: "smooth" | "linear" | "late";
  transition?: Transition;
};

export type CameraState = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number; fade: { opacity: number; color: string }; shot: number };

const motionCurve = (kind: Shot["motion"], t: number) => (kind === "linear" ? clamp(t) : kind === "late" ? ease(clamp(t) * clamp(t)) : ease(t));

/* ---------- framing -> pose ---------- */
type Pose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };
const tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3(), tmpF = new THREE.Vector3(), WORLD_UP = new THREE.Vector3(0, 1, 0);

const resolveFocus = (f: Focus, shotFrom: number, frame: number, refs: Refs): { p: THREE.Vector3; heading: number } => {
  const locked = f.follow === "locked";
  const at = locked ? shotFrom : frame;
  let pos: V3 = [0, 0, 0], heading = 0;
  if (Array.isArray(f.target)) pos = f.target;
  else {
    const r = refs(f.target, at, !locked);
    if (r) { pos = r.pos; heading = r.heading ?? 0; } else console.warn(`[cinematic] Camera focus "${f.target}" is unknown.`);
  }
  const p = new THREE.Vector3(pos[0], pos[1] + (f.height ?? 0), pos[2]);
  if (f.offset) {
    p.x += Math.cos(heading) * -(f.offset.right ?? 0) + Math.sin(heading) * (f.offset.forward ?? 0); // +right of a character facing +z is -x
    p.z += Math.sin(heading) * (f.offset.right ?? 0) + Math.cos(heading) * (f.offset.forward ?? 0);
  }
  return { p, heading };
};

const poseOf = (fr: Framing, shotFrom: number, frame: number, refs: Refs, aspect: number): Pose => {
  const { p, heading } = resolveFocus(fr.focus, shotFrom, frame, refs);
  const fov = fr.fov, dist = fr.fit / (2 * Math.tan((fov * DEG) / 2)) + (fr.push ?? 0);
  const az = (fr.azimuth * DEG) + (fr.relative ? heading : 0), el = fr.elevation * DEG;
  const pos = new THREE.Vector3(p.x + Math.sin(az) * Math.cos(el) * dist, p.y + Math.sin(el) * dist, p.z + Math.cos(az) * Math.cos(el) * dist);
  if (fr.behind) {
    const b = fr.behind, who = resolveFocus({ target: b.target, follow: fr.focus.follow }, shotFrom, frame, refs);
    // "behind" means behind the way the subject faces. A point with no heading uses the line from the focus through it instead.
    if (typeof b.target === "string" && refs(b.target, frame, false)?.heading !== undefined) tmpF.set(Math.sin(who.heading), 0, Math.cos(who.heading));
    else tmpF.set(p.x - who.p.x, 0, p.z - who.p.z).normalize();
    tmpR.crossVectors(tmpF, WORLD_UP).normalize();   // the camera's right when it looks along tmpF
    pos.set(who.p.x - tmpF.x * b.distance + tmpR.x * (b.side ?? 0), b.height, who.p.z - tmpF.z * b.distance + tmpR.z * (b.side ?? 0));
  }
  const look = p.clone();
  // lens shift: slide camera and target together so that the focus lands at the wanted place on screen
  const sx = fr.screen?.x ?? 0, sy = fr.screen?.y ?? 0;
  if (sx || sy) {
    tmpF.copy(look).sub(pos).normalize();
    tmpR.crossVectors(tmpF, WORLD_UP).normalize(); tmpU.crossVectors(tmpR, tmpF).normalize();
    const halfH = Math.tan((fov * DEG) / 2) * dist, halfW = halfH * aspect;
    const shift = tmpR.clone().multiplyScalar(-sx * halfW).addScaledVector(tmpU, -sy * halfH);
    pos.add(shift); look.add(shift);
  }
  return { pos, look, fov, roll: fr.roll ?? 0 };
};

const mixPose = (a: Pose, b: Pose, t: number): Pose => ({ pos: a.pos.clone().lerp(b.pos, t), look: a.look.clone().lerp(b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll, b.roll, t) });

/** The pose of one shot at a frame (frames past the end hold the last pose). */
const shotPose = (s: Shot, frame: number, refs: Refs, aspect: number): Pose => {
  const a = poseOf(s.start, s.from, frame, refs, aspect);
  if (!s.end) return a;
  const t = motionCurve(s.motion, (frame - s.from) / Math.max(s.to - s.from, 1));
  return mixPose(a, poseOf(s.end, s.from, frame, refs, aspect), t);
};

/** Camera for a frame. `shots` must be in time order. Frames before the first shot use the first shot; after the last, the last. */
export const evaluateCamera = (shots: Shot[], frame: number, refs: Refs, aspect = 1080 / 1920): CameraState => {
  let i = 0;
  while (i < shots.length - 1 && frame >= shots[i + 1].from) i++;
  const s = shots[i];
  let pose = shotPose(s, frame, refs, aspect);
  const tr = s.transition ?? { type: "cut" };
  const into = frame - s.from;
  if (i > 0 && tr.type === "blend" && into < tr.frames) pose = mixPose(shotPose(shots[i - 1], frame, refs, aspect), pose, ease(into / tr.frames));
  // fades: dim out before the cut at `from`, and in after it
  let opacity = 0, color = "#000000";
  const fadeOf = (t: Transition | undefined, boundary: number) => {
    if (!t || t.type !== "fade") return 0;
    const half = t.frames / 2; color = t.color ?? "#000000";
    return clamp(1 - Math.abs(frame - boundary) / half);
  };
  opacity = Math.max(fadeOf(s.transition, s.from), i + 1 < shots.length ? fadeOf(shots[i + 1].transition, shots[i + 1].from) : 0);
  if (i + 1 < shots.length && shots[i + 1].transition?.type === "fade" && fadeOf(shots[i + 1].transition, shots[i + 1].from) > 0) color = (shots[i + 1].transition as { color?: string }).color ?? "#000000";
  return { ...pose, fade: { opacity: ease(opacity), color }, shot: i };
};

/* ---------- composition check ---------- */
/** Screen position of a world point for the camera state: x and y in -1..1 (y up); depth > 0 means in front of the camera. */
export const projectNDC = (cam: CameraState, p: V3, aspect = 1080 / 1920) => {
  const c = new THREE.PerspectiveCamera(cam.fov, aspect, 0.1, 200);
  c.position.copy(cam.pos); c.lookAt(cam.look); c.up.copy(WORLD_UP);
  if (cam.roll) c.rotateZ(cam.roll * DEG);
  c.updateMatrixWorld(true); c.updateProjectionMatrix();
  const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(c.matrixWorldInverse);
  const depth = -v.z; v.applyMatrix4(c.projectionMatrix);
  return { x: v.x, y: v.y, depth };
};
