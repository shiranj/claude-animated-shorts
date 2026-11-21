import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
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

/** Lumpy low-poly blob. The bump is a pure function of position, so vertices that are duplicated per face stay joined. */
const blob = (radius: number, bump: number, seed: number, top: THREE.Color, bottom: THREE.Color, detail = 1) => {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + bump * (Math.sin(x * 4.3 + seed) * Math.cos(z * 3.7 + seed * 1.7) + 0.6 * Math.sin(y * 5.1 + seed * 2.3));
    p.setXYZ(i, x * k, y * k, z * k);
    c.copy(bottom).lerp(top, THREE.MathUtils.clamp((y / radius + 1) * 0.5, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

const tiered = (radius: number, height: number, seed: number, top: THREE.Color, bottom: THREE.Color) => {
  const g = new THREE.ConeGeometry(radius, height, 9, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.14 * Math.sin(Math.atan2(z, x) * 5 + seed) * (y < height / 2 - 0.01 ? 1 : 0);
    p.setXYZ(i, x * k, y, z * k);
    c.copy(bottom).lerp(top, THREE.MathUtils.clamp(y / height + 0.5, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

const canopyGeo = [0, 1, 2].map((i) => blob(1, 0.16, i * 1.9, new THREE.Color(["#b5c46a", "#a4b862", "#c4cc78"][i]), new THREE.Color(["#2f5a3a", "#34603a", "#3d6338"][i])));
const pineGeo = [0, 1].map((i) => tiered(1, 1.5, i * 2.1, new THREE.Color(i ? "#4f8a62" : "#5c9568"), new THREE.Color("#1f4538")));
const trunkGeo = (() => {
  const g = new THREE.CylinderGeometry(0.16, 0.26, 1, 7, 3);
  g.translate(0, 0.5, 0);
  return g;
})();
const rockGeo = [0, 1, 2].map((i) => {
  const g = blob(1, 0.22, 10 + i * 3.1, new THREE.Color("#8d9a8c"), new THREE.Color("#4c5558"), 1);
  const n = g.attributes.normal as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute;
  const moss = new THREE.Color("#6f9a4e");
  for (let v = 0; v < p.count; v++) if (n.getY(v) > 0.55) { const c = new THREE.Color(col.getX(v), col.getY(v), col.getZ(v)).lerp(moss, 0.7); col.setXYZ(v, c.r, c.g, c.b); }
  return g;
});
const bladeGeo = (() => {
  const g = new THREE.ConeGeometry(0.04, 0.6, 3, 1);
  g.translate(0, 0.3, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 0.6; col.set([0.35 + 0.65 * t, 0.55 + 0.45 * t, 0.3 + 0.2 * t], i * 3); }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
})();

const std = (color: string, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: ENV_INTENSITY, ...extra });
const foliageMats = ["#ffffff", "#e8f2c8", "#d6e8b4"].map((c) => std(c, 0.85, { vertexColors: true, flatShading: true }));
const rockMat = std("#ffffff", 0.9, { vertexColors: true, flatShading: true });
const barkMat = std("#6b4a38", 0.95);
const grassMat = std("#ffffff", 0.8, { vertexColors: true });
const mushroomCap = std("#d9553a", 0.6);
const mushroomStem = std("#efe3cf", 0.7);

/* ---------- scene layout ---------- */

type TreeSpec = { x: number; z: number; s: number; kind: number; rot: number };
type RockSpec = { x: number; z: number; sx: number; sy: number; sz: number; rot: number; geo: number };

export type ForestLayout = { trees: TreeSpec[]; rocks: RockSpec[]; mushrooms: { x: number; z: number; s: number }[]; grass: THREE.Matrix4[]; grassColors: THREE.Color[] };

/**
 * Build the layout once. `isBlocked(x, z, radius)` lets the shot reject any object that would hide the subject from the camera.
 * The path runs along the z axis at x = 0.
 */
export const buildForestLayout = (isBlocked: (x: number, z: number, radius: number) => boolean): ForestLayout => {
  const rnd = mulberry32(7);
  const trees: TreeSpec[] = [];
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1;
    const near = i < 34; // trunks close to the path frame the narrow vertical image (canopies are high, out of frame)
    const x = side * (near ? 2.3 + rnd() * 1.6 : 4.5 + rnd() * 9);
    const z = -34 + rnd() * 40;
    const s = 0.9 + rnd() * 0.75;
    if (isBlocked(x, z, 0.5 * s + 0.35)) continue;
    trees.push({ x, z, s, kind: Math.abs(x) > 5 && rnd() < 0.5 ? 1 : 0, rot: rnd() * Math.PI * 2 });
  }
  const rocks: RockSpec[] = [];
  for (let i = 0; i < 26; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (1.25 + rnd() * (i < 14 ? 1.4 : 6));
    const z = -30 + rnd() * 34;
    const s = 0.18 + rnd() * (i < 20 ? 0.35 : 0.9);
    if (isBlocked(x, z, s * 1.2 + 0.2)) continue;
    rocks.push({ x, z, sx: s * (1 + rnd() * 0.5), sy: s * (0.6 + rnd() * 0.4), sz: s * (1 + rnd() * 0.4), rot: rnd() * 6.28, geo: i % 3 });
  }
  const mushrooms: ForestLayout["mushrooms"] = [];
  for (let i = 0; i < 14; i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 1.2), z = -20 + rnd() * 22;
    if (!isBlocked(x, z, 0.3)) mushrooms.push({ x, z, s: 0.5 + rnd() * 0.7 });
  }
  const grass: THREE.Matrix4[] = [];
  const grassColors: THREE.Color[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 2600; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (0.95 + Math.pow(rnd(), 1.6) * 5);
    const z = -32 + rnd() * 38;
    if (isBlocked(x, z, 0.35)) continue;
    const s = 0.3 + rnd() * 0.4;
    e.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5);
    q.setFromEuler(e);
    grass.push(m.clone().compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.8 + rnd() * 0.8), s)));
    grassColors.push(new THREE.Color().setHSL(0.22 + rnd() * 0.07, 0.38 + rnd() * 0.15, 0.27 + rnd() * 0.1));
  }
  return { trees, rocks, mushrooms, grass, grassColors };
};

