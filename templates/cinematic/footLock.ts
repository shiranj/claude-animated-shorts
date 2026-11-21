import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fitModel, safeName, type ClipWeights } from "./AnimatedCharacter";

/* ------------------------------------------------------------------------------------------------
 * Foot-locked travel: how far a character walks, derived from its own animation instead of a guessed speed.
 *
 * In every frame the character advances exactly as far as the planted foot moves backward relative to the body, so the
 * planted foot stays still in the world (no foot skating). Feet are weighted by how close they are to the ground, so
 * when a walk blends into an idle the travel slows on its own and the feet stay put during the deceleration.
 *
 * The result is a table with one entry per frame, built once from the same clips and weights the renderer uses.
 * It is a pure function of (model, clips, weights, fps), so frame N never depends on how frames were rendered.
 * ---------------------------------------------------------------------------------------------- */

export type TravelOptions = {
  model: GLTF;
  animations: THREE.AnimationClip[];
  weightsAt: (frame: number) => ClipWeights;
  fps: number;
  frames: number;
  /** Same value passed to <AnimatedCharacter height>. */
  height: number;
  /** Bone names of the two feet. */
  feet: [string, string];
  /** Direction the character walks along its own forward axis: +1 if its forward is +z (glTF default). */
  forward?: 1 | -1;
};

/** Returns an array of length frames + 1: distance (scene units) walked from frame 0 to each frame, along the character's forward axis. */
export const computeTravel = ({ model, animations, weightsAt, fps, frames, height, feet, forward = 1 }: TravelOptions): Float32Array => {
  const root = cloneSkinned(model.scene);
  const { scale } = fitModel(root, height);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of animations) {
    if (actions.has(clip.name)) continue;
    const a = mixer.clipAction(clip); a.play(); actions.set(clip.name, a);
  }
  const footBones = feet.map((n) => root.getObjectByName(safeName(n)));
  if (footBones.some((b) => !b)) return new Float32Array(frames + 1); // unknown rig: no travel, nothing breaks

  const v = new THREE.Vector3();
  const sample = (frame: number) => {
    const w = weightsAt(frame);
    for (const [name, a] of actions) a.setEffectiveWeight(w[name] ?? 0);
    mixer.setTime(frame / fps);
    root.updateMatrixWorld(true);
    return footBones.map((b) => { b!.getWorldPosition(v); return { y: v.y * scale, z: v.z * scale }; });
  };

  const poses = Array.from({ length: frames + 1 }, (_, f) => sample(f));
  const floor = Math.min(...poses.flatMap((p) => p.map((q) => q.y)));
  const reach = 0.045 * height; // a foot within this height of the floor counts as planted
  const planted = (y: number) => { const t = THREE.MathUtils.clamp(1 - (y - floor) / reach, 0, 1); return t * t; };

  const out = new Float32Array(frames + 1);
  for (let f = 1; f <= frames; f++) {
    let num = 0, den = 0;
    for (let k = 0; k < 2; k++) {
      const wgt = Math.min(planted(poses[f - 1][k].y), planted(poses[f][k].y));
      num += wgt * (poses[f][k].z - poses[f - 1][k].z);
      den += wgt;
    }
    out[f] = out[f - 1] + (den > 1e-4 ? (-num / den) * forward : 0);
  }
  return out;
};

/** Moving average of the table over +-radius frames, to give the camera a steadier path than the foot-locked body. Pure function of the table. */
export const smoothTravel = (table: Float32Array, radius: number) => {
  const out = new Float32Array(table.length);
  for (let f = 0; f < table.length; f++) {
    let sum = 0, n = 0;
    for (let k = -radius; k <= radius; k++) { sum += table[Math.min(Math.max(f + k, 0), table.length - 1)]; n++; }
    out[f] = sum / n;
  }
  return out;
};
