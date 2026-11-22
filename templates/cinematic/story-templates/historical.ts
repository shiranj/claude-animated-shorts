import { DEFAULTS, narrate, presets, pushIn, pullBack, orbit, shot, secs, type CharacterScript, type Options, type StorySpec } from "./spec";

/** Historical story: a lone traveller crosses a landscape at dusk and stops at a landmark. Forest set, sunset to night. */
export const historical = (opts: Partial<Options> = {}): StorySpec => {
  const O = { ...DEFAULTS, ...opts }, S = secs(O), F = S(O.seconds), at = (p: number) => Math.round(p * F);
  const traveller: CharacterScript = {
    start: { x: 0, z: -9, yaw: 0 },
    actions: [
      { type: "walk", from: at(0.08), to: at(0.5), blend: 30 },
      { type: "turn", from: at(0.15), to: at(0.5), yaw: -15 },
      { type: "idle", from: at(0.5), to: F, blend: 40 },
      { type: "carry", hand: "left", from: 0, to: F, blend: 20 },
      { type: "look", from: at(0.55), to: at(0.85), at: { target: "landmark" } },
      { type: "emotion", emotion: "sad", from: at(0.6), to: at(0.85), intensity: 0.5 },
    ],
  };
  const wide = presets.establishingWide([0.4, 0, -6], { fit: 7.5, screen: { x: -0.2, y: -0.1 } });
  const track = presets.medium("traveller", { follow: "live", fit: 1.9, azimuth: 24, height: 1.1 });
  const cu = presets.closeUp("traveller", { follow: "live", azimuth: -30 });
  const fin = presets.establishingWide("traveller", { follow: "live", fit: 4.5, azimuth: 25, elevation: 3, screen: { x: 0, y: -0.15 }, height: 0.2 });
  return {
    id: "T-Historical", title: "Historical story", genre: "Historical", ...O, frames: F, environment: "forest",
    cast: [{ id: "traveller", look: { kit: "traveller" }, script: traveller }],
    points: { landmark: [-2.5, 1.4, -2.5] },
    shots: [
      shot("place-and-year", 0, at(0.25), wide, { end: pushIn(wide, 0.3), motion: "late" }),
      shot("the-journey", at(0.25), at(0.55), track, { transition: { type: "blend", frames: S(1.8) } }),
      shot("the-moment", at(0.55), at(0.8), cu, { end: pushIn(cu, 0.06), transition: { type: "cut" } }),
      shot("what-remains", at(0.8), F, fin, { end: orbit(pullBack(fin, 0.2), -10), transition: { type: "fade", frames: S(0.8) } }),
    ],
    lighting: [{ frame: 0, preset: "sunset" }, { frame: at(0.6), preset: "night", blend: S(5) }],
    endFade: S(1.2),
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder narration: write the real, sourced script.",
      narration: narrate([[0.6, "In the year [YEAR], a man crossed [PLACE] on foot."], [O.seconds * 0.3, "He carried [WHAT HE CARRIED], and a promise."], [O.seconds * 0.58, "What he found there changed [WHAT CHANGED]."], [O.seconds * 0.84, "[SOURCE: where this story comes from.]"]]),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -32 }, { type: "pad", from: 0, to: O.seconds, gain_db: -26 }],
      cues: [{ t: O.seconds * 0.08, type: "footsteps", dur: O.seconds * 0.4, gain_db: -22 }, { t: O.seconds * 0.55, type: "chime", gain_db: -20 }],
    },
    placeholders: ["YEAR, PLACE and facts in the narration (sourced)", "landmark position and what it is (add a prop)", "costume: this uses the ranger outfit"],
  };
};
