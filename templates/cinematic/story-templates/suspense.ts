import { DEFAULTS, narrate, presets, pushIn, shot, secs, type CharacterScript, type Options, type StorySpec } from "./spec";

/** Suspense or mystery: a quiet room, a sound, a figure at the door. Low-key light, slow push-ins, hard cuts. Workshop set. */
export const suspense = (opts: Partial<Options> = {}): StorySpec => {
  const O = { ...DEFAULTS, ...opts }, S = secs(O), F = S(O.seconds), at = (p: number) => Math.round(p * F);
  const hero: CharacterScript = {
    start: { x: 0.9, z: -2.8, yaw: 0 },
    actions: [
      { type: "look", from: 0, to: at(0.35), at: { target: "desk" } },
      { type: "look", from: at(0.38), to: at(0.62), at: { target: "door" } },                 // he hears something
      { type: "emotion", emotion: "fear", from: at(0.45), to: F, intensity: 0.8 },
      { type: "startle", from: at(0.66), to: at(0.78), strength: 0.9, emotion: "fear" },
      { type: "look", from: at(0.68), to: F, at: { target: "stranger.head" } },
    ],
  };
  const stranger: CharacterScript = {
    start: { x: 2.3, z: -4.6, yaw: 0 },
    actions: [{ type: "walk", from: at(0.6), to: at(0.72), blend: 10 }, { type: "look", from: at(0.6), to: F, at: { target: "hero.head" } }],
  };
  const wide = presets.establishingWide([1.0, 0, -2.4], { fit: 5.4, elevation: 4, height: 1.1 });
  const med = presets.medium("hero", { follow: "live", fit: 1.9, azimuth: 14, height: 1.15 });
  const cu = presets.closeUp("hero", { follow: "live", azimuth: -18 });
  const door = presets.lowAngle("stranger", { follow: "live", fit: 3.2, azimuth: 4 });
  return {
    id: "T-Suspense", title: "Suspense / mystery", genre: "Mystery and suspense", ...O, frames: F, environment: "workshop",
    cast: [
      { id: "hero", look: { kit: "peasant", gender: "male", hair: "Hair_SimpleParted", hairTint: "#4a3322" }, script: hero },
      { id: "stranger", look: { kit: "peasant", gender: "female", hair: "Hair_Long", hairTint: "#2c1b12" }, script: stranger, appear: [at(0.58), F], visible: [[at(0.64), at(0.8)]] },
    ],
    points: { desk: [1.0, 0.95, -1.9], door: [2.3, 1.4, -3.6] },
    shots: [
      shot("quiet-room", 0, at(0.3), wide, { end: pushIn(wide, 0.2) }),
      shot("he-works", at(0.3), at(0.45), med, { end: pushIn(med, 0.08), transition: { type: "cut" } }),
      shot("the-sound", at(0.45), at(0.64), cu, { end: pushIn(cu, 0.1), transition: { type: "cut" } }),
      shot("the-door", at(0.64), at(0.8), door, { end: pushIn(door, 0.1), transition: { type: "cut" } }),
      shot("aftermath", at(0.8), F, med, { end: pushIn(med, 0.12), transition: { type: "cut" } }),
    ],
    lighting: [{ frame: 0, preset: "indoorWarm" }, { frame: at(0.4), preset: "dramaticLowKey", blend: S(2) }],
    endFade: S(0.5),
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder narration: keep it short, leave silences.",
      narration: narrate([[1.0, "It was past midnight."], [O.seconds * 0.5, "The shop was locked. He was sure of it."]]),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -32 }, { type: "tick", from: 0, to: O.seconds, gain_db: -26, period: 1.6 }, { type: "drone", from: O.seconds * 0.4, to: O.seconds, gain_db: -24 }],
      cues: [{ t: O.seconds * 0.58, type: "door", gain_db: -18 }, { t: O.seconds * 0.66, type: "sting", gain_db: -14 }],
    },
    placeholders: ["narration text", "who the stranger is (change look, hair, outfit)", "the reveal: add a prop at the door point"],
  };
};
