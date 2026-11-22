import { clamp, ease, DEG } from "./math";

/* ------------------------------------------------------------------------------------------------
 * The story interface. A CharacterScript is a plain, typed list of actions on a frame timeline.
 * `evaluate(script, chain, frame, env)` turns it into a FrameState: a pure function of the frame number, so any single
 * frame can be rendered on its own and gives the same result as rendering all the frames before it.
 *
 * Example (what a story writes):
 *   { start: { x: 0, z: -7, yaw: 0 },
 *     actions: [
 *       { type: "walk",    from: 0,   to: 45 },
 *       { type: "idle",    from: 46,  to: 75 },
 *       { type: "look",    from: 76,  to: 105, at: { yaw: 70 } },        // look 70 degrees to the left
 *       { type: "startle", from: 106, to: 135 },                          // surprise
 *       { type: "reach",   from: 136, to: 180, hand: "right", at: "post" },
 *     ] }
 *
 * Actions of different kinds run side by side (a character can walk, look and carry at once).
 * Movement actions (idle, walk, run) follow each other; the later one takes over with a short blend.
 * Angles are in degrees. +yaw = to the character's left, +pitch = up.
 * ---------------------------------------------------------------------------------------------- */

export type Vec3 = [number, number, number];
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "fear" | "surprise";
export type Hand = "left" | "right";
/** A name from the scene's target table (see `FrameEnv.targets`), or a fixed point in world space (metres). */
export type Target = string | Vec3;
export type Gaze = { target: Target } | { yaw?: number; pitch?: number };
export type LocoKind = "idle" | "walk" | "run";

type Timed = {
  /** First frame of the action. */
  from: number;
  /** Frame where the action has ended. */
  to: number;
  /** Frames used to fade in and out. Each action type has a sensible default. */
  blend?: number;
};

export type Action =
  /** Movement. Gaps between movement actions count as idle. Changing between them blends the clips; the distance walked follows the feet. */
  | (Timed & { type: LocoKind })
  /** Turn the whole body between `from` and `to`. `yaw` is a world angle in degrees (0 = +z, +90 = +x). `toward` faces a target (resolved at `from`). */
  | (Timed & { type: "turn"; yaw?: number; toward?: Target })
  /** Look somewhere. The eyes lead, then the head and neck follow after `lag` frames. */
  | (Timed & { type: "look"; at: Gaze; lag?: number })
  /** Show an emotion on the face and in the posture. `intensity` is 0 to 1. */
  | (Timed & { type: "emotion"; emotion: Emotion; intensity?: number })
  /** A sudden reaction at frame `from` (jolt, then settle), with a face to match. The face holds until `to`. */
  | (Timed & { type: "startle"; strength?: number; emotion?: Emotion })
  /** Arm gestures. Point and reach need `at`. Wave does not. The other arm is not affected. */
  | (Timed & { type: "point" | "reach" | "wave"; hand: Hand; at?: Target })
  /** Hold a carried prop (for example a lantern) low and steady, with a relaxed grip. */
  | (Timed & { type: "carry"; hand: Hand })
  /** Set the finger pose of one hand for a while: a name from HAND_POSES (`"flat"`, `"cupped"`, `"fist"`...) or some fingers (`{ index: 0, middle: 0.9 }`, 0 straight, 1 closed). Arm gestures and carrying still decide where the hand is. */
  | (Timed & { type: "hand"; hand: Hand; pose: HandPoseName | Partial<Record<"thumb" | "index" | "middle" | "ring" | "pinky", number>> });
export type HandPoseName = "relaxed" | "cupped" | "flat" | "open" | "fist" | "point" | "grip";

export type CharacterScript = {
  /** Where and which way the character stands at frame 0. Position in metres, yaw in degrees (0 = facing +z). */
  start?: { x: number; z: number; yaw: number };
  actions: Action[];
};

