import { LIGHTING } from "../lighting";
import { DEFAULTS, narrate, presets, pushIn, pullBack, shot, secs, type CharacterScript, type Options, type StorySpec } from "./spec";

/** Low-key light with the key on the camera side, so faces stay readable (the stock preset lights from behind). */
const LOW = { ...LIGHTING.dramaticLowKey, keyFrom: [-3.2, 2.2, 2.4] as [number, number, number], ambient: 0.28, fillIntensity: 0.3 };

/** Emotional storytelling: two people, one quiet moment. Sadness gives way to a small smile. Slow camera, close-ups, warm light that grows. */
export const emotional = (opts: Partial<Options> = {}): StorySpec => {
  const O = { ...DEFAULTS, ...opts }, S = secs(O), F = S(O.seconds), at = (p: number) => Math.round(p * F);
  const a: CharacterScript = {
    start: { x: -0.7, z: -2, yaw: 0 },
    actions: [
      { type: "look", from: 0, to: at(0.35), at: { target: "ground" } },
      { type: "emotion", emotion: "sad", from: 0, to: at(0.6), intensity: 0.85 },
      { type: "look", from: at(0.4), to: F, at: { target: "b.head" } },
      { type: "emotion", emotion: "happy", from: at(0.65), to: F, intensity: 0.55 },
    ],
  };
  const b: CharacterScript = {
    start: { x: 0.7, z: -2, yaw: 0 },
    actions: [
      { type: "look", from: 0, to: at(0.3), at: { target: "a.head" } },
      { type: "emotion", emotion: "sad", from: at(0.1), to: at(0.5), intensity: 0.5 },
      { type: "emotion", emotion: "happy", from: at(0.5), to: F, intensity: 0.8 },
      { type: "wave", from: at(0.75), to: at(0.85), hand: "right" },
    ],
  };
  const two = presets.medium("mid", { relative: false, fit: 3.6, azimuth: 0, elevation: 1, height: 0.2, screen: { x: 0, y: 0.02 } });
  const cuA = presets.closeUp("a", { follow: "live", azimuth: -14 });
  const cuB = presets.closeUp("b", { follow: "live", azimuth: 14 });
  return {
    id: "T-Emotional", title: "Emotional story", genre: "Emotional / moral", ...O, frames: F, environment: "studio",
    cast: [
      { id: "a", look: { kit: "peasant", gender: "male", hair: "Hair_SimpleParted", hairTint: "#4a3322" }, script: a, visible: [[0, at(0.5) - 1], [at(0.7), F]] },
      { id: "b", look: { kit: "peasant", gender: "female", hair: "Hair_Long", hairTint: "#2c1b12" }, script: b, visible: [[0, at(0.3) - 1], [at(0.5), F]] },
    ],
    points: { ground: [-0.7, 0.2, -1.2], mid: [0, 1.0, -2] },
    shots: [
      shot("together", 0, at(0.3), two, { end: pushIn(two, 0.12) }),
      shot("his-face", at(0.3), at(0.5), cuA, { end: pushIn(cuA, 0.06), transition: { type: "cut" } }),
      shot("her-face", at(0.5), at(0.7), cuB, { end: pushIn(cuB, 0.06), transition: { type: "cut" } }),
      shot("light-returns", at(0.7), F, two, { end: pullBack(two, 0.15), transition: { type: "cut" } }),
    ],
    lighting: [{ frame: 0, preset: LOW }, { frame: at(0.5), preset: "indoorWarm", blend: S(5) }, { frame: at(0.8), preset: "sunset", blend: S(4) }],
    endFade: S(1.5),
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder narration: few words, long pauses.",
      narration: narrate([[1.0, "Some days are only about staying."], [O.seconds * 0.6, "And someone staying with you."]]),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -34 }, { type: "pad", from: O.seconds * 0.3, to: O.seconds, gain_db: -24 }],
      cues: [{ t: O.seconds * 0.55, type: "chime", gain_db: -19 }],
    },
    placeholders: ["narration text", "the reason for the sadness (add a prop or a flashback)", "the characters' looks"],
  };
};
