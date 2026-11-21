import { presets, shot } from "./camera/presets";
import type { Shot } from "./camera/shots";
import type { LightingKey } from "./lighting";
import type { CharacterScript, TargetTable } from "./animation/script";
import type { Motion } from "./animation/motion";

/* Second-character compatibility test (6 s) as plain data. The companion walks up to the traveller; they look at each other;
 * he is surprised, she waves. It uses the same scripts, camera and lighting code as the main demo. */
export const FPS = 30, FRAMES = 180;

export const TRAVELLER_2: CharacterScript = {
  start: { x: 0, z: -4.2, yaw: 180 }, // faces -z, toward her
  actions: [
    { type: "carry", hand: "left", from: 0, to: FRAMES, blend: 10 },
    { type: "look", from: 18, to: 175, at: { target: "companion.head" } },
    { type: "startle", from: 52, to: 100, strength: 0.6 },
    { type: "emotion", emotion: "happy", from: 100, to: 175, intensity: 0.8 },
  ],
};
export const COMPANION: CharacterScript = {
  start: { x: 0.15, z: -7.8, yaw: 0 }, // faces +z, toward him
  actions: [
    { type: "walk", from: 24, to: 90, blend: 16 },
    { type: "look", from: 0, to: 175, at: { target: "traveller.head" } },
    { type: "wave", from: 104, to: 168, hand: "right" },
    { type: "emotion", emotion: "happy", from: 96, to: 175, intensity: 1 },
  ],
};

export const targets = (m: Record<string, Motion>): TargetTable => {
  const a = m.traveller, b = m.companion;
  if (!a || !b) return {};
  return { mid: () => [(a.x[FRAMES] + b.x[FRAMES]) / 2, 0.95, (a.z[FRAMES] + b.z[FRAMES]) / 2] };
};
export const SHOTS: Shot[] = [
  // Camera on his left side (the lantern hand) and her right side (the waving hand), so both are seen in profile, facing each other.
  shot("two-shot", 0, FRAMES, presets.fullBody("mid", { fit: 5.0, azimuth: -90, elevation: 3, relative: false, height: 0, screen: { x: 0, y: -0.02 } }), {
    end: presets.medium("mid", { fit: 4.2, azimuth: -80, elevation: 2, relative: false, height: 0, screen: { x: 0, y: 0 } }), motion: "smooth",
  }),
];
export const LIGHTING_KEYS: LightingKey[] = [{ frame: 0, preset: "sunset" }];

export const STORY_DATA = {
  fps: FPS, frames: FRAMES, shots: SHOTS, targets,
  actors: [
    { id: "traveller", script: TRAVELLER_2, height: 1.75, clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] },
    { id: "companion", visible: [110, 180] as [number, number], script: COMPANION, height: 1.68, clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] },
  ],
};
