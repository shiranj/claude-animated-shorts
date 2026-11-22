import { DEFAULTS, narrate, presets, pushIn, pullBack, orbit, shot, secs, type CharacterScript, type Options, type StorySpec } from "./spec";

/** Product or concept explainer: a presenter and one glowing object that stands for the product or idea. The camera moves around the object while
 *  the presenter points at it. Studio set, light changes with each point. Replace the crystal with your own prop. */
export const explainer = (opts: Partial<Options> = {}): StorySpec => {
  const O = { ...DEFAULTS, ...opts }, S = secs(O), F = S(O.seconds), at = (p: number) => Math.round(p * F);
  const presenter: CharacterScript = {
    start: { x: -1.0, z: -2.2, yaw: 12 },
    actions: [
      { type: "look", from: 0, to: at(0.15), at: { target: "lens" } },
      { type: "look", from: at(0.15), to: at(0.9), at: { target: "object" } },
      { type: "emotion", emotion: "happy", from: at(0.05), to: F, intensity: 0.5 },
      { type: "point", from: at(0.18), to: at(0.32), hand: "right", at: "object" },
      { type: "emotion", emotion: "surprise", from: at(0.4), to: at(0.48), intensity: 0.5 },
      { type: "point", from: at(0.6), to: at(0.75), hand: "right", at: "object" },
      { type: "look", from: at(0.9), to: F, at: { target: "lens" } },
    ],
  };
  const wide = presets.establishingWide("scene", { fit: 4.6, elevation: 4, height: 0.8, screen: { x: 0, y: -0.04 } });
  const obj = presets.closeUp("object", { fit: 1.1, azimuth: 20, elevation: 4, relative: false, height: 0, screen: { x: 0, y: 0 } });
  const med = presets.medium("presenter", { follow: "live", fit: 1.9, azimuth: -14 });
  return {
    id: "T-Explainer", title: "Concept explainer", genre: "Product / concept explainer", ...O, frames: F, environment: "studio",
    cast: [{ id: "presenter", look: { kit: "peasant", gender: "female", hair: "Hair_Long", hairTint: "#2c1b12" }, script: presenter }],
    props: [{ kind: "crystal", at: [0.9, 1.15, -2.0] }],
    points: { lens: [0, 1.6, 8], object: [0.9, 1.15, -2.0], scene: [0, 0, -2.2] },
    shots: [
      shot("intro", 0, at(0.15), wide, { end: pushIn(wide, 0.1) }),
      shot("the-thing", at(0.15), at(0.38), obj, { end: orbit(pushIn(obj, 0.15), 40), transition: { type: "cut" } }),
      shot("why-it-matters", at(0.38), at(0.6), med, { end: pushIn(med, 0.06), transition: { type: "cut" } }),
      shot("the-detail", at(0.6), at(0.85), obj, { end: orbit(pushIn(obj, 0.25), -50), transition: { type: "cut" } }),
      shot("call-to-action", at(0.85), F, wide, { end: pullBack(wide, 0.1), transition: { type: "blend", frames: S(1) } }),
    ],
    lighting: [{ frame: 0, preset: "daylight" }, { frame: at(0.15), preset: "magical", blend: S(1.5) }, { frame: at(0.85), preset: "daylight", blend: S(2) }],
    endFade: S(1),
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder narration: replace with your script.",
      narration: narrate([[0.4, "Meet [PRODUCT OR IDEA]."], [O.seconds * 0.17, "It does one thing really well: [WHAT IT DOES]."], [O.seconds * 0.4, "That matters because [WHY]."], [O.seconds * 0.62, "And here is the detail people miss: [DETAIL]."], [O.seconds * 0.87, "Try it today."]]),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -34 }, { type: "pad", from: 0, to: O.seconds, gain_db: -26 }],
      cues: [{ t: O.seconds * 0.15, type: "glow", dur: 2, gain_db: -18 }, { t: O.seconds * 0.38, type: "chime", gain_db: -20 }],
    },
    placeholders: ["PRODUCT OR IDEA, WHAT IT DOES, WHY and DETAIL in the narration", "the object: replace the crystal with your own prop (CrystalProp.tsx is the example)", "presenter look"],
  };
};