export type TargetTable = Record<string, (frame: number) => Vec3>;
/** What the evaluator needs from the scene: named targets (as functions of the frame) and the foot-locked motion of the character. */
export type FrameEnv = { targets: TargetTable; motion: { x: ArrayLike<number>; z: ArrayLike<number>; yaw: ArrayLike<number> } };

export type LookItem = { wEye: number; wHead: number; point: Vec3 | null; yaw: number; pitch: number };
export type ArmItem = { carry: number; gesture: "point" | "reach" | "wave" | null; gestureWeight: number; target: Vec3 | null; /** 0 to 1 through the gesture action. */ progress: number;
  /** A finger pose asked for by a `hand` action, and how strongly it applies (0 to 1). */ fingers: Extract<Action, { type: "hand" }>["pose"] | null; fingersWeight: number };
export type FrameState = {
  frame: number;
  /** Where the character is, in world space (metres, radians). */
  x: number; z: number; yaw: number;
  /** Clip weights for idle / walk / run. They add up to 1. */
  loco: Record<LocoKind, number>;
  look: LookItem[];
  emotions: Partial<Record<Emotion, number>>;
  /** 0 to 1: strength of the sudden-reaction jolt in the body. */
  startle: number;
  arms: Record<Hand, ArmItem>;
};

/* ---------- helpers ---------- */
const LOCO_BLEND: Record<string, number> = { "idle>walk": 14, "walk>idle": 30, "walk>run": 12, "run>walk": 16, "idle>run": 16, "run>idle": 30 };
export const DEFAULT_BLEND = { turn: 20, look: 10, emotion: 12, startle: 12, gesture: 10, carry: 12 };

/** 0 -> 1 -> 0 envelope of an action: fades in over `blend` frames, holds, fades out over `blend` frames before `to`. */
export const envelope = (frame: number, a: { from: number; to: number }, blend: number, shift = 0) =>
  ease((frame - a.from - shift) / blend) * (1 - ease((frame - (a.to - blend) - shift) / blend));

const byStart = <T extends { from: number }>(list: T[]) => [...list].sort((a, b) => a.from - b.from);
const isLoco = (a: Action): a is Timed & { type: LocoKind } => a.type === "idle" || a.type === "walk" || a.type === "run";

export type LocoChain = { from: number; kind: LocoKind; blend: number }[];

/** Movement actions in order, with idle filled into the gaps. */
export const locoChain = (script: CharacterScript): LocoChain => {
  const chain: LocoChain = [{ from: -1e9, kind: "idle", blend: 1 }];
  let end = 0, prev: LocoKind = "idle";
  for (const a of byStart(script.actions.filter(isLoco))) {
    if (a.from > end && prev !== "idle") chain.push({ from: end, kind: "idle", blend: LOCO_BLEND[`${prev}>idle`] ?? 20 });
    chain.push({ from: a.from, kind: a.type, blend: a.blend ?? LOCO_BLEND[`${prev}>${a.type}`] ?? 16 });
    prev = a.type; end = a.to;
  }
  if (prev !== "idle") chain.push({ from: end, kind: "idle", blend: LOCO_BLEND[`${prev}>idle`] ?? 20 });
  return chain;
};

export const locoAt = (chain: LocoChain, frame: number): Record<LocoKind, number> => {
  let w: Record<LocoKind, number> = { idle: 1, walk: 0, run: 0 };
  for (const c of chain) {
    if (frame < c.from) break;
    const t = ease((frame - c.from) / c.blend);
    w = { idle: w.idle * (1 - t) + (c.kind === "idle" ? t : 0), walk: w.walk * (1 - t) + (c.kind === "walk" ? t : 0), run: w.run * (1 - t) + (c.kind === "run" ? t : 0) };
  }
  return w;
};

export const resolveTarget = (t: Target | undefined, frame: number, env: FrameEnv): Vec3 | null => {
  if (t === undefined) return null;
  if (Array.isArray(t)) return t;
  const f = env.targets[t];
  if (!f) { console.warn(`[cinematic] Unknown target "${t}".`); return null; }
  return f(frame);
};

