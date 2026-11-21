import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ASSET_PATHS, loadHdr, loadTexture, useAsset } from "./useAsset";

/* ------------------------------------------------------------------------------------------------
 * Reusable forest-trail environment: stylized trees, rocks, grass, a path on a CC0 ground texture,
 * light shafts, dust motes and image-based lighting. Everything is generated from fixed seeds, so every
 * frame (and every separate render of a frame) builds exactly the same scene.
 * ---------------------------------------------------------------------------------------------- */

export const ENV_INTENSITY = 0.35; // strength of the HDRI on standard materials (three r160 has no scene-wide control)

export const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ---------- geometry builders (module level, built once) ---------- */

/** Smooth pseudo-noise in [-1, 1], a pure function of position. */
const noise3 = (x: number, y: number, z: number) =>
  0.5 * Math.sin(x * 1.7 + y * 2.3 + 1.3) * Math.cos(z * 1.9 - x * 0.7) + 0.3 * Math.sin(x * 3.9 - z * 3.1 + y) + 0.2 * Math.cos(y * 5.3 + z * 4.1 - x * 2.2);

/** Weld duplicated vertices so that displacement keeps the surface closed and normals come out smooth. */
const weld = (g: THREE.BufferGeometry) => {
  g.deleteAttribute("uv"); g.deleteAttribute("normal");
  return mergeVertices(g, 1e-4);
};

const paint = (g: THREE.BufferGeometry, fn: (x: number, y: number, z: number, out: THREE.Color) => void) => {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), c); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
};

/** A canopy is a cloud of soft clumps. Colour is lit from above across the whole canopy, with a slight hue shift per clump. */
const canopyVariant = (seed: number, clumps: number, spread: [number, number, number], base: THREE.Color, top: THREE.Color, deep: THREE.Color) => {
  const r = mulberry32(seed), parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < clumps; i++) {
    const radius = 0.5 + r() * 0.45;
    const g = weld(new THREE.IcosahedronGeometry(1, 2));
    const p = g.attributes.position as THREE.BufferAttribute;
    const k = seed * 1.7 + i * 5.3;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      const d = 1 + 0.2 * noise3(x * 1.6 + k, y * 1.6, z * 1.6) + 0.07 * noise3(x * 4 + k, y * 4, z * 4);
      p.setXYZ(v, x * d * radius, y * d * radius * 0.85, z * d * radius);
    }
    const a = r() * Math.PI * 2, e = Math.pow(r(), 0.7);
    g.translate(Math.cos(a) * e * spread[0], (r() - 0.35) * spread[1], Math.sin(a) * e * spread[2]);
    const tint = (r() - 0.5) * 0.06;
    paint(g, (x, y, z, c) => {
      const t = THREE.MathUtils.clamp((y / spread[1] + 0.6) * 0.8, 0, 1);
      c.copy(deep).lerp(base, Math.min(t * 1.6, 1)).lerp(top, Math.max(t - 0.45, 0) * 1.7);
      c.offsetHSL(tint, 0, noise3(x * 5, y * 5, z * 5) * 0.025);
    });
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
};

const pineVariant = (seed: number, tiers: number) => {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), radius = 1.25 * (1 - t * 0.78), height = 0.95 - t * 0.3, y = 0.4 + t * 2.6;
    const g = weld(new THREE.ConeGeometry(radius, height, 18, 3, true));
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), py = p.getY(v), z = p.getZ(v);
      const edge = THREE.MathUtils.clamp((height / 2 - py) / height, 0, 1); // 0 at the tip, 1 at the rim
      const d = 1 + edge * (0.22 * noise3(x * 2 + seed, i, z * 2) + 0.1 * Math.sin(Math.atan2(z, x) * 7 + i + seed));
      p.setXYZ(v, x * d, py - edge * edge * 0.18, z * d); // rims droop a little
    }
    g.translate(0, y, 0);
    paint(g, (x, py, z, c) => { const k = THREE.MathUtils.clamp((py - y) / height + 0.5, 0, 1); c.set("#17382f").lerp(new THREE.Color("#3f7a57"), k); c.offsetHSL(noise3(x * 3, py, z * 3) * 0.015, 0, 0); });
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
};

