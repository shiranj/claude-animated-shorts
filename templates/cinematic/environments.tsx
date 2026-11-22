import React, { useMemo } from "react";
import * as THREE from "three";
import type { Lighting } from "./lighting";

/* ------------------------------------------------------------------------------------------------
 * Extra environments for the story runtime (the forest is in ForestEnvironment.tsx).
 *
 *   Workshop: a small interior built from simple shapes and canvas textures: plank floor, plaster walls, a window in the left wall
 *             that shows the sky colour of the current lighting, a wall clock with a swinging pendulum, shelves, a counter, a lamp and a door
 *             gap in the back wall (x from 1.7 to 2.9) so that a character can walk in toward the camera.
 *   Studio:   an empty floor and a soft backdrop, for explainers and dialogue.
 *
 * Layout in metres. The camera looks toward -z by default, characters face +z at yaw 0. The back wall is at z = -3.6, the room
 * is 7.2 m wide (x from -3.6 to 3.6) and open on the camera side. Everything animated is a function of the frame number.
 * All textures are drawn in code: no files and no licences.
 * ---------------------------------------------------------------------------------------------- */

export type EnvironmentName = "forest" | "workshop" | "studio";
export const WORKSHOP = { halfWidth: 3.6, backZ: -3.6, door: { x0: 1.7, x1: 2.9, height: 2.2 }, wallHeight: 4.2 } as const;

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
};
const rnd = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const woodFloor = () => canvasTexture(512, 512, (g) => {
  const r = rnd(5);
  for (let i = 0; i < 8; i++) {
    const base = 96 + Math.floor(r() * 26);
    g.fillStyle = `rgb(${base + 38},${base + 8},${base - 30})`; g.fillRect(0, i * 64, 512, 62);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,20,8,${0.06 + r() * 0.08})`; g.beginPath(); const y = i * 64 + r() * 62; g.moveTo(0, y); g.lineTo(512, y + (r() - 0.5) * 6); g.stroke(); }
    g.fillStyle = "rgba(20,10,4,0.75)"; g.fillRect(0, i * 64 + 62, 512, 2);
    g.fillRect(Math.floor(r() * 500), i * 64, 2, 62);
  }
}, [3.6, 6]);

const plaster = () => canvasTexture(512, 512, (g) => {
  const r = rnd(9);
  g.fillStyle = "#a98262"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,235,200" : "60,36,20"},${0.02 + r() * 0.05})`; g.beginPath(); g.arc(r() * 512, r() * 512, 1 + r() * 5, 0, 6.3); g.fill(); }
  g.fillStyle = "#4a2f1c"; g.fillRect(0, 330, 512, 182);               // dark wood panelling on the lower third
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x, 330, 3, 182); }
  g.fillStyle = "#6b4529"; g.fillRect(0, 322, 512, 10);                  // rail
}, [2, 1]);

const clockFace = () => canvasTexture(256, 256, (g) => {
  g.fillStyle = "#e9dcc0"; g.beginPath(); g.arc(128, 128, 124, 0, 6.3); g.fill();
  g.strokeStyle = "#3a2a1c"; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 120, 0, 6.3); g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, l = i % 3 === 0 ? 24 : 12; g.lineWidth = i % 3 === 0 ? 7 : 4; g.beginPath(); g.moveTo(128 + Math.sin(a) * (112 - l), 128 - Math.cos(a) * (112 - l)); g.lineTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); g.stroke(); }
});

const M = {
  wood: new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.75 }),
  darkWood: new THREE.MeshStandardMaterial({ color: "#3a2416", roughness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: "#b58a3a", roughness: 0.35, metalness: 0.9 }),
  iron: new THREE.MeshStandardMaterial({ color: "#2b2b30", roughness: 0.5, metalness: 0.8 }),
  paper: new THREE.MeshStandardMaterial({ color: "#d9c9a4", roughness: 0.9 }),
  rug: new THREE.MeshStandardMaterial({ color: "#6d2e2a", roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: "#8fb7c9", roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false }),
};

/** A round clock: face, brass rim, two hands. `minute` is the minute hand angle in radians (clockwise). Rotates toward +z. */
export const Clock: React.FC<{ position: [number, number, number]; radius: number; minute: number }> = ({ position, radius, minute }) => {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 }), []);
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={M.brass}><cylinderGeometry args={[radius * 1.06, radius * 1.06, 0.05, 32]} /></mesh>
      <mesh position={[0, 0, 0.027]} material={face}><circleGeometry args={[radius, 32]} /></mesh>
      <group position={[0, 0, 0.04]}>
        <group rotation={[0, 0, -minute]}><mesh position={[0, radius * 0.38, 0]} material={M.iron}><boxGeometry args={[radius * 0.06, radius * 0.76, 0.006]} /></mesh></group>
        <group rotation={[0, 0, -minute / 12]}><mesh position={[0, radius * 0.25, 0.004]} material={M.iron}><boxGeometry args={[radius * 0.09, radius * 0.5, 0.006]} /></mesh></group>
      </group>
    </group>
  );
};

