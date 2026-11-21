/** Small math helpers shared by the animation system. Everything here is a pure function. */
export const DEG = Math.PI / 180;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Wrap an angle to (-PI, PI]. */
export const wrapPi = (a: number) => { const t = (a + Math.PI) % (2 * Math.PI); return (t <= 0 ? t + 2 * Math.PI : t) - Math.PI; };
/** Small seeded random numbers: the same seed always gives the same sequence. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
