import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { BloomEffect, EffectComposer, EffectPass, NormalPass, RenderPass, SSAOEffect, ToneMappingEffect, ToneMappingMode, BlendFunction } from "postprocessing";

/* ------------------------------------------------------------------------------------------------
 * Optional post-processing, built on the `postprocessing` package that is already a dependency (no new install).
 * It is OFF by default. See README (P3) for the measured cost and the visual comparison: use it only where it earns its cost.
 * The scene is rendered into a half-float buffer, effects are applied, and ACES tone mapping is done as the last step, so the
 * colours match the normal pipeline (which tone-maps in the renderer).
 * ---------------------------------------------------------------------------------------------- */

export type PostSettings = {
  /** Bloom strength (0 = off). Around 0.25 is subtle: only the brightest lights (lantern, crystal) glow. */
  bloom?: number;
  /** Luminance above which bloom starts, 0..1. Higher = fewer things glow. */
  bloomThreshold?: number;
  /** Screen-space ambient occlusion strength (0 = off). Needs an extra normal pass: costs more than bloom. */
  ssao?: number;
  exposure?: number;
};

export const PostFX: React.FC<{ settings: PostSettings }> = ({ settings }) => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), camera = useThree((s) => s.camera), size = useThree((s) => s.size);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    c.addPass(new RenderPass(scene, camera));
    const effects = [];
    if (settings.ssao) {
      c.addPass(new NormalPass(scene, camera));
      effects.push(new SSAOEffect(camera, (c.passes[1] as NormalPass).texture, { blendFunction: BlendFunction.MULTIPLY, samples: 12, rings: 5, distanceScaling: true, radius: 0.04, intensity: 6 * settings.ssao, bias: 0.03, fade: 0.04, luminanceInfluence: 0.6, worldDistanceThreshold: 18, worldDistanceFalloff: 6, worldProximityThreshold: 0.6, worldProximityFalloff: 0.3 }));
    }
    if (settings.bloom) effects.push(new BloomEffect({ intensity: settings.bloom, luminanceThreshold: settings.bloomThreshold ?? 0.8, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.7 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    c.addPass(new EffectPass(camera, ...effects));
    return c;
  }, [gl, scene, camera, settings.bloom, settings.bloomThreshold, settings.ssao]);
  useEffect(() => { composer.setSize(size.width, size.height, false); }, [composer, size]);
  useEffect(() => { const prev = gl.toneMapping; gl.toneMapping = THREE.NoToneMapping; return () => { gl.toneMapping = prev; composer.dispose(); }; }, [gl, composer]);
  useFrame((_, delta) => composer.render(delta), 1); // priority 1: take over rendering from the default render call
  return null;
};