/** Wall clock with a case and a pendulum that swings with the frame number. */
const PendulumClock: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const swing = 0.32 * Math.sin((frame / fps) * Math.PI * 2 / 1.6);
  return (
    <group position={[-3.0, 1.75, WORKSHOP.backZ + 0.14]}>
      <mesh castShadow receiveShadow material={M.wood}><boxGeometry args={[0.5, 1.5, 0.22]} /></mesh>
      <mesh position={[0, 0.78, 0]} castShadow material={M.darkWood}><boxGeometry args={[0.6, 0.12, 0.28]} /></mesh>
      <Clock position={[0, 0.42, 0.115]} radius={0.19} minute={(frame / fps) * 0.35} />
      <mesh position={[0, -0.18, 0.115]} material={M.darkWood}><boxGeometry args={[0.34, 0.74, 0.01]} /></mesh>
      <group position={[0, 0.1, 0.13]} rotation={[0, 0, swing]}>
        <mesh position={[0, -0.28, 0]} material={M.brass}><boxGeometry args={[0.012, 0.56, 0.01]} /></mesh>
        <mesh position={[0, -0.58, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.brass}><cylinderGeometry args={[0.07, 0.07, 0.025, 20]} /></mesh>
      </group>
    </group>
  );
};

const Shelves: React.FC<{ minute: number }> = ({ minute }) => (
  <group position={[-1.2, 0, WORKSHOP.backZ + 0.18]}>
    {[1.0, 1.75, 2.5].map((y, i) => (
      <group key={i}>
        <mesh position={[0, y, 0]} castShadow receiveShadow material={M.wood}><boxGeometry args={[1.9, 0.05, 0.34]} /></mesh>
        {[-0.8, 0.8].map((x) => <mesh key={x} position={[x, y - 0.18, -0.05]} material={M.darkWood}><boxGeometry args={[0.04, 0.3, 0.2]} /></mesh>)}
      </group>
    ))}
    {/* small things: books, jars, little clocks */}
    {[[-0.7, 0.12, 0.25], [-0.55, 0.15, 0.2], [-0.4, 0.1, 0.3]].map(([x, h, w], i) => <mesh key={"b" + i} position={[x, 1.025 + h / 2, 0]} material={i % 2 ? M.paper : M.darkWood} castShadow><boxGeometry args={[0.07, h, w]} /></mesh>)}
    <Clock position={[0.35, 1.2, 0.05]} radius={0.14} minute={minute * 1.7} />
    <Clock position={[-0.45, 1.97, 0.05]} radius={0.12} minute={minute * 0.6} />
    <mesh position={[0.5, 1.88, 0]} material={M.glass}><cylinderGeometry args={[0.07, 0.07, 0.2, 14]} /></mesh>
    <mesh position={[-0.1, 1.82, 0]} material={M.brass} castShadow><sphereGeometry args={[0.07, 12, 10]} /></mesh>
  </group>
);

/** A work counter with tools and a lamp. The lamp is lit by the `practical` strength of the lighting. */
const Counter: React.FC<{ frame: number; practical: number }> = ({ frame, practical }) => {
  const flick = 1 + 0.04 * Math.sin(frame * 0.7) + 0.03 * Math.sin(frame * 1.9);
  return (
    <group position={[1.0, 0, -1.85]}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow material={M.wood}><boxGeometry args={[2.1, 0.07, 0.75]} /></mesh>
      <mesh position={[0, 0.44, 0.02]} castShadow receiveShadow material={M.darkWood}><boxGeometry args={[2.0, 0.84, 0.66]} /></mesh>
      {[-0.5, 0, 0.5].map((x) => <mesh key={x} position={[x, 0.5, 0.36]} material={M.wood}><boxGeometry args={[0.46, 0.6, 0.02]} /></mesh>)}
      {/* parts on the counter */}
      {[[-0.7, 0.16], [-0.45, 0.1], [-0.25, 0.06]].map(([x, r], i) => <mesh key={i} position={[x, 0.94 + 0.01 * i, 0.12 - 0.1 * i]} rotation={[Math.PI / 2, 0, i]} castShadow material={M.brass}><cylinderGeometry args={[r, r, 0.02, 14]} /></mesh>)}
      <mesh position={[-0.9, 0.99, -0.1]} castShadow material={M.iron}><boxGeometry args={[0.22, 0.1, 0.12]} /></mesh>
      <mesh position={[0.5, 0.945, 0.15]} material={M.paper}><boxGeometry args={[0.36, 0.015, 0.26]} /></mesh>
      {/* lamp */}
      <group position={[0.85, 0.935, -0.12]}>
        <mesh position={[0, 0.02, 0]} material={M.brass}><cylinderGeometry args={[0.07, 0.08, 0.04, 14]} /></mesh>
        <mesh position={[0, 0.2, 0]} material={M.brass}><cylinderGeometry args={[0.012, 0.012, 0.36, 8]} /></mesh>
        <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.09, 14, 10]} /><meshBasicMaterial color={new THREE.Color("#ffd9a0").multiplyScalar(0.35 + 0.3 * Math.min(practical, 1.3))} /></mesh>
        <pointLight position={[0, 0.42, 0.05]} color="#ffb468" intensity={2.4 * practical * flick} distance={6} decay={1.4} />
      </group>
    </group>
  );
};

