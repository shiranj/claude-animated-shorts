import { clamp } from "../animation/math";
import { smoothTravel } from "../footLock";
import type { Motion } from "../animation/motion";
import type { TargetTable, Vec3 } from "../animation/script";
import type { RefPoint, Refs } from "./shots";

/** Camera references for a set of actors (by id) and a table of named points. Smoothed paths are used for tracking shots. */
export const makeRefs = (motions: Record<string, Motion>, targets: TargetTable, frames: number, smoothRadius = 12): { refs: Refs; smooth: Record<string, { x: Float32Array; z: Float32Array }> } => {
  const smooth: Record<string, { x: Float32Array; z: Float32Array }> = {};
  for (const id of Object.keys(motions)) smooth[id] = { x: smoothTravel(motions[id].x, smoothRadius), z: smoothTravel(motions[id].z, smoothRadius) };
  const refs: Refs = (name, f, useSmooth): RefPoint | null => {
    const m = motions[name];
    if (m) { const i = clamp(Math.round(f), 0, frames), s = smooth[name]; return { pos: useSmooth ? [s.x[i], 0, s.z[i]] : [m.x[i], 0, m.z[i]], heading: m.yaw[i] }; }
    const t = targets[name]; return t ? { pos: t(f) as Vec3 } : null;
  };
  return { refs, smooth };
};
