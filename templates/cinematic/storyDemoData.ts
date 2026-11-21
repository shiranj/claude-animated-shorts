import { presets, pushIn, pullBack, orbit, shot } from "./camera/presets";
import type { Shot } from "./camera/shots";
import type { LightingKey } from "./lighting";
import type { CharacterScript, TargetTable, Vec3 } from "./animation/script";
import type { Motion } from "./animation/motion";

/* The story of the P3 demo as plain data (no React, no browser), so tools can check it in Node. See StoryDemo.tsx for the scene. */

export const FPS = 30, FRAMES = 540;
export const FLASH = 288; // the crystal flares
export const STOPPED = 214; // frame by which the traveller stands still (walk ends at 170, blends to idle over 42 frames)

export const TRAVELLER: CharacterScript = {
  start: { x: 0, z: -9, yaw: 0 },
  actions: [
    { type: "walk", from: 32, to: 170, blend: 30 },                   // stands, then walks; the walk ends at a point in the step cycle with little foot sliding
    { type: "idle", from: 170, to: FRAMES, blend: 42 },
    { type: "turn", from: 60, to: 170, yaw: -20 },
    { type: "carry", hand: "left", from: 0, to: FRAMES, blend: 20 },
    { type: "look", from: STOPPED + 4, to: 470, at: { target: "crystal" } },
    { type: "startle", from: FLASH, to: 332 },
    { type: "reach", from: 356, to: 450, hand: "left", at: "lanternUp" }, // lifts the lantern to look closer
    { type: "emotion", emotion: "happy", from: 380, to: 500, intensity: 0.7 },
  ],
};

export const targets = (m: Record<string, Motion>): TargetTable => {
  const t = m.traveller;
  if (!t) return {};
  const at = (f: number) => Math.min(Math.max(Math.round(f), 0), FRAMES);
  const crystal: Vec3 = [t.x[STOPPED] - 1.1, 1.05, t.z[STOPPED] + 0.6];
  return {
    crystal: () => crystal,
    // between the traveller (as he stands when he stops) and the crystal: the over-the-shoulder shot looks here so both are in frame
    lookMid: () => [(t.x[STOPPED] + crystal[0]) / 2, 1.15, (t.z[STOPPED] + crystal[2]) / 2],
    // where the lantern goes when it is lifted: in front of the chest, a little to the traveller's left
    lanternUp: (f) => { const i = at(f), h = t.yaw[i]; return [t.x[i] + Math.sin(h) * 0.4 + Math.cos(h) * 0.12, 1.3, t.z[i] + Math.cos(h) * 0.4 - Math.sin(h) * 0.12]; },
    // the middle of the traveller and the crystal, for the last shot
    pair: () => [(t.x[at(FRAMES)] + crystal[0]) / 2, 1.0, (t.z[at(FRAMES)] + crystal[2]) / 2],
  };
};

export const SHOTS: Shot[] = [
    // 1. Establishing wide: a fixed high-ish lens on the middle of the trail. The traveller walks into it from the far end.
    shot("establishing", 0, 120, presets.establishingWide([0.4, 0, -6], { fit: 7.5, screen: { x: -0.2, y: -0.1 } }), { end: pushIn(presets.establishingWide([0.4, 0, -6], { fit: 7.5, screen: { x: -0.2, y: -0.1 } }), 0.4), motion: "late" }),
    // 2. Medium tracking: the camera stays in front of him and backs away as he walks, then settles when he stops.
    shot("tracking", 120, 232, presets.medium("traveller", { follow: "live", fit: 1.9, azimuth: 24, height: 1.1 }), { transition: { type: "blend", frames: 54 } }),
    // 3. Over the shoulder: from behind him, toward the crystal he has just noticed.
    shot("over-shoulder", 232, 284, presets.overShoulder("lookMid", "traveller", { distance: 2.2, side: 0.1, camHeight: 1.6, height: 0, fov: 46 }), { end: pushIn(presets.overShoulder("lookMid", "traveller", { distance: 2.2, side: 0.1, camHeight: 1.6, height: 0, fov: 46 }), 0.08), transition: { type: "cut" } }),
    // 4. Close-up on the reaction. Short, and no tighter than head and shoulders.
    shot("reaction", 284, 350, presets.closeUp("traveller", { follow: "live", azimuth: -32, screen: { x: -0.08, y: 0.04 } }), { end: pushIn(presets.closeUp("traveller", { follow: "live", azimuth: -32, screen: { x: -0.08, y: 0.04 } }), 0.06), transition: { type: "cut" } }),
    // 5. Medium shot while the lantern is lifted; slow push-in.
    shot("lantern", 350, 450, presets.medium("traveller", { follow: "live", fit: 1.7, azimuth: -28, height: 1.2, screen: { x: -0.12, y: 0.02 } }), { end: pushIn(presets.medium("traveller", { follow: "live", fit: 1.7, azimuth: -28, height: 1.2, screen: { x: -0.12, y: 0.02 } }), 0.12), transition: { type: "blend", frames: 44 } }),
    // 6. Final composition: wide, low, traveller and crystal on the two third lines, slow pull-back.
    shot("final", 450, FRAMES, presets.establishingWide("pair", { fit: 3.9, azimuth: 28, elevation: 3, screen: { x: 0, y: -0.2 }, height: 0.1 }), { end: orbit(pullBack(presets.establishingWide("pair", { fit: 3.9, azimuth: 28, elevation: 3, screen: { x: 0, y: -0.2 }, height: 0.1 }), 0.2), -10), transition: { type: "fade", frames: 18 } }),
  ];

export const LIGHTING_KEYS: LightingKey[] = [
    { frame: 0, preset: "night" },
    { frame: 250, preset: "magical", blend: 40 },     // the crystal wakes
    { frame: 400, preset: "sunset", blend: 90 },       // and dawn comes up
  ];

/** What check-shots.mjs needs. */
export const STORY_DATA = {
  fps: FPS, frames: FRAMES, shots: SHOTS, targets,
  actors: [{ id: "traveller", script: TRAVELLER, height: 1.75, clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] }],
};
