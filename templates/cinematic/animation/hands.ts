import type * as THREE from "three";
import type { PoseContext } from "../AnimatedCharacter";
import { DEG, lerp } from "./math";
import { setCurl } from "./rigtools";

/* ------------------------------------------------------------------------------------------------
 * Hand poses. Each finger has one number: 0 = straight, 1 = closed fist.
 *
 * Why this exists: in the Universal Animation Library every clip holds the fingers in a tight fist (about 77 degrees at
 * every joint). So a character that only plays clips always walks with fists. This layer runs after the clips and sets the
 * finger joints itself. It bends each joint about its own x axis, which is the curl axis of this rig.
 * ---------------------------------------------------------------------------------------------- */

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export type HandPose = Record<Finger, number>;
export const FINGERS: Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** Bend of each joint (degrees) when the finger value is 1. Measured from the fist in the library's clips. */
const FIST_DEGREES: Record<Finger, [number, number, number]> = {
  thumb: [12, 25, 87], index: [78, 77, 77], middle: [78, 77, 77], ring: [78, 77, 77], pinky: [84, 77, 77],
};

const pose = (thumb: number, index: number, middle: number, ring: number, pinky: number): HandPose => ({ thumb, index, middle, ring, pinky });
export const HAND_POSES = {
  /** Fingers loosely curled, the way a hanging hand rests. */
  relaxed: pose(0.2, 0.22, 0.28, 0.34, 0.4),
  open: pose(0.05, 0.06, 0.08, 0.1, 0.12),
  fist: pose(1, 1, 1, 1, 1),
  /** Index finger out, the others curled. */
  point: pose(0.45, 0, 0.85, 0.9, 0.95),
  /** Fingers wrapped round a handle (a lantern ring, a bag strap). */
  grip: pose(0.5, 0.6, 0.62, 0.66, 0.7),
} satisfies Record<string, HandPose>;

export const mixPose = (a: HandPose, b: HandPose, t: number): HandPose => ({
  thumb: lerp(a.thumb, b.thumb, t), index: lerp(a.index, b.index, t), middle: lerp(a.middle, b.middle, t), ring: lerp(a.ring, b.ring, t), pinky: lerp(a.pinky, b.pinky, t),
});

/** Set the finger joints of one hand. Bones that do not exist (another rig) are skipped. */
export const applyHandPose = (ctx: PoseContext, side: "l" | "r", p: HandPose) => {
  for (const f of FINGERS) {
    for (let j = 1; j <= 3; j++) {
      const name = `${f}_0${j}_${side}`, bone = ctx.bone(name) as THREE.Object3D | undefined, rest = ctx.rest.get(name);
      if (bone && rest) setCurl(bone, rest, p[f] * FIST_DEGREES[f][j - 1] * DEG);
    }
  }
  ctx.bone(`hand_${side}`)?.updateWorldMatrix(false, true);
};
