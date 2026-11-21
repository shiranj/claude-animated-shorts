import * as THREE from "three";
import type { PoseContext, PoseLayer } from "../AnimatedCharacter";
import { DEG, clamp, ease, lerp, wrapPi } from "./math";
import { HAND_POSES, applyHandPose, mixPose, type HandPose } from "./hands";
import { applyFace, blinkStarts, type FaceParams } from "./face";
import { aimBone, rotateBoneAxis, solveTwoBone, worldPos } from "./rigtools";
import { evaluate, locoChain, type CharacterScript, type Emotion, type FrameEnv, type FrameState, type Hand } from "./script";

/* ------------------------------------------------------------------------------------------------
 * Pose layers. They run after the animation clips, in this order:
 *   1. posture   - body language for the current emotions, the startle jolt, and the lean into a reach
 *   2. gaze      - neck and head turn toward what the character looks at
 *   3. arms      - carry, point, reach and wave, by two-bone IK
 *   4. hands     - finger poses
 *   5. face      - eyes, eyelids, eyebrows, mouth
 * Every layer is a pure function of (frame, script): nothing is stored between frames.
 *
 * Directions used below are relative to the body: LEFT = +x when the character faces +z. Angles are in radians.
 *   pitch  + = lean forward (for a bone that points up);  yaw + = turn left;  roll + = tilt toward the character's right.
 * ---------------------------------------------------------------------------------------------- */

type Eul = [pitch: number, yaw: number, roll: number]; // degrees
type Posture = Record<string, Eul>;
/** Raise a shoulder with roll: for the left clavicle +roll lifts it, for the right one -roll lifts it. */
const SIDES = ["l", "r"] as const;
const mirror = (side: "l" | "r") => (side === "l" ? 1 : -1);

/** Body language per emotion, in degrees, for intensity 1. Arms are written for the LEFT side and mirrored for the right. */
const POSTURE: Record<Emotion, Posture> = {
  neutral: {},
  happy: { spine_03: [-3, 0, 0], neck_01: [-1, 0, 0], Head: [-3, 0, 2] },
  sad: { spine_01: [3, 0, 0], spine_02: [5, 0, 0], spine_03: [6, 0, 0], neck_01: [5, 0, 0], Head: [9, 0, 0], clavicle: [0, 0, -4] },
  angry: { spine_02: [2, 0, 0], spine_03: [3, 0, 0], neck_01: [2, 0, 0], Head: [4, 0, 0], clavicle: [0, 0, 5], upperarm: [0, 0, 5] },
  fear: { spine_01: [-2, 0, 0], spine_02: [-4, 0, 0], spine_03: [-5, 0, 0], neck_01: [-1, 0, 0], Head: [-3, 0, 0], clavicle: [0, 0, 8], upperarm: [-6, 0, -3] },
  surprise: { spine_02: [-3, 0, 0], spine_03: [-4, 0, 0], neck_01: [-3, 0, 0], Head: [-4, 0, 0], clavicle: [0, 0, 5] },
};
/** The sudden jolt: the upper body snaps back, the shoulders jump up and the arms lift away from the body. */
const STARTLE: Posture = { spine_01: [-3, 0, 0], spine_02: [-6, 0, 0], spine_03: [-6, 0, 0], neck_01: [-3, 0, 0], Head: [-6, 0, 0], clavicle: [0, 0, 9], upperarm: [-12, 0, 12] };

const left = new THREE.Vector3(), fwd = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const setAxes = (heading: number) => { left.set(Math.cos(heading), 0, -Math.sin(heading)); fwd.set(Math.sin(heading), 0, Math.cos(heading)); };

const applyPosture = (ctx: PoseContext, posture: Posture, weight: number) => {
  if (weight <= 0.001) return;
  for (const name of Object.keys(posture)) {
    const [pitch, yaw, roll] = posture[name];
    const sided = name === "clavicle" || name === "upperarm";
    for (const s of sided ? SIDES : [null]) {
      const bone = ctx.bone(sided ? `${name}_${s}` : name); if (!bone) continue;
      const m = s ? mirror(s) : 1;
      rotateBoneAxis(bone, left.x, left.y, left.z, pitch * DEG * weight);   // about the body's left axis
      rotateBoneAxis(bone, 0, 1, 0, yaw * DEG * m * weight);
      rotateBoneAxis(bone, fwd.x, fwd.y, fwd.z, roll * DEG * m * weight);
    }
  }
};

/* ---------- gaze ---------- */
const GAZE_YAW: [string, number][] = [["spine_02", 0.08], ["spine_03", 0.14], ["neck_01", 0.3], ["Head", 0.48]];
const GAZE_PITCH: [string, number][] = [["neck_01", 0.4], ["Head", 0.6]];
const MAX_HEAD_YAW = 75 * DEG, MAX_HEAD_PITCH_UP = 35 * DEG, MAX_HEAD_PITCH_DOWN = 40 * DEG;

