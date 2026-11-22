import { presets, pushIn, pullBack, orbit, shot } from "../camera/presets";
import type { Shot } from "../camera/shots";
import type { LightingKey, LightingName } from "../lighting";
import type { CharacterScript, TargetTable } from "../animation/script";

/* ------------------------------------------------------------------------------------------------
 * A StorySpec is a whole short as plain data: size, time, cast (with scripts), place, camera, light, props, sound.
 * It has no React and no browser code, so tools can read it in Node (`check-shots.mjs`, `produce.mjs`).
 * `StoryFromSpec.tsx` turns a StorySpec into the real scene. The animation, camera and lighting code is NOT copied into templates:
 * a template only chooses values.
 * ---------------------------------------------------------------------------------------------- */

export type CastLook =
  | { kit: "peasant"; gender: "male" | "female"; hair: string; hairTint: string; beard?: boolean; height?: number; /** Hold a pocket watch in the right hand. */ watch?: boolean }
  | { kit: "traveller" }   // bearded ranger with a lantern and a backpack
  | { kit: "companion" };  // female ranger, bun hair

export type Cast = { id: string; look: CastLook; script: CharacterScript; /** Frames in which the actor is drawn. Default: always. */ appear?: [number, number]; /** Frames where the actor must be in the picture (for check-shots). Default: always. */ visible?: [number, number][] };

export type PropSpec = { kind: "crystal"; at: [number, number, number]; flashFrame?: number };

export type AudioSpec = {
  duration: number; voice?: string; note?: string;
  narration: { id: string; start: number; text: string }[];
  beds: { type: string; from: number; to: number; gain_db: number; [k: string]: unknown }[];
  cues: { t: number; type: string; gain_db: number; dur?: number; note?: string }[];
};

export type StorySpec = {
  id: string; title: string; genre: string;
  fps: number; width: number; height: number; frames: number;
  environment: "forest" | "workshop" | "studio";
  cast: Cast[];
  props?: PropSpec[];
  /** Named points (besides the actors) that scripts and cameras can use. Positions in metres. */
  points?: Record<string, [number, number, number]>;
  shots: Shot[];
  lighting: LightingKey[];
  endFade?: number;
  audio: AudioSpec;
  /** What the author should replace before a real production. */
  placeholders: string[];
};

export type Options = { seconds: number; fps: number; width: number; height: number };
export const DEFAULTS: Options = { seconds: 30, fps: 30, width: 1080, height: 1920 };

/** Turn seconds into frames for these options. */
export const secs = (o: Options) => (s: number) => Math.round(s * o.fps);

/** Fixed points as a target table. */
export const pointTargets = (points: StorySpec["points"] = {}): TargetTable => Object.fromEntries(Object.entries(points).map(([k, v]) => [k, () => v]));

/** Shared helper: the narration timeline (placeholder lines) spread over the story. Each entry: [start second, text]. */
export const narrate = (lines: [number, string][]): AudioSpec["narration"] => lines.map(([start, text], i) => ({ id: `n${i + 1}`, start, text }));

export { presets, pushIn, pullBack, orbit, shot };
export type { Shot, LightingKey, LightingName, CharacterScript };

/** The data that `check-shots.mjs` reads. */
export const toCheckData = (s: StorySpec) => ({
  fps: s.fps, frames: s.frames, width: s.width, height: s.height, shots: s.shots,
  targets: () => pointTargets(s.points),
  actors: s.cast.map((c) => ({ id: c.id, script: c.script, height: c.look.kit === "peasant" ? (c.look.height ?? (c.look.gender === "male" ? 1.75 : 1.68)) : c.look.kit === "traveller" ? 1.75 : 1.68, visible: c.visible, clips: { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" }, feet: ["foot_l", "foot_r"] as [string, string] })),
});
