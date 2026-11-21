import * as THREE from "three";
import type { PoseContext, RigidPart } from "../AnimatedCharacter";
import { DEG, clamp, lerp, mulberry32 } from "./math";
import type { Emotion, FrameState, LookItem } from "./script";

/* ------------------------------------------------------------------------------------------------
 * Face. The Quaternius head has no blend shapes and no jaw bone, so the face is built from light parts:
 *   - eyes and eyebrows are solid pieces cut from the kit's meshes (see Extra.rigidSplit), so they can turn and move;
 *   - eyelids are two small skin-coloured shells over the eyeballs that roll down for a blink;
 *   - the mouth uses morph targets made in code from the head's own vertices (see mouthMorphs).
 * Every value is a pure function of the frame and the script.
 * ---------------------------------------------------------------------------------------------- */

export type FaceParams = {
  /** Where the lower edge of the upper eyelid sits, as an angle above the eye's centre line, in degrees. 35 = relaxed, 55 = wide, -40 = closed. */
  lidEdge: number;
  /** Eyebrows: whole brow up (+) or down (-), in metres. */
  browRaise: number;
  /** Inner end of the brow up (+, sad or worried) or down (-, angry), in radians. */
  browTilt: number;
  /** Brows pulled toward the nose, in metres. */
  browInward: number;
  /** Mouth corners: -1 frown, 0 neutral, +1 smile. */
  smile: number;
  /** Mouth open, 0 to 1. */
  jaw: number;
};

const NEUTRAL: FaceParams = { lidEdge: 35, browRaise: 0, browTilt: 0, browInward: 0, smile: 0, jaw: 0 };
/** One face per emotion. Values are for intensity 1; the evaluator scales them. Neutral takes whatever weight is left over. */
export const EMOTION_FACE: Record<Emotion, FaceParams> = {
  neutral: NEUTRAL,
  happy: { lidEdge: 25, browRaise: 0.003, browTilt: 0.0, browInward: 0, smile: 1, jaw: 0.0 },
  sad: { lidEdge: 24, browRaise: 0.0, browTilt: 0.3, browInward: 0.001, smile: -0.7, jaw: 0 },
  angry: { lidEdge: 20, browRaise: -0.0015, browTilt: -0.22, browInward: 0.0025, smile: -0.35, jaw: 0 },
  fear: { lidEdge: 56, browRaise: 0.006, browTilt: 0.2, browInward: 0.002, smile: -0.2, jaw: 0.3 },
  surprise: { lidEdge: 58, browRaise: 0.008, browTilt: 0, browInward: 0, smile: 0, jaw: 0.5 },
};

export const faceFor = (emotions: Partial<Record<Emotion, number>>): FaceParams => {
  let used = 0;
  const out: FaceParams = { ...NEUTRAL };
  for (const k of Object.keys(emotions) as Emotion[]) {
    const w = emotions[k] ?? 0; if (w <= 0) continue;
    used += w; const f = EMOTION_FACE[k];
    out.lidEdge += (f.lidEdge - NEUTRAL.lidEdge) * w; out.browRaise += f.browRaise * w; out.browTilt += f.browTilt * w;
    out.browInward += f.browInward * w; out.smile += f.smile * w; out.jaw += f.jaw * w;
  }
  void used;
  return out;
};

/* ---------- blinking: seeded, so the same frame always blinks the same ---------- */
export const blinkStarts = (seed: number, frames = 4000) => {
  const rnd = mulberry32(seed), starts: number[] = [];
  for (let f = 40 + Math.floor(rnd() * 40); f < frames; f += 70 + Math.floor(rnd() * 90)) {
    starts.push(f);
    if (rnd() < 0.18) starts.push(f + 11); // now and then a double blink
  }
  return starts;
};
const BLINK_STARTS = blinkStarts(7);
/** 0 = open, 1 = closed. About 6 frames per blink at 30 fps: quick close, slower open. */
export const blinkAt = (frame: number, starts: number[] = BLINK_STARTS) => {
  for (const s of starts) {
    const t = frame - s;
    if (t < 0) break;
    if (t <= 5) return t < 2 ? t / 2 : 1 - (t - 2) / 4 * 0.999;
  }
  return 0;
};

/* ---------- rig ---------- */
type Lid = { eye: RigidPart; pivot: THREE.Group };
export type FaceRig = { lids: Lid[]; eyeL?: RigidPart; eyeR?: RigidPart; browL?: RigidPart; browR?: RigidPart };