const hp = new THREE.Vector3(), hd = new THREE.Vector3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), hs = new THREE.Vector3(), headFacing = new THREE.Vector3(), rootQ = new THREE.Quaternion();

/** Yaw and pitch of a world direction, relative to the body (left/forward axes must be set). */
const anglesOf = (d: THREE.Vector3) => ({ yaw: Math.atan2(d.dot(left), d.dot(fwd)), pitch: Math.atan2(d.y, Math.hypot(d.dot(left), d.dot(fwd))) });

const applyGaze = (ctx: PoseContext, state: FrameState) => {
  const head = ctx.bone("Head"); if (!head || !state.look.length) return;
  head.updateWorldMatrix(true, false);
  // where the head faces now (the clip's own movement, e.g. the walk bob), as a deviation from its bind pose
  head.matrixWorld.decompose(hp, hq, hs);
  ctx.root.getWorldQuaternion(rootQ);
  rq.copy(rootQ).multiply(ctx.restWorld.get("Head")!).invert();
  headFacing.copy(fwd).applyQuaternion(hq.multiply(rq));
  const now = anglesOf(headFacing);
  hp.y += 0.07 * ctx.scale; // roughly the eyes
  let dYaw = 0, dPitch = 0, wSum = 0;
  for (const it of state.look) wSum += it.wHead;
  const norm = wSum > 1 ? 1 / wSum : 1;
  for (const it of state.look) {
    if (it.wHead <= 0) continue;
    let yawT = it.yaw, pitchT = it.pitch;
    if (it.point) { hd.set(it.point[0], it.point[1], it.point[2]).sub(hp); const a = anglesOf(hd); yawT = a.yaw; pitchT = a.pitch; }
    yawT = clamp(yawT, -MAX_HEAD_YAW, MAX_HEAD_YAW); pitchT = clamp(pitchT, -MAX_HEAD_PITCH_DOWN, MAX_HEAD_PITCH_UP);
    dYaw += it.wHead * norm * wrapPi(yawT - now.yaw);
    dPitch += it.wHead * norm * (pitchT - now.pitch);
  }
  for (const [name, share] of GAZE_YAW) { const b = ctx.bone(name); if (b) rotateBoneAxis(b, 0, 1, 0, dYaw * share); }
  for (const [name, share] of GAZE_PITCH) { const b = ctx.bone(name); if (b) rotateBoneAxis(b, left.x, left.y, left.z, -dPitch * share); }
};

/* ---------- arms ---------- */
const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), wrist = new THREE.Vector3(), goal = new THREE.Vector3(), pole = new THREE.Vector3(), aim = new THREE.Vector3(), tmp = new THREE.Vector3();
const WAVE_PERIOD = 17; // frames

const armLength = (upper: THREE.Object3D, lower: THREE.Object3D, hand: THREE.Object3D) => {
  upper.updateWorldMatrix(true, true);
  worldPos(upper, shoulder); worldPos(lower, elbow); worldPos(hand, wrist);
  return shoulder.distanceTo(elbow) + elbow.distanceTo(wrist);
};

