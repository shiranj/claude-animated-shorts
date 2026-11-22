import { presets, pushIn, pullBack, orbit, shot } from "../camera/presets";
import type { Shot } from "../camera/shots";
import { LIGHTING, type LightingKey, type Lighting } from "../lighting";
import type { CharacterScript, TargetTable, Vec3 } from "../animation/script";
import type { Motion } from "../animation/motion";

/* ------------------------------------------------------------------------------------------------
 * "Five Seconds Ahead" (36 s, 1080 x 1920, 30 fps): a clockmaker finds a pocket watch that shows five seconds of tomorrow. He uses it
 * for small things. Then it shows him something he cannot stop. This is the P4 validation story: a different genre, two characters,
 * another environment (the workshop), four lighting looks and a prop that matters (the watch, and the clock that falls).
 *
 * Everything here is plain data (no React, no browser) so check-shots.mjs can check it in Node. The scene is in FiveSeconds.tsx.
 * Narration and sound cues for the story are in fiveSecondsAudio.json.
 * ---------------------------------------------------------------------------------------------- */

export const FPS = 30, FRAMES = 1080;

/* ---- the clock that falls (a pure function of the frame) ---- */
export const MANTEL = { start: [-0.45, 2.69, -3.35] as Vec3, wobbleFrom: 662, fallAt: 690, floorY: 0.17, landZ: -2.75, impact: 690 + 19 };
/** Where the mantel clock is, and how it is tilted, at a frame. After the impact the clock lies on the floor. */
export const mantelAt = (f: number): { pos: Vec3; tiltZ: number; tiltX: number; whole: boolean } => {
  const M = MANTEL, [x, y0, z0] = M.start;
  if (f < M.wobbleFrom) return { pos: [x, y0, z0], tiltZ: 0, tiltX: 0, whole: true };
  if (f < M.fallAt) { const t = (f - M.wobbleFrom) / (M.fallAt - M.wobbleFrom); return { pos: [x, y0, z0 + 0.1 * t * t], tiltZ: 0.1 * Math.sin(t * 30) * t, tiltX: -0.35 * t * t, whole: true }; }
  const t = Math.min((f - M.fallAt) / FPS, 0.64), g = 9.8;
  const y = Math.max(y0 - 0.5 * g * t * t, M.floorY), z = z0 + 0.1 + (M.landZ - z0 - 0.1) * Math.min(t / 0.64, 1);
  if (f < M.impact) return { pos: [x, y, z], tiltZ: 0, tiltX: -0.35 - 3.2 * t, whole: true };
  return { pos: [x - 0.04, M.floorY - 0.05, M.landZ], tiltZ: 1.2, tiltX: -1.5, whole: false };
};
export const SHARD_COUNT = 11;
/** Position of shard `i` at a frame after the impact (deterministic, no random numbers at render time). */
export const shardAt = (i: number, f: number): { pos: Vec3; rot: Vec3 } | null => {
  const dt = (f - MANTEL.impact) / FPS; if (dt < 0) return null;
  const a = i * 2.399, sp = 0.7 + 0.5 * ((i * 7) % 5) / 5, s = Math.min(dt, 0.55);
  const x = -0.45 + Math.cos(a) * sp * s * 0.9, z = MANTEL.landZ + Math.sin(a) * sp * s * 0.9;
  const y = Math.max(MANTEL.floorY - 0.14 + 1.7 * s - 4.9 * s * s, 0.03);
  return { pos: [x, y, z], rot: [i + dt * 3, i * 2 + dt * 2, i * 3] };
};

/* ---- the watch ---- */
/** 0 = a plain watch, 1 = the face glows. It glows when Tom looks at it: the first time (frame 205 to 305), and again (frame 560 to 720). */
export const watchGlow = (f: number): number => {
  const bump = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min((f - a) / (b - a), 1, (d - f) / (d - c)));
  return Math.max(bump(205, 235, 285, 320), bump(540, 575, 680, 730));
};

