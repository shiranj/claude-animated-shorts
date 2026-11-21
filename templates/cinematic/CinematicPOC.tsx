import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";

const FPS = 30;
const FRAMES = 300;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const mat = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const rockMat = mat("#555b5a");
const mossMat = mat("#344b3c");
const barkMat = mat("#49372c");
const pineMats = [mat("#243e39"), mat("#315348"), mat("#3c6250")];
const clothMat = mat("#344454");
const cloakMat = mat("#263440");
const leatherMat = mat("#65452f");
const skinMat = mat("#c58e6d");
const goldMat = new THREE.MeshStandardMaterial({ color: "#e7a94c", roughness: 0.3, metalness: 0.55 });
const glowMat = new THREE.MeshBasicMaterial({ color: "#ffbd59" });

function CameraRig({ frame }: { frame: number }) {
  const { camera } = useThree();
  const t = ease(frame / FRAMES);
  const arc = Math.sin(t * Math.PI * 0.5);
  camera.position.set(5.8 - 2.5 * t, 3.15 - 0.45 * t, 9.8 - 2.1 * t);
  camera.lookAt(-0.2 + 0.25 * t, 1.25 + 0.05 * arc, 0);
  if (camera instanceof THREE.PerspectiveCamera) camera.fov = lerp(42, 36, t);
  camera.updateProjectionMatrix();
  return null;
}

function Tree({ x, z, scale = 1, tone = 0 }: { x: number; z: number; scale?: number; tone?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.8, 0]} material={barkMat} castShadow>
        <cylinderGeometry args={[0.13, 0.22, 1.6, 7]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1.25 + i * 0.58, 0]} material={pineMats[(tone + i) % pineMats.length]} castShadow>
          <coneGeometry args={[1.02 - i * 0.2, 1.65, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Rock({ position, scale, rotation = 0 }: { position: [number, number, number]; scale: [number, number, number]; rotation?: number }) {
  return <mesh position={position} scale={scale} rotation={[0, rotation, 0]} material={rockMat} castShadow receiveShadow>
    <dodecahedronGeometry args={[1, 1]} />
  </mesh>;
}

function Limb({ a, b, radius, material }: { a: [number, number, number]; b: [number, number, number]; radius: number; material: THREE.Material }) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start);
  return <mesh position={mid.toArray()} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())} material={material} castShadow>
    <cylinderGeometry args={[radius * 0.82, radius, dir.length(), 10]} />
  </mesh>;
}

