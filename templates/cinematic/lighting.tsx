import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ease, lerp } from "./animation/math";

/* ------------------------------------------------------------------------------------------------
 * Lighting presets. A preset is plain data: sky and fog colours, a key light (sun, moon or lamp), a rim light from behind,
 * a fill light from the camera side, a soft ambient light, and the exposure.
 * `lightingAt(keys, frame)` blends from preset to preset over time. It is a pure function of the frame.
 * `<LightRig>` applies the result to the scene. The key light casts the shadows and follows the subject.
 *
 * The "sunset" and "night" presets are the two ends of the P1.1 forest look (the old dawn 0 and dawn 1), so the forest keeps its approved colours.
 * ---------------------------------------------------------------------------------------------- */

export type Lighting = {
  sky: string; fog: string; fogNear: number; fogFar: number;
  ambientSky: string; ambientGround: string; ambient: number;
  /** Key light colour, strength and where it comes from, as an offset from the subject (metres). */
  key: string; keyIntensity: number; keyFrom: [number, number, number];
  rim: string; rimIntensity: number;
  fill: string; fillIntensity: number;
  exposure: number;
  /** 0..1: strength of the light shafts in the forest (and dust). */
  shafts: number;
  /** Multiplier for lights that belong to props (the lantern). */
  practical: number;
};

export const LIGHTING = {
  /** Soft midday light under trees: bright sky, pale fog, high sun, weak rim. */
  daylight: { sky: "#a9cfe8", fog: "#c4d9e4", fogNear: 8, fogFar: 48, ambientSky: "#bcd8f0", ambientGround: "#4a5a38", ambient: 0.75, key: "#fff0d2", keyIntensity: 2.8, keyFrom: [-3, 8, -4], rim: "#b8d4ff", rimIntensity: 0.35, fill: "#ffffff", fillIntensity: 0.45, exposure: 0.92, shafts: 0.5, practical: 0.4 },
  /** Blue moonlit night: low light, cool colours, the lantern is the warm accent. */
  night: { sky: "#22364a", fog: "#2b4256", fogNear: 4, fogFar: 30, ambientSky: "#a9c6e8", ambientGround: "#3b4a30", ambient: 0.35, key: "#8fb0d4", keyIntensity: 1.2, keyFrom: [-5, 4.2, -9], rim: "#9cc0ff", rimIntensity: 0.5, fill: "#ffd9b4", fillIntensity: 0.5, exposure: 0.95, shafts: 0, practical: 1.0 },
  /** Low golden sun behind the subject: the approved P1.1 forest look. */
  sunset: { sky: "#f0b98a", fog: "#e2b48e", fogNear: 4, fogFar: 30, ambientSky: "#a9c6e8", ambientGround: "#3b4a30", ambient: 0.5, key: "#ffbd82", keyIntensity: 3.4, keyFrom: [-5, 4.2, -9], rim: "#9cc0ff", rimIntensity: 1.0, fill: "#ffd9b4", fillIntensity: 1.0, exposure: 0.95, shafts: 1, practical: 0.7 },
  /** Lamp-lit room or tent: dark surroundings, warm low key, orange bounce. */
  indoorWarm: { sky: "#1a110b", fog: "#2a1a10", fogNear: 3, fogFar: 16, ambientSky: "#6a4426", ambientGround: "#20140c", ambient: 0.28, key: "#ffb468", keyIntensity: 1.9, keyFrom: [1.8, 1.8, 2.2], rim: "#ff9a50", rimIntensity: 0.5, fill: "#ffc890", fillIntensity: 0.6, exposure: 1.0, shafts: 0, practical: 1.2 },
  /** Hard side light, deep shadows, almost no fill: danger, suspense. */
  dramaticLowKey: { sky: "#0b0e14", fog: "#10151c", fogNear: 3, fogFar: 22, ambientSky: "#506080", ambientGround: "#10141a", ambient: 0.09, key: "#d4e2ff", keyIntensity: 3.4, keyFrom: [-4.5, 2.4, -2.5], rim: "#9cc0ff", rimIntensity: 1.5, fill: "#ffd9b4", fillIntensity: 0.05, exposure: 0.92, shafts: 0.2, practical: 1.3 },
  /** Violet and cyan glow: a mysterious or magical moment. */
  magical: { sky: "#1a1f3a", fog: "#2a2850", fogNear: 3, fogFar: 26, ambientSky: "#8fa0ff", ambientGround: "#2a2a50", ambient: 0.3, key: "#7a8cff", keyIntensity: 1.5, keyFrom: [-4, 4, -7], rim: "#6af0ff", rimIntensity: 1.3, fill: "#c9a0ff", fillIntensity: 0.5, exposure: 1.0, shafts: 0.35, practical: 1.0 },
} satisfies Record<string, Lighting>;
export type LightingName = keyof typeof LIGHTING;