/** Bent trunk with a flared root and moss on one side. Unit height; scale it per tree. */
const trunkVariant = (seed: number) => {
  const g = weld(new THREE.CylinderGeometry(0.1, 0.19, 1, 9, 10));
  g.translate(0, 0.5, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < p.count; v++) {
    const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    const flare = 1 + 0.9 * Math.exp(-y * 13);
    p.setXYZ(v, x * flare + 0.07 * Math.sin(y * 2.6 + seed) * y * 2.2, y, z * flare + 0.05 * Math.cos(y * 2.1 + seed * 2) * y * 2.2);
  }
  paint(g, (x, y, z, c) => {
    c.set("#5a4333").lerp(new THREE.Color("#3a2c24"), 0.5 + 0.5 * noise3(x * 9 + seed, y * 3, z * 9));
    const moss = THREE.MathUtils.clamp(x * 7 + 0.4 - y * 1.1, 0, 1) * 0.6;
    c.lerp(new THREE.Color("#5f7d3d"), moss);
  });
  g.computeVertexNormals();
  return g;
};

const canopyGeo = [
  canopyVariant(1, 11, [1.25, 0.9, 1.25], new THREE.Color("#5e8f4c"), new THREE.Color("#c3d27a"), new THREE.Color("#23452f")),
  canopyVariant(2, 9, [1.0, 0.8, 1.0], new THREE.Color("#6a9a4f"), new THREE.Color("#d4d98a"), new THREE.Color("#294d32")),
  canopyVariant(3, 13, [1.5, 1.0, 1.4], new THREE.Color("#557f45"), new THREE.Color("#b5c874"), new THREE.Color("#1f3f2c")),
  canopyVariant(4, 8, [0.9, 0.7, 0.9], new THREE.Color("#78a24f"), new THREE.Color("#dde08e"), new THREE.Color("#2d5233")),
];
const pineGeo = [pineVariant(1, 6), pineVariant(2, 5)];
const trunkGeo = [trunkVariant(1), trunkVariant(2.7), trunkVariant(5.1)];

const rockGeo = [0, 1, 2].map((i) => {
  const g = weld(new THREE.IcosahedronGeometry(1, 2));
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < p.count; v++) {
    const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    const d = 1 + 0.22 * noise3(x * 1.4 + i * 3, y * 1.4, z * 1.4) + 0.07 * noise3(x * 4 + i, y * 4, z * 4);
    p.setXYZ(v, x * d, y * d * (y < 0 ? 0.6 : 1), z * d);
  }
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    c.set("#4c5558").lerp(new THREE.Color("#9aa598"), THREE.MathUtils.clamp(y * 0.5 + 0.5, 0, 1)).offsetHSL(0, 0, noise3(x * 6, y * 6, z * 6) * 0.04);
    const up = THREE.MathUtils.clamp(y * 1.4 - 0.15 + 0.25 * noise3(x * 3, 0, z * 3), 0, 1);
    c.lerp(new THREE.Color("#6d9a4b"), up * 0.75);
  });
  return g;
});

/** Single grass blade, slightly curved, base-dark to tip-light. */
const bladeGeo = (() => {
  const g = new THREE.ConeGeometry(0.03, 0.5, 3, 4);
  g.translate(0, 0.25, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < p.count; v++) { const y = p.getY(v); p.setZ(v, p.getZ(v) + y * y * 0.35); }
  paint(g, (x, y, z, c) => c.setRGB(0.3 + 0.7 * (y / 0.5), 0.5 + 0.5 * (y / 0.5), 0.28 + 0.2 * (y / 0.5)));
  g.computeVertexNormals();
  return g;
})();
const petalGeo = new THREE.SphereGeometry(0.018, 6, 5);
const logGeo = (() => {
  const g = weld(new THREE.CylinderGeometry(0.17, 0.2, 2.2, 10, 8));
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), z = p.getZ(v); const d = 1 + 0.07 * noise3(x * 8, y * 2, z * 8); p.setXYZ(v, x * d, y, z * d + 0.05 * Math.sin(y * 2)); }
  paint(g, (x, y, z, c) => { c.set("#5b4636").lerp(new THREE.Color("#33271f"), 0.5 + 0.5 * noise3(x * 9, y * 3, z * 9)); c.lerp(new THREE.Color("#6a8a45"), THREE.MathUtils.clamp(z * 6 + 0.3, 0, 1) * 0.55); });
  g.computeVertexNormals();
  return g;
})();

