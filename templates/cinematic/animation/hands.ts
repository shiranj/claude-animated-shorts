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

/** A partly closed finger does not bend all three joints the same. The knuckle bends a little less, the middle joint a little more and the
 *  fingertip joint clearly less than a straight scale of the fist would give. A uniform bend looks like a claw. At a value of 1 (a fist)
 *  the shape does nothing. `k` per joint: positive = bends more than the straight scale, negative = bends less. */
const JOINT_SHAPE: [number, number, number] = [-0.1, 0.8, -0.35];
export const jointCurl = (value: number, joint: number) => Math.max(0, value * (1 + JOINT_SHAPE[joint] * (1 - value)));

const pose = (thumb: number, index: number, middle: number, ring: number, pinky: number): HandPose => ({ thumb, index, middle, ring, pinky });
export const HAND_POSES = {
  /** Fingers loosely curled, the way a hanging hand rests: a soft arc, not a claw (see JOINT_SHAPE). */
  relaxed: pose(0.3, 0.32, 0.38, 0.44, 0.5),
  /** Fingers a little more bent and the thumb in: a hand that has just let go of something, or holds a small object lightly. */
  cupped: pose(0.35, 0.4, 0.45, 0.5, 0.55),
  /** Flat hand, fingers together (a palm held out). */
  flat: pose(0.0, 0.02, 0.02, 0.03, 0.04),
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
/** Make a pose from a name (`"flat"`) or from some of the five fingers (`{ index: 0, middle: 0.9 }`; the others stay relaxed). */
export const resolveHandPose = (p: keyof typeof HAND_POSES | Partial<HandPose>): HandPose => (typeof p === "string" ? HAND_POSES[p] : { ...HAND_POSES.relaxed, ...p });

export const applyHandPose = (ctx: PoseContext, side: "l" | "r", p: HandPose) => {
  for (const f of FINGERS) {
    for (let j = 1; j <= 3; j++) {
      const name = `${f}_0${j}_${side}`, bone = ctx.bone(name) as THREE.Object3D | undefined, rest = ctx.rest.get(name);
      if (bone && rest) setCurl(bone, rest, (f === "thumb" ? p[f] : jointCurl(p[f], j - 1)) * FIST_DEGREES[f][j - 1] * DEG);
    }
  }
  ctx.bone(`hand_${side}`)?.updateWorldMatrix(false, true);
};