export type LightingKey = { frame: number; preset: LightingName | Lighting; /** Frames to blend from the previous look. 0 = cut. */ blend?: number };

const mixColor = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
export const mixLighting = (a: Lighting, b: Lighting, t: number): Lighting => ({
  sky: mixColor(a.sky, b.sky, t), fog: mixColor(a.fog, b.fog, t), fogNear: lerp(a.fogNear, b.fogNear, t), fogFar: lerp(a.fogFar, b.fogFar, t),
  ambientSky: mixColor(a.ambientSky, b.ambientSky, t), ambientGround: mixColor(a.ambientGround, b.ambientGround, t), ambient: lerp(a.ambient, b.ambient, t),
  key: mixColor(a.key, b.key, t), keyIntensity: lerp(a.keyIntensity, b.keyIntensity, t),
  keyFrom: [lerp(a.keyFrom[0], b.keyFrom[0], t), lerp(a.keyFrom[1], b.keyFrom[1], t), lerp(a.keyFrom[2], b.keyFrom[2], t)],
  rim: mixColor(a.rim, b.rim, t), rimIntensity: lerp(a.rimIntensity, b.rimIntensity, t),
  fill: mixColor(a.fill, b.fill, t), fillIntensity: lerp(a.fillIntensity, b.fillIntensity, t),
  exposure: lerp(a.exposure, b.exposure, t), shafts: lerp(a.shafts, b.shafts, t), practical: lerp(a.practical, b.practical, t),
});

const resolve = (p: LightingName | Lighting): Lighting => (typeof p === "string" ? LIGHTING[p] : p);

/** The lighting at a frame: the first key is the starting look; each later key blends in over its `blend` frames. */
export const lightingAt = (keys: LightingKey[], frame: number): Lighting => {
  let cur = resolve(keys[0].preset);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame < k.frame) break;
    cur = mixLighting(cur, resolve(k.preset), k.blend ? ease((frame - k.frame) / k.blend) : 1);
  }
  return cur;
};

/** Applies a Lighting to the scene. Keep the sun's shadow camera on the subject. All objects are created once. */
export const LightRig: React.FC<{ look: Lighting; subject: [number, number, number]; shadowSize?: number }> = ({ look, subject, shadowSize = 2048 }) => {
  const scene = useThree((s) => s.scene), gl = useThree((s) => s.gl);
  const o = useMemo(() => {
    const key = new THREE.DirectionalLight("#ffffff", 1);
    key.castShadow = true; key.shadow.mapSize.set(shadowSize, shadowSize); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 40 });
    return { key, rim: new THREE.DirectionalLight("#ffffff", 1), fill: new THREE.DirectionalLight("#ffffff", 1), hemi: new THREE.HemisphereLight("#ffffff", "#444444", 1), bg: new THREE.Color(), fog: new THREE.Fog("#000000", 4, 30) };
  }, [shadowSize]);
  useLayoutEffect(() => {
    o.bg.set(look.sky); scene.background = o.bg;
    o.fog.color.set(look.fog); o.fog.near = look.fogNear; o.fog.far = look.fogFar; scene.fog = o.fog;
    o.hemi.color.set(look.ambientSky); o.hemi.groundColor.set(look.ambientGround); o.hemi.intensity = look.ambient;
    o.key.color.set(look.key); o.key.intensity = look.keyIntensity;
    o.key.position.set(subject[0] + look.keyFrom[0], subject[1] + look.keyFrom[1], subject[2] + look.keyFrom[2]);
    o.key.target.position.set(subject[0], subject[1], subject[2]); o.key.target.updateMatrixWorld();
    o.rim.color.set(look.rim); o.rim.intensity = look.rimIntensity; o.rim.position.set(subject[0] + 5, subject[1] + 3, subject[2] - 8);
    o.fill.color.set(look.fill); o.fill.intensity = look.fillIntensity; o.fill.position.set(subject[0] + 2.5, subject[1] + 2.2, subject[2] + 9);
    gl.toneMappingExposure = look.exposure;
  }, [scene, gl, o, look, subject[0], subject[1], subject[2]]);
  return <>
    <primitive object={o.key} dispose={null} /><primitive object={o.key.target} dispose={null} />
    <primitive object={o.rim} dispose={null} /><primitive object={o.fill} dispose={null} /><primitive object={o.hemi} dispose={null} />
  </>;
};
