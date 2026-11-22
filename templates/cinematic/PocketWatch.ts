import * as THREE from "three";

/* ------------------------------------------------------------------------------------------------
 * A pocket watch on a short chain, built in metres (case 5.4 cm wide). The group origin is where the fingers hold the chain; the watch
 * hangs below it. Use with `hangFromBone` (props.ts) so it stays upright and sways a little. The face looks toward +z.
 * `setGlow(frame, strength)`: 0 = a plain watch, 1 = the face glows cyan and lights its surroundings. Pure function of its arguments.
 * Everything is drawn in code (no files, no licence).
 * ---------------------------------------------------------------------------------------------- */

const brass = new THREE.MeshStandardMaterial({ color: "#c79a43", roughness: 0.3, metalness: 0.95 });
const faceTex = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d")!;
  g.fillStyle = "#f2e8cf"; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
  g.strokeStyle = "#2a2018"; g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, r0 = i % 3 ? 50 : 44; g.lineWidth = i % 3 ? 2 : 4; g.beginPath(); g.moveTo(64 + Math.sin(a) * r0, 64 - Math.cos(a) * r0); g.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 24); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(88, 74); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

export type PocketWatch = { group: THREE.Group; light: THREE.PointLight; setGlow: (frame: number, strength: number) => void };

export const makePocketWatch = (): PocketWatch => {
  const group = new THREE.Group();
  const body = new THREE.Group(); body.position.y = -0.165; group.add(body);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.12, 5), brass); chain.position.y = -0.06; group.add(chain);
  const add = (m: THREE.Object3D) => { body.add(m); return m; };
  const rim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.014, 28), brass)) as THREE.Mesh; rim.rotation.x = Math.PI / 2; rim.castShadow = true;
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5, emissive: "#8ff0ff", emissiveMap: faceTex, emissiveIntensity: 0 });
  const face = add(new THREE.Mesh(new THREE.CircleGeometry(0.0245, 28), faceMat)); face.position.z = 0.0075;
  const crown = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8), brass)); crown.position.y = 0.032;
  const bow = add(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0017, 6, 14), brass)); bow.position.y = 0.043;
  const haloTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,0.95)"); r.addColorStop(0.3, "rgba(255,255,255,0.3)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: "#8ff0ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(0.3); halo.position.z = 0.02; body.add(halo);
  const light = new THREE.PointLight("#8ff0ff", 0, 4, 1.6); light.position.z = 0.06; body.add(light);
  return {
    group, light,
    setGlow: (frame, strength) => {
      const pulse = 1 + 0.12 * Math.sin(frame * 0.35);
      faceMat.emissiveIntensity = 1.4 * strength * pulse;
      light.intensity = 2.2 * strength * pulse;
      (halo.material as THREE.SpriteMaterial).opacity = 0.55 * strength * pulse;
    },
  };
};
