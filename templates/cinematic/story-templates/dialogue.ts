import { DEFAULTS, presets, pushIn, shot, secs, type CharacterScript, type Options, type Shot, type StorySpec } from "./spec";
import type { Action } from "../animation/script";

/** One spoken line. `who` is the id of a cast member. */
export type Line = { who: "ana" | "ben" | "cy"; text: string; seconds: number };

export const DEFAULT_LINES: Line[] = [
  { who: "ana", text: "Did you hear that?", seconds: 2.2 },
  { who: "ben", text: "Hear what? I heard nothing.", seconds: 3.0 },
  { who: "cy", text: "I did. It came from the cellar.", seconds: 3.6 },
  { who: "ana", text: "Then someone has to go down.", seconds: 3.2 },
  { who: "ben", text: "Not me.", seconds: 1.6 },
  { who: "cy", text: "Fine. Hold the lantern.", seconds: 2.6 },
];

const POS = { ana: { x: -1.1, z: -2.0 }, ben: { x: 0.0, z: -2.6 }, cy: { x: 1.1, z: -2.0 } } as const;

/** Multi-character dialogue: three people in a studio. The script of each person is made from the list of lines: the speaker talks (a nod of emotion, a gesture),
 *  the others look at the speaker. The camera cuts to the speaker on every line (medium shot), after an opening wide. Change `lines` to change the scene. */
export const dialogue = (opts: Partial<Options> & { lines?: Line[] } = {}): StorySpec => {
  const { lines = DEFAULT_LINES, ...rest } = opts, gap = 0.5;
  const total = Math.max(rest.seconds ?? 0, lines.reduce((t, l) => t + l.seconds + gap, 1.5) + 1.5);
  const O = { ...DEFAULTS, ...rest, seconds: total }, S = secs(O), F = S(O.seconds);
  const ids = ["ana", "ben", "cy"] as const;
  let t = 1.5; const times = lines.map((l) => { const a = t; t += l.seconds + gap; return [a, a + l.seconds] as const; });
  const scripts: Record<string, Action[]> = { ana: [], ben: [], cy: [] };
  lines.forEach((l, i) => {
    const [a, b] = times[i];
    for (const id of ids) {
      if (id === l.who) {
        scripts[id].push({ type: "emotion", emotion: i % 2 ? "surprise" : "happy", from: S(a), to: S(b), intensity: 0.35 });
        if (i % 3 === 2) scripts[id].push({ type: "point", from: S(a + 0.4), to: S(a + 1.4), hand: id === "ana" ? "left" : "right", at: "centre" });
      } else scripts[id].push({ type: "look", from: S(a - 0.2), to: S(b + 0.2), at: { target: `${l.who}.head` } });
    }
  });
  const cast = ids.map((id) => ({ id, look: id === "ana" ? { kit: "peasant" as const, gender: "female" as const, hair: "Hair_Long", hairTint: "#2c1b12" } : id === "ben" ? { kit: "peasant" as const, gender: "male" as const, hair: "Hair_SimpleParted", hairTint: "#4a3322" } : { kit: "companion" as const }, script: { start: { ...POS[id], yaw: 0 }, actions: scripts[id] } as CharacterScript }));
  const wide = presets.establishingWide([0, 0, -2.2], { fit: 5.0, elevation: 3, height: 1.0, screen: { x: 0, y: -0.04 } });
  const shots: Shot[] = [shot("establishing", 0, S(1.5), wide, { end: pushIn(wide, 0.08) })];
  lines.forEach((l, i) => {
    const from = S(i === 0 ? 1.5 : times[i][0] - gap / 2), to = i === lines.length - 1 ? F : S(times[i + 1][0] - gap / 2);
    const m = presets.medium(l.who, { follow: "live", fit: 1.9, azimuth: l.who === "ana" ? 14 : l.who === "cy" ? -14 : 0, screen: { x: 0.04, y: 0.03 } });
    shots.push(shot(`line-${i + 1}-${l.who}`, from, to, m, { end: pushIn(m, 0.05), transition: { type: "cut" } }));
  });
  return {
    id: "T-Dialogue", title: "Multi-character dialogue", genre: "Dialogue / funny / drama", ...O, frames: F, environment: "studio",
    cast, points: { centre: [0, 1.0, -2.2] }, shots, endFade: S(1),
    lighting: [{ frame: 0, preset: "indoorWarm" }],
    audio: {
      duration: O.seconds, voice: "Microsoft David Desktop", note: "Placeholder voices: one free Windows voice for all lines. Record each line separately and keep the file names.",
      narration: lines.map((l, i) => ({ id: `n${i + 1}`, start: times[i][0], text: l.text })),
      beds: [{ type: "roomtone", from: 0, to: O.seconds, gain_db: -32 }, { type: "pad", from: 0, to: O.seconds, gain_db: -30 }],
      cues: [{ t: 0.2, type: "whoosh", gain_db: -22 }],
    },
    placeholders: ["the lines (and which person says them)", "who the three people are (looks, outfits, names)", "the place (studio is empty): choose the workshop or forest set, or add props"],
  };
};