const std = (color: string, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: ENV_INTENSITY, ...extra });
const foliageMats = ["#ffffff", "#f0f4dd", "#e6ecc8"].map((c) => std(c, 0.78, { vertexColors: true }));
const pineMat = std("#ffffff", 0.82, { vertexColors: true });
const rockMat = std("#ffffff", 0.9, { vertexColors: true });
const barkMat = std("#ffffff", 0.95, { vertexColors: true });
const grassMat = std("#ffffff", 0.8, { vertexColors: true, side: THREE.DoubleSide });
const petalMat = std("#ffffff", 0.7);
const mushroomCap = std("#d9553a", 0.6);
const mushroomStem = std("#efe3cf", 0.7);

/* ---------- scene layout ---------- */

type TreeSpec = { x: number; z: number; s: number; kind: number; variant: number; rot: number; sx: number; tint: number };
type RockSpec = { x: number; z: number; sx: number; sy: number; sz: number; rot: number; geo: number };
type Instances = { matrices: THREE.Matrix4[]; colors: THREE.Color[] };
type LogSpec = { x: number; z: number; rot: number; s: number };

export type ForestLayout = {
  trees: TreeSpec[]; rocks: RockSpec[]; logs: LogSpec[]; mushrooms: { x: number; z: number; s: number }[];
  grass: Instances; flowers: Instances;
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const compose = (x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number) =>
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)).clone();

/**
 * Build the layout once. `isBlocked(x, z, radius)` lets the shot reject any object that would hide the subject from the camera.
 * The path runs along the z axis at x = 0.
 */