const solveArm = (ctx: PoseContext, hand: Hand, state: FrameState): HandPose => {
  const s = hand === "left" ? "l" : "r", out = hand === "left" ? 1 : -1; // out: the direction away from the body
  const arm = state.arms[hand];
  const upper = ctx.bone(`upperarm_${s}`), lower = ctx.bone(`lowerarm_${s}`), end = ctx.bone(`hand_${s}`);
  let pose: HandPose = HAND_POSES.relaxed;
  if (!upper || !lower || !end) return pose;

  if (arm.carry > 0.001) {
    // Hold the prop low and a little forward. The target is measured from the shoulder, so it moves with the torso and the walk bob.
    const L = armLength(upper, lower, end);
    goal.copy(shoulder).addScaledVector(left, out * 0.26 * L).addScaledVector(UP, -0.8 * L).addScaledVector(fwd, 0.4 * L);
    pole.copy(UP).multiplyScalar(-1).addScaledVector(left, out * 0.5).addScaledVector(fwd, -0.3);
    solveTwoBone(upper, lower, end, goal, pole, 0.92 * arm.carry);
    pose = mixPose(pose, HAND_POSES.grip, arm.carry);
  }

  if (arm.gesture && arm.gestureWeight > 0.001) {
    const w = arm.gestureWeight, L = armLength(upper, lower, end);
    if (arm.gesture === "wave") {
      const sway = Math.sin((state.frame / WAVE_PERIOD) * Math.PI * 2);
      goal.copy(shoulder).addScaledVector(left, out * (0.32 + 0.12 * sway) * L).addScaledVector(UP, 0.62 * L).addScaledVector(fwd, 0.28 * L);
      pole.copy(UP).multiplyScalar(-1).addScaledVector(left, out * 0.9).addScaledVector(fwd, -0.2);
      solveTwoBone(upper, lower, end, goal, pole, w);
      aim.copy(UP).addScaledVector(left, out * (0.3 + 0.3 * sway));
      const tip = ctx.bone(`middle_01_${s}`); if (tip) aimBone(end, tip, aim, w);
      pose = mixPose(pose, HAND_POSES.open, w);
    } else if (arm.target) {
      const t = arm.target;
      if (arm.gesture === "point") {
        aim.set(t[0], t[1], t[2]).sub(shoulder).normalize();
        goal.copy(shoulder).addScaledVector(aim, 0.9 * L);
        pole.copy(UP).multiplyScalar(-1).addScaledVector(left, out * 0.6);
        solveTwoBone(upper, lower, end, goal, pole, w);
        const tip = ctx.bone(`middle_01_${s}`); if (tip) aimBone(end, tip, aim, w);
        pose = mixPose(pose, HAND_POSES.point, ease(w * 1.4));
      } else {
        // reach: the hand goes to the object; the fingers open on the way and close around it at the end
        tmp.set(t[0], t[1], t[2]);
        pole.copy(UP).multiplyScalar(-1).addScaledVector(left, out * 0.8);
        solveTwoBone(upper, lower, end, tmp, pole, w);
        const grab = ease((arm.progress - 0.55) / 0.2);
        pose = mixPose(mixPose(pose, HAND_POSES.open, w), HAND_POSES.grip, grab * w);
      }
    }
  }
  return pose;
};

/* ---------- the layers ---------- */
export type Performance = {
  stateAt: (frame: number) => FrameState;
  layers: PoseLayer[];
};

/** Builds the pose layers for a script. `env` is the scene's target table and the character's foot-locked motion. Keep the result in useMemo. */
export const createPerformance = (script: CharacterScript, env: FrameEnv, extras?: { mouth?: (ctx: PoseContext, p: FaceParams) => void; /** Seed for this character's blink schedule. Give each character a different one. */ blinkSeed?: number }): Performance => {
  const chain = locoChain(script);
  let lastFrame = NaN, last: FrameState | null = null;
  const stateAt = (frame: number) => { if (frame !== lastFrame || !last) { last = evaluate(script, chain, frame, env); lastFrame = frame; } return last; };
  const blinks = blinkStarts(extras?.blinkSeed ?? 7);
  const hands: Record<Hand, HandPose> = { left: HAND_POSES.relaxed, right: HAND_POSES.relaxed };

  const posture: PoseLayer = (ctx) => {
    const st = stateAt(ctx.frame);
    setAxes(st.yaw);
    for (const e of Object.keys(st.emotions) as Emotion[]) applyPosture(ctx, POSTURE[e], st.emotions[e] ?? 0);
    applyPosture(ctx, STARTLE, st.startle);
    // lean toward the object being reached for
    for (const hand of ["left", "right"] as const) {
      const a = st.arms[hand];
      if (a.gesture !== "reach" || !a.target) continue;
      const head = ctx.bone("Head"); if (!head) continue;
      head.updateWorldMatrix(true, false); worldPos(head, hp);
      hd.set(a.target[0], a.target[1], a.target[2]).sub(hp);
      const ang = anglesOf(hd), w = a.gestureWeight, yaw = clamp(ang.yaw, -45 * DEG, 45 * DEG);
      for (const [name, share] of [["spine_01", 0.2], ["spine_02", 0.35], ["spine_03", 0.35]] as const) {
        const b = ctx.bone(name); if (!b) continue;
        rotateBoneAxis(b, 0, 1, 0, yaw * share * w * 0.6);
        rotateBoneAxis(b, left.x, left.y, left.z, 7 * DEG * share * w);
      }
    }
  };
  const gaze: PoseLayer = (ctx) => { const st = stateAt(ctx.frame); setAxes(st.yaw); applyGaze(ctx, st); };
  const arms: PoseLayer = (ctx) => {
    const st = stateAt(ctx.frame); setAxes(st.yaw);
    hands.left = solveArm(ctx, "left", st); hands.right = solveArm(ctx, "right", st);
  };
  const fingers: PoseLayer = (ctx) => { applyHandPose(ctx, "l", hands.left); applyHandPose(ctx, "r", hands.right); };
  const face: PoseLayer = (ctx) => { const st = stateAt(ctx.frame); applyFace(ctx, st, extras?.mouth ? (p) => extras.mouth!(ctx, p) : undefined, blinks); };
  void lerp;
  return { stateAt, layers: [posture, gaze, arms, fingers, face] };
};