export const WorkshopEnvironment: React.FC<{ frame: number; fps: number; look: Lighting }> = ({ frame, fps, look }) => {
  const floorTex = useMemo(woodFloor, []), wallTex = useMemo(plaster, []);
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }), [floorTex]);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }), [wallTex]);
  const outside = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }), []);
  const win = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }), []);
  const sky = new THREE.Color(look.sky);
  win.color.copy(sky).multiplyScalar(1.25).addScalar(0.03);
  outside.color.copy(sky).multiplyScalar(1.05).addScalar(0.03);
  const { halfWidth: W, backZ, door, wallHeight: H } = WORKSHOP, minute = (frame / fps) * 0.35;
  const sideLen = 14, sideZ = backZ + sideLen / 2;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, backZ + sideLen / 2]} receiveShadow material={floor}><planeGeometry args={[W * 2, sideLen]} /></mesh>
      <mesh position={[0, 0.011, -0.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={M.rug}><circleGeometry args={[1.7, 40]} /></mesh>
      <mesh position={[0, 0.012, -0.3]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.45, 1.55, 40]} /><meshStandardMaterial color="#c9a45a" roughness={1} /></mesh>
      {/* back wall with a door gap */}
      <mesh position={[(-W + door.x0) / 2, H / 2, backZ]} receiveShadow material={wall}><planeGeometry args={[door.x0 + W, H]} /></mesh>
      <mesh position={[(door.x1 + W) / 2, H / 2, backZ]} receiveShadow material={wall}><planeGeometry args={[W - door.x1, H]} /></mesh>
      <mesh position={[(door.x0 + door.x1) / 2, (door.height + H) / 2, backZ]} material={wall}><planeGeometry args={[door.x1 - door.x0, H - door.height]} /></mesh>
      <mesh position={[(door.x0 + door.x1) / 2, 2.0, backZ - 2.4]} material={outside}><planeGeometry args={[7, 5]} /></mesh>
      {[door.x0, door.x1].map((x) => <mesh key={x} position={[x, door.height / 2, backZ + 0.03]} castShadow material={M.darkWood}><boxGeometry args={[0.1, door.height, 0.1]} /></mesh>)}
      <mesh position={[(door.x0 + door.x1) / 2, door.height, backZ + 0.03]} material={M.darkWood}><boxGeometry args={[door.x1 - door.x0 + 0.1, 0.1, 0.1]} /></mesh>
      {/* left wall with a window */}
      <mesh position={[-W, H / 2, sideZ]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wall}><planeGeometry args={[sideLen, H]} /></mesh>
      <group position={[-W + 0.02, 1.95, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={win}><planeGeometry args={[1.0, 1.25]} /></mesh>
        <mesh position={[0, 0, 0.03]} material={M.darkWood}><boxGeometry args={[0.05, 1.3, 0.05]} /></mesh>
        <mesh position={[0, 0, 0.03]} material={M.darkWood}><boxGeometry args={[1.06, 0.05, 0.05]} /></mesh>
        {([[-0.53, 0, 0.06, 1.3], [0.53, 0, 0.06, 1.3], [0, 0.65, 1.12, 0.06], [0, -0.65, 1.12, 0.06]] as const).map(([x, y, w, h], i) => <mesh key={i} position={[x, y, 0.03]} material={M.darkWood}><boxGeometry args={[w, h, 0.07]} /></mesh>)}
      </group>
      {/* right wall */}
      <mesh position={[W, H / 2, sideZ]} rotation={[0, -Math.PI / 2, 0]} receiveShadow material={wall}><planeGeometry args={[sideLen, H]} /></mesh>
      {/* ceiling beams (the ceiling itself is left open, so the camera can go high) */}
      {[-2.2, 0.4, 3.0].map((z) => <mesh key={z} position={[0, H, z]} material={M.darkWood}><boxGeometry args={[W * 2, 0.22, 0.22]} /></mesh>)}
      <PendulumClock frame={frame} fps={fps} />
      <Shelves minute={minute} />
      <Counter frame={frame} practical={look.practical} />
    </>
  );
};

/** An empty floor with a soft round backdrop: for explainers and dialogue. The colours follow the lighting. */
export const StudioEnvironment: React.FC<{ look: Lighting }> = ({ look }) => {
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a8f98", roughness: 0.9 }), []);
  floor.color.set(look.ambientGround).lerp(new THREE.Color(look.fog), 0.55);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow material={floor}><circleGeometry args={[30, 48]} /></mesh>
      <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.3, 2.38, 64]} /><meshBasicMaterial color={look.rim} transparent opacity={0.25} /></mesh>
    </>
  );
};