/* ---------- components ---------- */

const Tree: React.FC<TreeSpec> = ({ x, z, s, kind, rot }) => {
  const trunkH = kind === 0 ? 3.6 : 1.6;
  return (
    <group position={[x, 0, z]} scale={s} rotation={[0, rot, 0]}>
      <mesh geometry={trunkGeo} material={barkMat} scale={[1, trunkH, 1]} castShadow />
      {kind === 0 ? (
        <>
          <mesh geometry={canopyGeo[(Math.abs(x * 7) | 0) % 3]} material={foliageMats[(Math.abs(z * 3) | 0) % 3]} position={[0, 4.6, 0]} scale={[1.55, 1.25, 1.55]} castShadow />
          <mesh geometry={canopyGeo[1]} material={foliageMats[0]} position={[0.85, 4.0, 0.3]} scale={[1.0, 0.85, 1.0]} castShadow />
          <mesh geometry={canopyGeo[2]} material={foliageMats[1]} position={[-0.8, 4.2, -0.35]} scale={[1.05, 0.9, 1.05]} castShadow />
          <mesh geometry={canopyGeo[0]} material={foliageMats[2]} position={[0.1, 5.4, 0.1]} scale={[0.95, 0.8, 0.95]} castShadow />
        </>
      ) : (
        [0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={pineGeo[i % 2]} material={foliageMats[0]} position={[0, 1.9 + i * 0.95, 0]} scale={[1.55 - i * 0.28, 1.2 - i * 0.08, 1.55 - i * 0.28]} castShadow />
        ))
      )}
    </group>
  );
};

const Grass: React.FC<{ layout: ForestLayout }> = ({ layout }) => {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(bladeGeo, grassMat, layout.grass.length);
    layout.grass.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, layout.grassColors[i]); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    return im;
  }, [layout]);
  return <primitive object={mesh} dispose={null} />;
};

/** Ground plane and a path strip on the CC0 forest-floor texture. Falls back to flat colours if the files are missing. */
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
    if (!ready) return { ground: std("#4c6a45", 0.95), path: std("#a38a63", 0.95, { transparent: true, alphaMap: alpha, depthWrite: false }) };
    return {
      ground: std("#8fa38a", 1, { map: tile(diff.data, 60, 60), normalMap: tile(nor.data, 60, 60), roughnessMap: tile(rough.data, 60, 60) }),
      path: std("#e0c9a0", 1, { map: tile(diff.data, 1.2, 28), normalMap: tile(nor.data, 1.2, 28), roughnessMap: tile(rough.data, 1.2, 28), transparent: true, alphaMap: alpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, [ready, diff, nor, rough]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.ground}><planeGeometry args={[110, 110]} /></mesh>
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
    {layout.rocks.map((r, i) => <mesh key={"r" + i} geometry={rockGeo[r.geo]} material={rockMat} position={[r.x, r.sy * 0.55, r.z]} scale={[r.sx, r.sy, r.sz]} rotation={[0, r.rot, 0]} castShadow receiveShadow />)}
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