/* ---- the actors ---- */
export const TOM: CharacterScript = {
  start: { x: 0.9, z: -2.8, yaw: 0 },
  actions: [
    { type: "hand", hand: "right", pose: { thumb: 0.65, index: 0.7, middle: 0.5, ring: 0.5, pinky: 0.5 }, from: 0, to: FRAMES, blend: 8 }, // pinches the watch chain
    { type: "look", from: 0, to: 112, at: { target: "counterTop" } },                // working at the counter
    { type: "reach", from: 96, to: 322, hand: "right", at: "watchUp" },              // lifts the watch to look at it and keeps it up while it glows
    { type: "look", from: 108, to: 330, at: { target: "watchUp" } },
    { type: "startle", from: 240, to: 296, strength: 0.7, emotion: "surprise" },    // the watch shows tomorrow
    { type: "emotion", emotion: "happy", from: 296, to: 540, intensity: 0.85 },
    { type: "look", from: 326, to: 548, at: { target: "mara.head" } },               // he sees her before she speaks
    { type: "reach", from: 536, to: 732, hand: "right", at: "watchUp" },             // he checks the watch again
    { type: "look", from: 548, to: 662, at: { target: "watchUp" } },
    { type: "emotion", emotion: "fear", from: 575, to: 740, intensity: 0.95 },
    { type: "point", from: 640, to: 724, hand: "left", at: "mantelStart" },          // he points at the shelf: too late
    { type: "look", from: 660, to: 790, at: { target: "mantelFloor" } },
    { type: "emotion", emotion: "sad", from: 735, to: 900, intensity: 0.85 },
    { type: "look", from: 790, to: 905, at: { target: "mara.head" } },
    { type: "emotion", emotion: "happy", from: 905, to: 1060, intensity: 0.6 },
    { type: "look", from: 905, to: 1060, at: { target: "pair" } },
  ],
};

export const MARA: CharacterScript = {
  start: { x: 2.3, z: -4.7, yaw: 0 },
  actions: [
    { type: "walk", from: 282, to: 392, blend: 14 },                                 // comes in through the back door, toward the camera
    { type: "look", from: 282, to: 560, at: { target: "tom.head" } },
    { type: "emotion", emotion: "surprise", from: 392, to: 450, intensity: 0.7 },    // he spoke first
    { type: "wave", from: 404, to: 462, hand: "right" },
    { type: "emotion", emotion: "happy", from: 450, to: 640, intensity: 0.9 },
    { type: "look", from: 560, to: 686, at: { target: "tom.head" } },
    { type: "look", from: 686, to: 790, at: { target: "mantelFloor" } },
    { type: "startle", from: 699, to: 760, strength: 0.8, emotion: "fear" },         // the crash
    { type: "emotion", emotion: "sad", from: 760, to: 900, intensity: 0.7 },
    { type: "look", from: 790, to: 1060, at: { target: "tom.head" } },
    { type: "emotion", emotion: "happy", from: 905, to: 1060, intensity: 0.7 },
  ],
};

/* ---- named points ---- */
export const targets = (m: Record<string, Motion>): TargetTable => {
  const tom = m.tom, mara = m.mara;
  const at = (f: number) => Math.min(Math.max(Math.round(f), 0), FRAMES);
  const t0 = tom ? [tom.x[0], tom.z[0]] : [0.9, -2.8];
  return {
    counterTop: () => [t0[0] + 0.1, 0.95, -1.9],
    watchUp: () => [t0[0] - 0.14, 1.28, t0[1] + 0.34],       // in front of his chest, to his right, near his face
    mantelStart: () => [MANTEL.start[0], MANTEL.start[1], MANTEL.start[2]],
    mantelFloor: () => [-0.45, 0.2, MANTEL.landZ],
    mantel: (f) => mantelAt(f).pos,
    pair: () => (tom && mara ? [(tom.x[at(FRAMES)] + mara.x[at(FRAMES)]) / 2, 1.05, (tom.z[at(FRAMES)] + mara.z[at(FRAMES)]) / 2] : [1.2, 1.05, -2.2]),
    shelves: () => [-1.2, 1.6, -3.3],
  };
};

/* ---- the camera ---- */
const wide = presets.establishingWide([0.9, 0, -2.4], { fit: 5.4, elevation: 5, screen: { x: 0, y: -0.05 }, height: 1.1 });
const tomMed = presets.medium("tom", { follow: "live", fit: 1.9, azimuth: 14, height: 1.15, screen: { x: 0.05, y: 0.03 } });
const watchCU = presets.closeUp("watchUp", { fit: 0.9, azimuth: 8, elevation: 2, height: 0, screen: { x: 0, y: 0 } });
const tomCU = presets.closeUp("tom", { follow: "live", azimuth: -16, elevation: -9, screen: { x: 0.04, y: 0.05 } });
const maraFull = presets.fullBody("mara", { follow: "live", fit: 3.1, azimuth: 4, screen: { x: 0, y: -0.02 } });
const twoShot = presets.medium("pair", { fit: 4.8, azimuth: -4, elevation: 2, relative: false, height: 0.35, screen: { x: 0, y: 0.02 } });
const tomFear = presets.lowAngle("tom.head", { fit: 1.25, azimuth: 16, elevation: -4, height: 0, screen: { x: 0, y: 0.04 } });
const shelfWide = presets.establishingWide([1.0, 0, -2.6], { fit: 6.6, elevation: 4, screen: { x: 0, y: -0.02 }, height: 1.35 });
const clockInsert = presets.lowAngle([-0.45, 1.3, -3.0], { fit: 3.3, azimuth: 10, elevation: -3, relative: false, height: 0 });
const aftermath = presets.medium("pair", { fit: 4.5, azimuth: 8, elevation: 1, relative: false, height: 0.35, screen: { x: 0, y: 0.02 } });
const finalWide = presets.establishingWide("pair", { fit: 5.2, elevation: 4, azimuth: -6, screen: { x: 0, y: -0.03 }, height: 0.4 });

