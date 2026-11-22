import React from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { StoryCanvas, type StoryConfig } from "../story";
import { peasantActor } from "../actors";
import { Clock } from "../environments";
import { FPS, FRAMES, LIGHTING_KEYS, MANTEL, MARA, SHARD_COUNT, SHOTS, TOM, mantelAt, shardAt, targets, watchGlow } from "./fiveSecondsData";

/* "Five Seconds Ahead": the scene. The story is plain data in fiveSecondsData.ts; this file only adds the two actors and the clock that falls. */

const shardMat = new THREE.MeshStandardMaterial({ color: "#d8c9a0", roughness: 0.5, metalness: 0.4 });
const caseMat = new THREE.MeshStandardMaterial({ color: "#6b4529", roughness: 0.6 });

const MantelClock: React.FC<{ frame: number }> = ({ frame }) => {
  const m = mantelAt(frame);
  return (
    <>
      <group position={m.pos} rotation={[m.tiltX, 0, m.tiltZ]}>
        <mesh castShadow material={caseMat}><boxGeometry args={[0.3, 0.3, 0.14]} /></mesh>
        <Clock position={[0, 0.01, 0.075]} radius={0.115} minute={frame * 0.02} />
        {m.whole ? null : <mesh position={[0, 0, 0.09]}><planeGeometry args={[0.2, 0.01]} /><meshBasicMaterial color="#000" /></mesh>}
      </group>
      {Array.from({ length: SHARD_COUNT }, (_, i) => {
        const s = shardAt(i, frame);
        return s ? <mesh key={i} position={s.pos} rotation={s.rot} castShadow material={shardMat}><boxGeometry args={[0.05 + (i % 3) * 0.02, 0.012, 0.04]} /></mesh> : null;
      })}
    </>
  );
};

export const FIVE_SECONDS: StoryConfig = {
  fps: FPS, frames: FRAMES, environment: "workshop",
  actors: [
    peasantActor({ id: "tom", script: TOM, gender: "male", hair: "Hair_SimpleParted", hairTint: "#4a3322", watchGlow }),
    peasantActor({ id: "mara", script: MARA, gender: "female", hair: "Hair_Long", hairTint: "#2c1b12", appear: [270, FRAMES] }),
  ],
  targets, shots: SHOTS, lighting: LIGHTING_KEYS, endFade: 30, shadowSize: 2048,
  world: ({ frame }) => <MantelClock frame={frame} />,
};
void MANTEL;

export const FiveSeconds: React.FC = () => <StoryCanvas cfg={FIVE_SECONDS} frame={useCurrentFrame()} />;
export const FIVE_SECONDS_CONFIG = { id: "FiveSeconds", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