const SKIN = new THREE.MeshStandardMaterial({ color: "#b27758", roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
const rigs = new WeakMap<object, FaceRig>();

/** Creates the eyelid shells the first time and finds the parts. Returns null when the model has no face parts. */
export const faceRig = (ctx: PoseContext): FaceRig | null => {
  const cached = rigs.get(ctx.root);
  if (cached) return cached;
  const eyeL = ctx.parts.get("Eyes_L"), eyeR = ctx.parts.get("Eyes_R"), browL = ctx.parts.get("Eyebrows_L"), browR = ctx.parts.get("Eyebrows_R");
  const rig: FaceRig = { lids: [], eyeL, eyeR, browL, browR };
  for (const eye of [eyeL, eyeR]) {
    if (!eye) continue;
    eye.mesh.geometry.computeBoundingSphere();
    const r = eye.mesh.geometry.boundingSphere!.radius * 1.07;
    const pivot = new THREE.Group(); pivot.position.copy(eye.centre);
    // A shell covering everything within 105 degrees of its pole. Rolling the pole backward hides it inside the head; rolling it forward closes the eye.
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, 105 * DEG), SKIN);
    shell.castShadow = false; shell.receiveShadow = true; shell.frustumCulled = false;
    pivot.add(shell);
    eye.frame.add(pivot);
    rig.lids.push({ eye, pivot });
  }
  rigs.set(ctx.root, rig);
  return rig;
};

const tv = new THREE.Vector3(), tp = new THREE.Vector3(), tl = new THREE.Vector3();
const MAX_EYE_YAW = 30 * DEG, MAX_EYE_PITCH = 22 * DEG;

/** Where the eyes look: a weighted mix of the look targets, as angles inside the eye's own frame. Call after the head has been posed. */
const eyeAngles = (ctx: PoseContext, eye: RigidPart, items: LookItem[], heading: number) => {
  let yaw = 0, pitch = 0;
  for (const it of items) {
    if (it.wEye <= 0) continue;
    if (it.point) {
      eye.pivot.getWorldPosition(tp);
      tv.set(it.point[0], it.point[1], it.point[2]);
      eye.frame.updateWorldMatrix(true, false);
      tl.copy(tv); eye.frame.worldToLocal(tl); // target in the bind-space frame of the head
      tl.sub(eye.centre);
    } else {
      // an angle relative to the body: build a point 3 m away along that direction
      const h = heading + it.yaw;
      eye.pivot.getWorldPosition(tp);
      tv.set(tp.x + Math.sin(h) * Math.cos(it.pitch) * 3, tp.y + Math.sin(it.pitch) * 3, tp.z + Math.cos(h) * Math.cos(it.pitch) * 3);
      eye.frame.updateWorldMatrix(true, false);
      tl.copy(tv); eye.frame.worldToLocal(tl); tl.sub(eye.centre);
    }
    yaw += it.wEye * clamp(Math.atan2(tl.x, tl.z), -MAX_EYE_YAW, MAX_EYE_YAW);
    pitch += it.wEye * clamp(Math.atan2(tl.y, Math.hypot(tl.x, tl.z)), -MAX_EYE_PITCH, MAX_EYE_PITCH);
  }
  return { yaw, pitch };
};

/** Puts the eyes, eyelids and eyebrows (and the mouth morphs) in the pose for this frame. */
/** `blink` is this character's own blink schedule (see blinkStarts), so two characters do not blink together. */
export const applyFace = (ctx: PoseContext, state: FrameState, mouth?: (p: FaceParams) => void, blink: number[] = BLINK_STARTS) => {
  const rig = faceRig(ctx);
  if (!rig) return;
  const p = faceFor(state.emotions);
  // Blink, but not while the eyes are wide with surprise or fear.
  const closed = blinkAt(ctx.frame, blink) * (1 - clamp((p.lidEdge - 40) / 14));
  const lid = lerp(p.lidEdge, -42, closed);
  for (const l of rig.lids) l.pivot.rotation.set((-15 - lid) * DEG, 0, 0);
  for (const eye of [rig.eyeL, rig.eyeR]) {
    if (!eye) continue;
    const a = eyeAngles(ctx, eye, state.look, state.yaw);
    eye.pivot.rotation.set(-a.pitch, a.yaw, 0, "YXZ");
  }
  for (const [brow, side] of [[rig.browL, 1], [rig.browR, -1]] as const) {
    if (!brow) continue;
    // The brow lies on a curved forehead that gets nearer the front toward the nose, so moving it sideways or down also moves it forward.
    brow.pivot.position.set(brow.centre.x - side * p.browInward, brow.centre.y + p.browRaise, brow.centre.z + 0.0008 + p.browInward * 0.9 + Math.max(-p.browRaise, 0) * 0.8);
    brow.pivot.rotation.set(0, 0, -side * p.browTilt);
  }
  mouth?.(p);
};