export const SHOTS: Shot[] = [
  shot("establishing", 0, 105, wide, { end: pushIn(wide, 0.18), motion: "late" }),
  shot("tom-medium", 105, 205, tomMed, { end: pushIn(tomMed, 0.04), transition: { type: "blend", frames: 36 } }),
  shot("watch-glow", 205, 262, watchCU, { end: pushIn(watchCU, 0.1), transition: { type: "cut" } }),
  shot("tom-wonder", 262, 322, tomCU, { end: pushIn(tomCU, 0.06), transition: { type: "cut" } }),
  shot("mara-enters", 322, 420, maraFull, { end: pullBack(maraFull, 0.12), transition: { type: "cut" } }),
  shot("two-shot", 420, 530, twoShot, { end: pushIn(twoShot, 0.12), transition: { type: "cut" } }),
  shot("tom-checks", 530, 600, tomMed, { end: pushIn(tomMed, 0.08), transition: { type: "cut" } }),
  shot("tom-fear", 600, 668, tomFear, { end: pushIn(tomFear, 0.08), transition: { type: "cut" } }),
  shot("shelf-wide", 668, 684, shelfWide, { end: pushIn(shelfWide, 0.04), transition: { type: "cut" } }),
  shot("clock-falls", 684, 770, clockInsert, { transition: { type: "cut" } }),
  shot("aftermath", 770, 880, aftermath, { end: pushIn(aftermath, 0.1), transition: { type: "cut" } }),
  shot("final", 880, FRAMES, finalWide, { end: orbit(pullBack(finalWide, 0.2), 8), transition: { type: "blend", frames: 40 } }),
];

/* ---- the light ---- */
/** The workshop looks: the key light comes from the camera side so faces are lit; the window shows the sky colour. */
const LOOKS: Record<"lamp" | "magic" | "low" | "dawn", Lighting> = {
  lamp: { ...LIGHTING.indoorWarm, sky: "#2a1c3a", fog: "#2a1a12", fogNear: 6, fogFar: 26, ambient: 0.42, keyIntensity: 2.4, keyFrom: [1.8, 2.2, 3.2], fillIntensity: 0.7, rimIntensity: 0.8 },
  magic: { ...LIGHTING.magical, sky: "#2b2a66", fog: "#2a2850", fogNear: 6, fogFar: 26, ambient: 0.4, keyIntensity: 1.9, keyFrom: [-1.5, 2.2, 3.2], fillIntensity: 0.6, rimIntensity: 1.5, practical: 0.9 },
  low: { ...LIGHTING.dramaticLowKey, sky: "#0a0f1e", fog: "#0b1018", fogNear: 5, fogFar: 22, ambient: 0.3, keyIntensity: 3.0, keyFrom: [-3.2, 2.2, 2.2], fillIntensity: 0.32, rimIntensity: 1.5, practical: 1.1 },
  dawn: { ...LIGHTING.indoorWarm, sky: "#f0b98a", fog: "#d9a47a", fogNear: 6, fogFar: 26, ambient: 0.6, keyIntensity: 2.9, keyFrom: [-2.4, 2.4, 3.2], fillIntensity: 0.9, rimIntensity: 1.0, practical: 0.5, exposure: 0.98 },
};
export const LIGHTING_KEYS: LightingKey[] = [
  { frame: 0, preset: LOOKS.lamp },
  { frame: 205, preset: LOOKS.magic, blend: 26 },
  { frame: 312, preset: LOOKS.lamp, blend: 40 },
  { frame: 548, preset: LOOKS.low, blend: 50 },
  { frame: 880, preset: LOOKS.dawn, blend: 110 },
];

/** What check-shots.mjs needs. */
export const STORY_DATA = {
  fps: FPS, frames: FRAMES, shots: SHOTS, targets,
  watch: [{ name: "watchUp", frames: [205, 261] }, { name: "mantel", frames: [684, 769] }], // the watch while it glows, the clock while it falls
  // Mara must be in the picture only in some ranges: the close-ups of Tom leave her out on purpose.
  actors: [
    { id: "tom", script: TOM, height: 1.75, visible: [[0, 204], [262, 321], [420, 683], [770, FRAMES]] as [number, number][], clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] },
    { id: "mara", script: MARA, height: 1.68, visible: [[322, 529], [668, 683], [770, FRAMES]] as [number, number][], clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] },
  ],
};