function Traveller({ frame }: { frame: number }) {
  const lift = ease((frame - 110) / 90);
  const sway = Math.sin(frame / FPS * 1.4) * 0.025;
  const lanternY = 1.75 + lift * 0.52 + sway;
  return (
    <group position={[0, 0, 0]}>
      {/* boots and legs */}
      <mesh position={[-0.19, 0.16, 0.02]} scale={[0.19, 0.16, 0.3]} material={leatherMat} castShadow><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh position={[0.2, 0.16, 0.02]} scale={[0.19, 0.16, 0.3]} material={leatherMat} castShadow><sphereGeometry args={[1, 16, 12]} /></mesh>
      <Limb a={[-0.18, 0.28, 0]} b={[-0.22, 0.91, 0]} radius={0.13} material={clothMat} />
      <Limb a={[0.18, 0.28, 0]} b={[0.2, 0.91, 0]} radius={0.13} material={clothMat} />
      {/* layered coat body */}
      <mesh position={[0, 1.12, 0]} scale={[0.42, 0.62, 0.27]} material={clothMat} castShadow>
        <capsuleGeometry args={[0.31, 0.5, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.83, -0.055]} scale={[0.5, 0.72, 0.19]} material={cloakMat} castShadow>
        <coneGeometry args={[0.56, 1.42, 12, 2]} />
      </mesh>
      {/* belt, buckle and cross-body strap */}
      <mesh position={[0, 0.98, 0.255]} scale={[0.39, 0.075, 0.045]} material={leatherMat} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0.04, 0.99, 0.305]} material={goldMat}><boxGeometry args={[0.11, 0.11, 0.035]} /></mesh>
      <mesh position={[-0.11, 1.26, 0.23]} rotation={[0, 0, -0.42]} material={leatherMat}><boxGeometry args={[0.075, 0.72, 0.055]} /></mesh>
      {/* shoulders and arms */}
      <mesh position={[-0.38, 1.52, 0]} scale={[0.2, 0.19, 0.24]} material={cloakMat} castShadow><sphereGeometry args={[1, 16, 12]} /></mesh>
      <mesh position={[0.38, 1.52, 0]} scale={[0.2, 0.19, 0.24]} material={cloakMat} castShadow><sphereGeometry args={[1, 16, 12]} /></mesh>
      <Limb a={[-0.38, 1.48, 0.03]} b={[-0.55, 1.1, 0.23]} radius={0.105} material={clothMat} />
      <Limb a={[0.38, 1.48, 0.03]} b={[0.57, lanternY, 0.25]} radius={0.105} material={clothMat} />
      <mesh position={[-0.55, 1.08, 0.23]} scale={[0.105, 0.12, 0.09]} material={skinMat}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh position={[0.57, lanternY, 0.25]} scale={[0.1, 0.12, 0.09]} material={skinMat}><sphereGeometry args={[1, 12, 10]} /></mesh>
      {/* neck and head */}
      <mesh position={[0, 1.68, 0]} scale={[0.13, 0.18, 0.13]} material={skinMat}><cylinderGeometry args={[0.12, 0.15, 0.28, 12]} /></mesh>
      <mesh position={[0, 1.98, 0.015]} scale={[0.28, 0.34, 0.25]} material={skinMat} castShadow><sphereGeometry args={[1, 24, 18]} /></mesh>
      {/* hair cap and swept locks */}
      <mesh position={[0, 2.16, -0.015]} scale={[0.29, 0.19, 0.26]} material={barkMat} castShadow><sphereGeometry args={[1, 20, 14]} /></mesh>
      <mesh position={[-0.19, 2.04, 0.02]} rotation={[0, 0, 0.35]} scale={[0.1, 0.22, 0.13]} material={barkMat}><sphereGeometry args={[1, 12, 10]} /></mesh>
      {/* face details, facing +Z */}
      <mesh position={[-0.105, 2.01, 0.237]} scale={[0.035, 0.045, 0.018]} material={mat("#282a2b", 0.35)}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh position={[0.105, 2.01, 0.237]} scale={[0.035, 0.045, 0.018]} material={mat("#282a2b", 0.35)}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh position={[0, 1.91, 0.25]} scale={[0.055, 0.07, 0.06]} material={skinMat}><sphereGeometry args={[1, 12, 10]} /></mesh>
      {/* raised lantern */}
      <group position={[0.57, lanternY - 0.12, 0.25]}>
        <mesh position={[0, 0.03, 0]} material={goldMat} castShadow><boxGeometry args={[0.22, 0.29, 0.19]} /></mesh>
        <mesh position={[0, 0.03, 0.105]} material={glowMat}><planeGeometry args={[0.13, 0.19]} /></mesh>
        <mesh position={[0, 0.2, 0]} material={goldMat}><torusGeometry args={[0.105, 0.025, 6, 16]} /></mesh>
        <mesh position={[0, 0.31, 0]} material={goldMat}><torusGeometry args={[0.065, 0.018, 6, 16]} /></mesh>
      </group>
      {/* satchel */}
      <mesh position={[-0.37, 1.05, -0.12]} rotation={[0, 0, -0.1]} material={leatherMat} castShadow><boxGeometry args={[0.3, 0.35, 0.18]} /></mesh>
      <mesh position={[-0.37, 1.22, -0.12]} material={goldMat}><boxGeometry args={[0.18, 0.045, 0.025]} /></mesh>
    </group>
  );
}

