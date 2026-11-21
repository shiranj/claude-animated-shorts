import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type * as THREE from "three";
import { computeTravel } from "../footLock";
import type { ClipWeights } from "../AnimatedCharacter";
import { DEG, ease, wrapPi } from "./math";
import { locoAt, locoChain, resolveTarget, turnActions, type CharacterScript, type LocoKind, type TargetTable } from "./script";

/** Clip names for each movement kind. */
export type ClipNames = Record<LocoKind, string>;

export const clipWeightsFor = (loco: Record<LocoKind, number>, clips: ClipNames): ClipWeights => ({ [clips.idle]: loco.idle, [clips.walk]: loco.walk, [clips.run]: loco.run });

export type Motion = { x: Float32Array; z: Float32Array; yaw: Float32Array };

/**
 * Where the character is at every frame, and which way it faces.
 * Distance comes from the animation itself (footLock.ts: planted feet do not slide). Direction comes from the script's turns.
 * Built once. It is a pure function of its inputs, so the frame number alone decides the result.
 */
export const buildMotion = (o: {
  script: CharacterScript; model: GLTF; animations: THREE.AnimationClip[]; clips: ClipNames;
  fps: number; frames: number; height: number; feet: [string, string]; targets: TargetTable;
}): Motion => {
  const chain = locoChain(o.script);
  const dist = computeTravel({ model: o.model, animations: o.animations, weightsAt: (f) => clipWeightsFor(locoAt(chain, f), o.clips), fps: o.fps, frames: o.frames, height: o.height, feet: o.feet });
  const start = o.script.start ?? { x: 0, z: 0, yaw: 0 };
  const turns = turnActions(o.script);
  const x = new Float32Array(o.frames + 1), z = new Float32Array(o.frames + 1), yaw = new Float32Array(o.frames + 1);
  x[0] = start.x; z[0] = start.z;
  const plan = new Map<number, { from: number; to: number; a: number; b: number }>(); // turns, resolved when they start
  let cur = start.yaw * DEG;
  for (let f = 0; f <= o.frames; f++) {
    turns.forEach((t, k) => {
      if (f < t.from || plan.has(k)) return;
      let goal = cur;
      if (t.yaw !== undefined) goal = t.yaw * DEG;
      else if (t.toward !== undefined) {
        const p = resolveTarget(t.toward, f, { targets: o.targets, motion: { x, z, yaw } });
        const px = x[Math.max(f - 1, 0)], pz = z[Math.max(f - 1, 0)];
        if (p) goal = Math.atan2(p[0] - px, p[2] - pz);
      }
      plan.set(k, { from: t.from, to: t.to, a: cur, b: cur + wrapPi(goal - cur) });
    });
    for (const p of plan.values()) if (f >= p.from) cur = p.a + (p.b - p.a) * ease((f - p.from) / Math.max(p.to - p.from, 1));
    yaw[f] = cur;
    if (f > 0) { const d = dist[f] - dist[f - 1]; x[f] = x[f - 1] + d * Math.sin(cur); z[f] = z[f - 1] + d * Math.cos(cur); }
  }
  return { x, z, yaw };
};