export const buildForestLayout = (isBlocked: (x: number, z: number, radius: number) => boolean): ForestLayout => {
  const rnd = mulberry32(7);
  const trees: TreeSpec[] = [];
  // jittered rows along the trail, so spacing is uneven but never clumped
  for (let z = -36; z < 8; z += 1.55) {
    for (const side of [-1, 1]) {
      const n = rnd() < 0.55 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const near = k === 0;
        const x = side * (near ? 2.4 + Math.pow(rnd(), 1.5) * 2.2 : 5 + rnd() * 9);
        const zz = z + (rnd() - 0.5) * 1.3;
        const s = near ? 0.85 + rnd() * 0.7 : 1.1 + rnd() * 1.0;
        if (isBlocked(x, zz, 0.5 * s + 0.35)) continue;
        const kind = Math.abs(x) > 6.5 && rnd() < 0.6 ? 1 : rnd() < 0.12 ? 2 : 0; // 0 broadleaf, 1 pine, 2 young tree
        trees.push({ x, z: zz, s, kind, variant: Math.floor(rnd() * 4), rot: rnd() * Math.PI * 2, sx: 0.85 + rnd() * 0.5, tint: Math.floor(rnd() * 3) });
      }
    }
  }
  const rocks: RockSpec[] = [];
  for (let i = 0; i < 40; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const small = i >= 18;
    const x = side * (1.2 + rnd() * (small ? 5 : 1.6));
    const z = -32 + rnd() * 36;
    const s = small ? 0.07 + rnd() * 0.12 : 0.2 + rnd() * (i < 14 ? 0.3 : 0.8);
    if (isBlocked(x, z, s * 1.2 + 0.2)) continue;
    rocks.push({ x, z, sx: s * (1 + rnd() * 0.5), sy: s * (0.55 + rnd() * 0.4), sz: s * (1 + rnd() * 0.4), rot: rnd() * 6.28, geo: i % 3 });
  }
  const logs: LogSpec[] = [];
  for (const [x, z] of [[-2.3, -12], [3.6, -19], [-4.4, -3]] as [number, number][]) if (!isBlocked(x, z, 1.1)) logs.push({ x, z, rot: rnd() * Math.PI, s: 0.8 + rnd() * 0.6 });
  const mushrooms: ForestLayout["mushrooms"] = [];
  for (let i = 0; i < 18; i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 1.6), z = -22 + rnd() * 26;
    if (!isBlocked(x, z, 0.3)) mushrooms.push({ x, z, s: 0.5 + rnd() * 0.7 });
  }
  // grass in clumps, plus ferns (a fan of long arching blades)
  const grass: Instances = { matrices: [], colors: [] };
  const addBlade = (x: number, z: number, h: number, lean: number, ang: number, hue: number, light: number) => {
    grass.matrices.push(compose(x, 0, z, lean, ang, (rnd() - 0.5) * 0.2, 1, h, 1));
    grass.colors.push(new THREE.Color().setHSL(hue, 0.4 + rnd() * 0.15, light));
  };
  for (let c = 0; c < 520; c++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const cx = side * (0.95 + Math.pow(rnd(), 1.5) * 5.5), cz = -33 + rnd() * 40;
    if (isBlocked(cx, cz, 0.35)) continue;
    const dry = noise3(cx * 0.4, 0, cz * 0.4) > 0.2;
    const hue = dry ? 0.16 + rnd() * 0.04 : 0.22 + rnd() * 0.06, base = 0.24 + rnd() * 0.08;
    const n = 5 + Math.floor(rnd() * 6), h = 0.45 + rnd() * 0.75;
    for (let b = 0; b < n; b++) { const a = rnd() * 6.28, d = rnd() * 0.12; addBlade(cx + Math.cos(a) * d, cz + Math.sin(a) * d, h * (0.6 + rnd() * 0.7), (rnd() - 0.2) * 0.45, a, hue, base + rnd() * 0.1); }
  }
  for (let f = 0; f < 70; f++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const cx = side * (1.0 + rnd() * 3.6), cz = -26 + rnd() * 32;
    if (isBlocked(cx, cz, 0.4)) continue;
    for (let b = 0; b < 9; b++) { const a = (b / 9) * 6.28 + rnd() * 0.3; addBlade(cx, cz, 1.1 + rnd() * 0.5, 0.75 + rnd() * 0.25, a, 0.27 + rnd() * 0.03, 0.2 + rnd() * 0.08); }
  }
  const flowers: Instances = { matrices: [], colors: [] };
  const palette = ["#f3efe2", "#f2d36b", "#b79ae0", "#e98f6b"];
  for (let i = 0; i < 160; i++) {
    const side = rnd() < 0.5 ? -1 : 1, x = side * (1.0 + Math.pow(rnd(), 1.4) * 3.5), z = -28 + rnd() * 34;
    if (isBlocked(x, z, 0.3)) continue;
    flowers.matrices.push(compose(x, 0.18 + rnd() * 0.15, z, 0, 0, 0, 1, 1, 1));
    flowers.colors.push(new THREE.Color(palette[Math.floor(rnd() * palette.length)]));
  }
  return { trees, rocks, logs, mushrooms, grass, flowers };
};

/* ---------- components ---------- */

const Tree: React.FC<TreeSpec> = ({ x, z, s, kind, variant, rot, sx, tint }) => {
  const trunkH = kind === 0 ? 4.1 : kind === 1 ? 2.0 : 1.6;
  const tg = trunkGeo[variant % 3];
  return (
    <group position={[x, 0, z]} scale={[s * sx, s, s * sx]} rotation={[0, rot, 0]}>
      <mesh geometry={tg} material={barkMat} scale={[1, trunkH, 1]} castShadow />
      {kind === 1 ? (
        <mesh geometry={pineGeo[variant % 2]} material={pineMat} position={[0, 0.9, 0]} scale={1.15} castShadow />
      ) : kind === 2 ? (
        <mesh geometry={canopyGeo[3]} material={foliageMats[tint]} position={[0, 2.15, 0]} scale={0.85} castShadow />
      ) : (
        <>
          <mesh geometry={canopyGeo[variant]} material={foliageMats[tint]} position={[0, 5.9, 0]} scale={[1.3, 1.2, 1.3]} castShadow />
          <mesh geometry={canopyGeo[(variant + 1) % 4]} material={foliageMats[(tint + 1) % 3]} position={[0.9, 4.8, 0.2]} scale={0.7} castShadow />
        </>
      )}
    </group>
  );
};