/** The state of the whole character at one frame. Pure: depends only on its arguments. */
export const evaluate = (script: CharacterScript, chain: LocoChain, frame: number, env: FrameEnv): FrameState => {
  const i = clamp(Math.round(frame), 0, env.motion.x.length - 1);
  const state: FrameState = {
    frame, x: env.motion.x[i], z: env.motion.z[i], yaw: env.motion.yaw[i],
    loco: locoAt(chain, frame), look: [], emotions: {}, startle: 0,
    arms: { left: { carry: 0, gesture: null, gestureWeight: 0, target: null, progress: 0, fingers: null, fingersWeight: 0 }, right: { carry: 0, gesture: null, gestureWeight: 0, target: null, progress: 0, fingers: null, fingersWeight: 0 } },
  };
  let emotionSum = 0;
  const addEmotion = (e: Emotion, w: number) => { if (w <= 0) return; state.emotions[e] = (state.emotions[e] ?? 0) + w; emotionSum += w; };

  for (const a of script.actions) {
    if (frame < a.from - 1 || frame > a.to + 40) continue; // the head lags the eyes, so a look can fade out a little after `to`
    switch (a.type) {
      case "look": {
        const blend = a.blend ?? DEFAULT_BLEND.look, lag = a.lag ?? 6;
        const wEye = envelope(frame, a, blend), wHead = envelope(frame, a, blend, lag);
        if (wEye <= 0 && wHead <= 0) break;
        const g = a.at;
        const point = "target" in g ? resolveTarget(g.target, frame, env) : null;
        state.look.push({ wEye, wHead, point, yaw: "target" in g ? 0 : (g.yaw ?? 0) * DEG, pitch: "target" in g ? 0 : (g.pitch ?? 0) * DEG });
        break;
      }
      case "emotion": addEmotion(a.emotion, (a.intensity ?? 1) * envelope(frame, a, a.blend ?? DEFAULT_BLEND.emotion)); break;
      case "startle": {
        if (frame < a.from || frame > a.to) break;
        const t = frame - a.from, strength = a.strength ?? 1;
        state.startle = Math.max(state.startle, strength * (t < 3 ? t / 3 : Math.exp(-(t - 3) / 9)));
        // The face reacts faster than it relaxes: quick in, held, then eased out over the last 15 frames.
        addEmotion(a.emotion ?? "surprise", strength * ease(t / 3) * (1 - ease((frame - (a.to - 15)) / 15)));
        break;
      }
      case "point": case "reach": case "wave": {
        const arm = state.arms[a.hand], w = envelope(frame, a, a.blend ?? DEFAULT_BLEND.gesture);
        if (w > arm.gestureWeight) { arm.gesture = a.type; arm.gestureWeight = w; arm.target = resolveTarget(a.at, frame, env); arm.progress = clamp((frame - a.from) / Math.max(a.to - a.from, 1)); }
        break;
      }
      case "hand": { const arm = state.arms[a.hand], w = envelope(frame, a, a.blend ?? DEFAULT_BLEND.gesture); if (w > arm.fingersWeight) { arm.fingers = a.pose; arm.fingersWeight = w; } break; }
      case "carry": { const arm = state.arms[a.hand]; arm.carry = Math.max(arm.carry, envelope(frame, a, a.blend ?? DEFAULT_BLEND.carry)); break; }
      default: break; // movement and turns are handled by the locomotion chain and the motion builder
    }
  }
  if (emotionSum > 1) for (const k of Object.keys(state.emotions) as Emotion[]) state.emotions[k]! /= emotionSum;
  for (const hand of ["left", "right"] as const) state.arms[hand].carry *= 1 - state.arms[hand].gestureWeight; // a gesture takes over from carrying
  return state;
};

export type TurnAction = Extract<Action, { type: "turn" }>;
export const turnActions = (script: CharacterScript): TurnAction[] => byStart(script.actions.filter((a): a is TurnAction => a.type === "turn"));
