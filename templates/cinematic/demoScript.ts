import type { CharacterScript } from "./animation/script";

/* The story of the animation demo, as plain data. Frames at 30 fps. See animation/script.ts for all action types. */
export const DEMO_START: [number, number] = [0, -7];
export const FLASH = 226; // the crystal flares at FLASH

/** The story. Each line is one action on the timeline (frames at 30 fps). */
export const DEMO_SCRIPT: CharacterScript = {
  start: { x: DEMO_START[0], z: DEMO_START[1], yaw: 0 },
  actions: [
    // The start and stop times were chosen by sweeping for the least foot sliding (see README): the clip phase matters.
    { type: "walk", from: 32, to: 130, blend: 30 },                          // stands, then walks, curving slightly to the right
    { type: "idle", from: 130, to: 420, blend: 42 },                         // slows and stops
    { type: "turn", from: 60, to: 140, yaw: -20 },
    { type: "carry", hand: "left", from: 0, to: 420, blend: 20 },            // the lantern stays in the left hand
    { type: "look", from: 176, to: 350, at: { target: "crystal" } },         // notices the crystal
    { type: "startle", from: FLASH, to: 266 },                               // it flares: jolt and a surprised face
    { type: "point", from: 280, to: 350, hand: "right", at: "crystal" },     // points at it
    { type: "emotion", emotion: "happy", from: 302, to: 416, intensity: 0.9 },
    { type: "look", from: 346, to: 414, at: { target: "camera" } },          // turns to the camera and smiles
  ],
};
