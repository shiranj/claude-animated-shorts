import React from "react";
import { Composition } from "remotion";
import { CinematicPOC, CINEMATIC_POC_CONFIG as C } from "./CinematicPOC";

/** Minimal Remotion root for testing the cinematic starter on its own.
 *  In a real project, copy only the <Composition> into your existing Root.tsx. */
export const RemotionRoot: React.FC = () => (
  <Composition id={C.id} component={CinematicPOC} durationInFrames={C.durationInFrames} fps={C.fps} width={C.width} height={C.height} />
);