const useInstanced = (geo: THREE.BufferGeometry, mat: THREE.Material, data: Instances, receive = true) =>
  useMemo(() => {
    const im = new THREE.InstancedMesh(geo, mat, data.matrices.length);
    data.matrices.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, data.colors[i]); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = receive;
    im.frustumCulled = false;
    return im;
  }, [geo, mat, data, receive]);

const Grass: React.FC<{ layout: ForestLayout }> = ({ layout }) => {
  const blades = useInstanced(bladeGeo, grassMat, layout.grass);
  const flowers = useInstanced(petalGeo, petalMat, layout.flowers, false);
  return <><primitive object={blades} dispose={null} /><primitive object={flowers} dispose={null} /></>;
};

/** Ground plane with low-frequency colour patches and gentle hills (the path and its edges stay flat). */
const groundGeo = (() => {
  const g = new THREE.PlaneGeometry(110, 110, 110, 110);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < p.count; v++) {
    const x = p.getX(v), z = p.getZ(v);
    const away = THREE.MathUtils.smoothstep(Math.abs(x), 1.5, 4.5);
    p.setY(v, away * 0.16 * noise3(x * 0.35, 0, z * 0.35));
  }
  paint(g, (x, y, z, c) => {
    const patch = noise3(x * 0.22, 0, z * 0.22), fine = noise3(x * 1.3, 0, z * 1.3);
    c.set("#9aa890").lerp(new THREE.Color("#c9b98a"), THREE.MathUtils.clamp(patch * 0.9 + 0.15, 0, 0.7)).lerp(new THREE.Color("#7f9a6a"), THREE.MathUtils.clamp(-patch * 0.9, 0, 0.6));
    c.offsetHSL(0, 0, fine * 0.04);
  });
  g.computeVertexNormals();
  return g;
})();

/** Ground and a path strip on the CC0 forest-floor texture. Falls back to flat colours if the files are missing. */
const Ground: React.FC = () => {
  const diff = useAsset("ground diffuse", () => loadTexture(ASSET_PATHS.groundDiffuse, true));
  const nor = useAsset("ground normal", () => loadTexture(ASSET_PATHS.groundNormal, false));
  const rough = useAsset("ground roughness", () => loadTexture(ASSET_PATHS.groundRough, false));
  const ready = diff.status === "ready" && nor.status === "ready" && rough.status === "ready";
  const mats = useMemo(() => {
    const tile = (t: THREE.Texture, rx: number, ry: number) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
    const alpha = (() => {
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 8;
      const g = cv.getContext("2d")!; const grad = g.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, "#000"); grad.addColorStop(0.2, "#aaa"); grad.addColorStop(0.35, "#fff"); grad.addColorStop(0.65, "#fff"); grad.addColorStop(0.8, "#aaa"); grad.addColorStop(1, "#000");
      g.fillStyle = grad; g.fillRect(0, 0, 256, 8);
      return new THREE.CanvasTexture(cv);
    })();
    if (!ready) return { ground: std("#ffffff", 0.95, { vertexColors: true }), path: std("#a38a63", 0.95, { transparent: true, alphaMap: alpha, depthWrite: false }) };
    return {
      ground: std("#ffffff", 1, { vertexColors: true, map: tile(diff.data, 60, 60), normalMap: tile(nor.data, 60, 60), roughnessMap: tile(rough.data, 60, 60) }),
      path: std("#d9c39b", 1, { map: tile(diff.data, 1.2, 28), normalMap: tile(nor.data, 1.2, 28), roughnessMap: tile(rough.data, 1.2, 28), transparent: true, alphaMap: alpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, [ready, diff, nor, rough]);
  return (
    <>
      <mesh geometry={groundGeo} receiveShadow material={mats.ground} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -10]} receiveShadow material={mats.path}><planeGeometry args={[2.3, 60]} /></mesh>
    </>
  );
};

/** HDRI for soft reflected light. It only lights the scene; the visible sky stays a stylized colour. */
const ImageBasedLight: React.FC = () => {
  const hdr = useAsset("hdri", () => loadHdr(ASSET_PATHS.hdri));
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    if (hdr.status !== "ready") return;
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromEquirectangular(hdr.data).texture;
    scene.environment = env;
    pmrem.dispose();
    return () => { scene.environment = null; env.dispose(); };
  }, [hdr, gl, scene]);
  return null;
};

const shaftTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 256;
  const g = cv.getContext("2d")!;
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, "rgba(255,255,255,0.0)"); v.addColorStop(0.25, "rgba(255,255,255,0.9)"); v.addColorStop(1, "rgba(255,255,255,0.0)");
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.5, "rgba(0,0,0,1)"); h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(cv);
})();
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture, color: "#ffd9a0", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });

/** Soft light shafts from the low sun, leaning with its direction. Strength follows `strength` (0..1). */
const LightShafts: React.FC<{ strength: number; z0: number }> = ({ strength, z0 }) => {
  const shafts = useMemo(() => {
    const r = mulberry32(21);
    return Array.from({ length: 7 }, (_, i) => ({ x: -3.5 + i * 1.25 + (r() - 0.5), z: -9 - i * 2.2, w: 0.9 + r() * 1.4, op: 0.55 + r() * 0.45, material: shaftMat.clone() }));
  }, []);
  useLayoutEffect(() => { shafts.forEach((s) => { s.material.opacity = 0.2 * strength * s.op; }); }, [shafts, strength]);
  return (
    <>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, 4.2, z0 + s.z]} rotation={[0, 0, -0.42]} scale={[s.w, 9.5, 1]} renderOrder={5} material={s.material}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
};

/** Slow drifting dust motes. Motion is a function of the frame number only. */
const Motes: React.FC<{ frame: number; fps: number; z0: number }> = ({ frame, fps, z0 }) => {
  const im = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.007, 6, 5), new THREE.MeshBasicMaterial({ color: "#ffe2b0", transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), 90);
    m.frustumCulled = false;
    return m;
  }, []);
  useLayoutEffect(() => {
    const r = mulberry32(5), t = frame / fps, m = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const x = -2.2 + r() * 4.4, y = 0.3 + r() * 3.2, z = z0 - 9 + r() * 12, ph = r() * 6.28, sp = 0.15 + r() * 0.25;
      m.makeTranslation(x + Math.sin(t * sp + ph) * 0.25, y + Math.sin(t * sp * 1.3 + ph * 2) * 0.18, z + Math.cos(t * sp + ph) * 0.2);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
  }, [im, frame, fps, z0]);
  return <primitive object={im} dispose={null} />;
};

export const ForestEnvironment: React.FC<{ layout: ForestLayout; frame: number; fps: number; dawn: number; subjectZ: number }> = ({ layout, frame, fps, dawn, subjectZ }) => (
  <>
    <ImageBasedLight />
    <Ground />
    {layout.trees.map((t, i) => <Tree key={"t" + i} {...t} />)}
    {layout.rocks.map((r, i) => <mesh key={"r" + i} geometry={rockGeo[r.geo]} material={rockMat} position={[r.x, r.sy * 0.45, r.z]} scale={[r.sx, r.sy, r.sz]} rotation={[0, r.rot, 0]} castShadow receiveShadow />)}
    {layout.logs.map((l, i) => <mesh key={"l" + i} geometry={logGeo} material={barkMat} position={[l.x, 0.17 * l.s, l.z]} rotation={[0, l.rot, Math.PI / 2]} scale={[l.s, l.s, l.s]} castShadow receiveShadow />)}
    {layout.mushrooms.map((m, i) => (
      <group key={"m" + i} position={[m.x, 0, m.z]} scale={m.s}>
        <mesh material={mushroomStem} position={[0, 0.07, 0]}><cylinderGeometry args={[0.03, 0.04, 0.14, 8]} /></mesh>
        <mesh material={mushroomCap} position={[0, 0.15, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
    ))}
    <Grass layout={layout} />
    <LightShafts strength={0.35 + 0.65 * dawn} z0={subjectZ} />
    <Motes frame={frame} fps={fps} z0={subjectZ} />
  </>
);
