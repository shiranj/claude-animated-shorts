import { DEFAULTS, narrate, presets, pushIn, pullBack, shot, secs, type CharacterScript, type Options, type StorySpec } from "./spec";

/** Short informative video: one presenter in an empty studio explains two points. Shots: wide, medium, close-up, medium with gestures, wide. */
export const informative = (opts: Partial<Options> = {}): StorySpec => {
  const O = { ...DEFAULTS, ...opts }, S = secs(O), F = S(O.seconds), at = (p: number) => Math.round(p * F);
  const presenter: CharacterScript = {
    start: { x: 0, z: -2, yaw: 0 },
    actions: [
      { type: "look", from: 0, to: F, at: { target: "lens" } },                       // talks to the viewer
      { type: "emotion", emotion: "happy", from: at(0.05), to: F, intensity: 0.45 },
      { type: "wave", from: at(0.02), to: at(0.1), hand: "right" },
      { type: "point", from: at(0.3), to: at(0.4), hand: "left", at: "pointA" },
      { type: "emotion", emotion: "surprise", from: at(0.45), to: at(0.5), intensity: 0.4 },
      { type: "point", from: at(0.58), to: at(0.68), hand: "right", at: "pointB" },
    ],
  };
  const wide = presets.establishingWide([0, 0, -2], { fit: 4.8, elevation: 3, height: 0.9, screen: { x: 0, y: -0.05 } });
  const med = presets.medium("presenter", { follow: "live", fit: 1.9, azimuth: 8, screen: { x: 0.04, y: 0.03 } });
  const cu = presets.closeUp("presenter", { follow: "live", azimuth: -10 });
  return {
    id: "T-Informative", title: "Informative short", genre: "Educational / informative", ...O, frames: F, environment: "studio",
    cast: [{ id: "presenter", look: { kit: "peasant", gender: "male", hair: "Hair_SimpleParted", hairTint: "#4a3322" }, script: presenter }],
    points: { lens: [0, 1.6, 8], pointA: [-1.4, 1.6, -2], pointB: [1.4, 1.6, -2] },
    shots: [
      shot("hook-wide", 0, at(0.12), wide, { end: pushIn(wide, 0.12) }),
      shot("point-1", at(0.12), at(0.4), med, { end: pushIn(med, 0.06), transition: { type: "cut" } }),
      shot("emphasis", at(0.4), at(0.55), cu, { end: pushIn(cu, 0.05), transition: { type: "cut" } }),
      shot("point-2", at(0.55), at(0.8), med, { transition: { type: "cut" } }),
      shot("wrap-up", at(0.8), F, wide, { end: pullBack(wide, 0.1), transition: { type: "blend", frames: S(1) } }),
    ],
    lighting: [{ frame: 0, preset: "daylight" }],
    endFade: S(1),
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder narration: replace the text, then run produce.mjs audio.",
      narration: narrate([[0.5, "Here is something most people get wrong."], [O.seconds * 0.14, "First point: say it simply."], [O.seconds * 0.42, "Second point: show it, do not only say it."], [O.seconds * 0.7, "Remember these two things, and you are done."]]),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -34 }, { type: "pad", from: 0, to: O.seconds, gain_db: -28 }],
      cues: [{ t: 0.1, type: "whoosh", gain_db: -22 }, { t: O.seconds * 0.4, type: "chime", gain_db: -20 }],
    },
    placeholders: ["narration text and voice", "pointA / pointB: where the presenter points (put your graphics or objects there)", "hair, outfit and colours"],
  };
};
