import type { Focus, Framing, Shot, Transition } from "./shots";

/* ------------------------------------------------------------------------------------------------
 * Camera presets for 9:16 video. Each returns a Framing; a story combines them with `shot()`.
 * `fit` is the height of world (metres) that fits in the frame at the subject, so the size of the shot does not depend on the lens.
 * Subjects are about 1.75 m tall. The `focus.height` defaults put the focus on the usual place for that shot size.
 * ---------------------------------------------------------------------------------------------- */

type Opt = Partial<Omit<Framing, "focus">> & { height?: number; follow?: Focus["follow"]; offset?: Focus["offset"] };
const make = (target: Focus["target"], base: Omit<Framing, "focus">, defaultHeight: number, o: Opt): Framing => {
  const { height, follow, offset, ...rest } = o;
  return { ...base, ...rest, focus: { target, height: height ?? defaultHeight, follow, offset } };
};

export const presets = {
  /** Establishing wide: the whole place, subject small. High lens, slightly above eye level, subject low and to one side. */
  establishingWide: (target: Focus["target"], o: Opt = {}): Framing => make(target, { fit: 6.5, azimuth: 0, elevation: 7, fov: 38, relative: false, screen: { x: 0.2, y: -0.12 } }, 1.0, o),
  /** Full body, a little below eye level (looks heroic, keeps feet in frame). */
  fullBody: (target: Focus["target"], o: Opt = {}): Framing => make(target, { fit: 2.6, azimuth: 12, elevation: 3, fov: 34, relative: false, screen: { x: 0.1, y: 0 } }, 0.95, o),
  /** Medium shot, waist up. Good for acting. */
  medium: (target: Focus["target"], o: Opt = {}): Framing => make(target, { fit: 1.5, azimuth: 20, elevation: 2, fov: 32, relative: true, screen: { x: 0.12, y: 0.05 } }, 1.25, o),
  /** Close-up, head and shoulders. Use for a reaction; keep it short. */
  closeUp: (target: Focus["target"], o: Opt = {}): Framing => make(target, { fit: 0.85, azimuth: 18, elevation: 1, fov: 28, relative: true, screen: { x: 0.1, y: 0.04 } }, 1.55, o),
  /** Over the shoulder: camera behind and a little to one side of `subject`, looking at `lookAt` (the thing the subject looks at). */
  overShoulder: (lookAt: Focus["target"], subject: string, o: Opt & { distance?: number; side?: number; camHeight?: number } = {}): Framing => {
    const { distance = 1.5, side = 0.35, camHeight = 1.6, ...rest } = o;
    return make(lookAt, { fit: 1.7, azimuth: 0, elevation: 0, fov: 36, relative: false, screen: { x: -0.2, y: 0 }, behind: { target: subject, distance, side, height: camHeight } }, 0.9, rest);
  },
  /** Low-angle hero shot. */
  lowAngle: (target: Focus["target"], o: Opt = {}): Framing => make(target, { fit: 2.4, azimuth: 0, elevation: -6, fov: 34, relative: true, screen: { x: 0, y: 0.05 } }, 1.0, o),
};

/** Same framing, closer by `amount` (0.2 = 20 % closer). Use as the `end` of a shot for a slow push-in. */
export const pushIn = (f: Framing, amount = 0.2): Framing => ({ ...f, fit: f.fit * (1 - amount) });
/** Same framing, farther by `amount`. Use as the `end` of a shot for a pull-back. */
export const pullBack = (f: Framing, amount = 0.3): Framing => ({ ...f, fit: f.fit * (1 + amount) });
/** Same framing, moved around the subject by `degrees`. */
export const orbit = (f: Framing, degrees: number): Framing => ({ ...f, azimuth: f.azimuth + degrees });
/** Tilt: same framing with the focus moved up or down by `metres`. */
export const tilt = (f: Framing, metres: number): Framing => ({ ...f, focus: { ...f.focus, height: (f.focus.height ?? 0) + metres } });
/** Make the camera follow its target every frame (a tracking shot). */
export const tracking = (f: Framing): Framing => ({ ...f, focus: { ...f.focus, follow: "live" } });

/** Build a shot. Shots in a story must be in time order. */
export const shot = (name: string, from: number, to: number, start: Framing, o: { end?: Framing; motion?: Shot["motion"]; transition?: Transition } = {}): Shot => ({ name, from, to, start, ...o });
