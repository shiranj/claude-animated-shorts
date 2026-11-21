import * as THREE from "three";
import { ENV_INTENSITY } from "./ForestEnvironment";

/* ------------------------------------------------------------------------------------------------
 * A hand lantern prop, built in metres (about 0.30 m tall including the handle).
 * Frame and handle: dark brass. Glass: translucent warm. Flame: small emissive teardrop with a faint halo.
 * One point light sits inside. Its falloff is deliberately gentler than physical (decay 1.4, not 2): with a strong
 * inverse-square light only ~0.3 m above the ground, the pool on the path overexposes, the orange channel clips, and
 * tone mapping leaves a yellow-green-cyan fringe.
 * ---------------------------------------------------------------------------------------------- */

const brass = new THREE.MeshStandardMaterial({ color: "#6b4a22", roughness: 0.45, metalness: 0.85, envMapIntensity: ENV_INTENSITY * 1.5 });
const glass = new THREE.MeshStandardMaterial({ color: "#ffcf94", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: ENV_INTENSITY * 2, emissive: "#ff8a30", emissiveIntensity: 0.25 });
const flameMat = new THREE.MeshBasicMaterial({ color: "#ffc070" });
const flameCore = new THREE.MeshBasicMaterial({ color: "#fff0cf" });

const haloTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(0.2, "rgba(255,255,255,0.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();
const haloMat = new THREE.SpriteMaterial({ map: haloTexture, color: "#ff9a40", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.35 });

// geometry shared by every lantern
const glassGeo = new THREE.CylinderGeometry(0.052, 0.062, 0.15, 6, 1, false);
const postGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.15, 5);
const baseGeo = new THREE.CylinderGeometry(0.068, 0.056, 0.022, 6);
const baseFootGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.012, 6);
const capGeo = new THREE.ConeGeometry(0.075, 0.05, 6);
const collarGeo = new THREE.CylinderGeometry(0.058, 0.066, 0.014, 6);
const ringGeo = new THREE.TorusGeometry(0.014, 0.0035, 5, 12);
const handleGeo = new THREE.TorusGeometry(0.058, 0.0045, 5, 18, Math.PI);
const flameGeo = (() => { const g = new THREE.SphereGeometry(0.02, 10, 8); g.scale(0.75, 1.6, 0.75); g.translate(0, 0.016, 0); return g; })();
const coreGeo = (() => { const g = new THREE.SphereGeometry(0.01, 8, 6); g.scale(0.7, 1.5, 0.7); g.translate(0, 0.008, 0); return g; })();

export type Lantern = {
  /** Add to a hand bone. The top ring is at the origin; the lantern hangs down along -y. */
  group: THREE.Group;
  light: THREE.PointLight;
  /** Strength of the light. Call every frame. */
  setGlow: (frame: number, base: number) => void;
};

export const makeLantern = (): Lantern => {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -0.255; // body centre; the handle ring is at the group origin
  group.add(body);

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, castShadow = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = castShadow; body.add(m); return m;
  };
  add(baseFootGeo, brass, -0.092);
  add(baseGeo, brass, -0.075);
  add(glassGeo, glass, 0).renderOrder = 3;
  for (let i = 0; i < 6; i++) { // corner posts
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, r = 0.0575;
    const p = new THREE.Mesh(postGeo, brass); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    p.rotation.set(Math.sin(a) * 0.055, 0, -Math.cos(a) * 0.055); body.add(p);
  }
  add(collarGeo, brass, 0.082);
  add(capGeo, brass, 0.108);
  add(ringGeo, brass, 0.142).rotation.x = Math.PI / 2;
  const handle = add(handleGeo, brass, 0.098); // bail handle arching over the cap
  handle.rotation.set(0, 0, 0);
  const flame = add(flameGeo, flameMat, -0.03); flame.renderOrder = 4;
  add(coreGeo, flameCore, -0.03).renderOrder = 5;
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(0.22); halo.position.y = -0.01; body.add(halo);

  const light = new THREE.PointLight("#ffb55a", 1.4, 7, 1.4);
  light.position.y = -0.005;
  body.add(light);

  return {
    group, light,
    setGlow: (frame, base) => {
      const flicker = 1 + 0.05 * Math.sin(frame * 0.7) + 0.035 * Math.sin(frame * 1.9 + 1);
      light.intensity = base * flicker;
      flame.scale.set(1, 1 + 0.08 * Math.sin(frame * 0.9), 1);
    },
  };
};