function Fireflies({ frame }: { frame: number }) {
  const points = Array.from({ length: 34 }, (_, i) => {
    const phase = frame / FPS * (0.55 + (i % 5) * 0.07) + i * 2.17;
    return { x: Math.sin(i * 12.3) * (2.5 + (i % 4)), y: 0.5 + (i % 7) * 0.34 + Math.sin(phase) * 0.16, z: -1.5 - (i % 8) * 0.85, o: 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 1.7)) };
  });
  return <group>{points.map((p, i) => <mesh key={i} position={[p.x, p.y, p.z]} scale={0.018 + (i % 3) * 0.006}>
    <sphereGeometry args={[1, 6, 6]} />
    <meshBasicMaterial color="#ffc96f" transparent opacity={p.o} />
  </mesh>)}</group>;
}

function MountainScene({ frame }: { frame: number }) {
  const dawn = ease((frame - 95) / 175);
  const lantern = ease((frame - 110) / 75);
  const { scene } = useThree();
  scene.background = new THREE.Color("#172b39").lerp(new THREE.Color("#c18b68"), dawn);
  scene.fog = new THREE.Fog(new THREE.Color("#263b49").lerp(new THREE.Color("#d2a17b"), dawn), 10, 34);
  return (
    <>
      <CameraRig frame={frame} />
      <ambientLight intensity={lerp(0.28, 0.62, dawn)} color="#a9c5d4" />
      <hemisphereLight args={["#b9d4e2", "#26342d", 0.65]} />
      <directionalLight position={[-5, 8, -4]} intensity={lerp(0.45, 2.25, dawn)} color={new THREE.Color("#91b4d0").lerp(new THREE.Color("#ffbd82"), dawn)} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[0.57, 2.1, 0.5]} intensity={lerp(1.2, 3.8, lantern)} distance={5} color="#ffad4d" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow material={mat("#35463d")}>
        <planeGeometry args={[90, 90, 1, 1]} />
      </mesh>
      {/* distant mountain silhouettes */}
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[-11 + i * 5.5, 3.1 + (i % 2) * 1.4, -15 - (i % 3) * 2]} rotation={[0, i * 0.7, 0]} material={mat(i % 2 ? "#40565a" : "#344950")}>
        <coneGeometry args={[5.8, 8 + (i % 2) * 2, 5]} />
      </mesh>)}
      {/* forest framing the vertical image */}
      {Array.from({ length: 17 }, (_, i) => <Tree key={i} x={-8 + i * 1.02} z={-5 - (i % 4) * 1.3} scale={0.85 + (i % 5) * 0.17} tone={i % 3} />)}
      {Array.from({ length: 9 }, (_, i) => <Tree key={"near" + i} x={-9 + i * 2.25} z={3.8 + (i % 2) * 1.2} scale={1.2 + (i % 3) * 0.2} tone={(i + 1) % 3} />)}
      <Rock position={[-1.8, 0.15, -0.7]} scale={[1.2, 0.65, 0.8]} rotation={0.4} />
      <Rock position={[1.8, 0.08, -1.2]} scale={[0.8, 0.4, 0.6]} rotation={1.2} />
      <Rock position={[-3.1, 0.2, 1.6]} scale={[1.2, 0.8, 0.9]} rotation={0.1} />
      <Rock position={[3.1, 0.25, 0.2]} scale={[1.35, 0.9, 0.9]} rotation={0.7} />
      {/* mossy foreground stones */}
      <mesh position={[-0.95, 0.08, 1.25]} scale={[0.48, 0.1, 0.36]} material={mossMat}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh position={[1.3, 0.07, 1.45]} scale={[0.62, 0.13, 0.4]} material={mossMat}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <Traveller frame={frame} />
      <Fireflies frame={frame} />
      {/* subtle horizon glow */}
      <mesh position={[0, 5.1, -17]}><planeGeometry args={[18, 8]} /><meshBasicMaterial color="#ffb477" transparent opacity={dawn * 0.12} depthWrite={false} /></mesh>
    </>
  );
}

export const CinematicPOC: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#172b39" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [5.8, 3.15, 9.8], fov: 42, near: 0.1, far: 100 }}>
        <MountainScene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const CINEMATIC_POC_CONFIG = { id: "CinematicPOC", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
