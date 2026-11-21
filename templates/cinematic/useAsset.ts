import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { continueRender, delayRender, staticFile } from "remotion";

/** Asset files live in the Remotion project's `public/` folder (see ASSETS.md). Paths are relative to `public/`. */
export const ASSET_PATHS = {
  character: "cinematic/characters/Ranger.glb",
  animations: ["cinematic/animations/Rig_Medium_General.glb", "cinematic/animations/Rig_Medium_MovementBasic.glb"],
  groundDiffuse: "cinematic/polyhaven/forrest_ground_03_diff_1k.jpg",
  groundNormal: "cinematic/polyhaven/forrest_ground_03_nor_gl_1k.jpg",
  groundRough: "cinematic/polyhaven/forrest_ground_03_rough_1k.jpg",
  hdri: "cinematic/polyhaven/spruit_dawn_1k.hdr",
} as const;

export type AssetState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const cache = new Map<string, Promise<unknown>>();

/**
 * Load an asset and hold the Remotion render until it is ready (delayRender / continueRender).
 * A missing file never crashes the render: the state becomes `error` and the caller shows a fallback.
 */
export function useAsset<T>(key: string, load: () => Promise<T>): AssetState<T> {
  const [handle] = useState(() => delayRender(`Loading ${key}`, { timeoutInMilliseconds: 60000 }));
  const [state, setState] = useState<AssetState<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    let promise = cache.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = load();
      cache.set(key, promise);
    }
    promise
      .then(
        (data) => { if (alive) setState({ status: "ready", data }); },
        (err: unknown) => {
          cache.delete(key);
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[cinematic] Could not load "${key}". Is it in your public/ folder? See templates/cinematic/ASSETS.md. (${message})`);
          if (alive) setState({ status: "error", message });
        },
      )
      .finally(() => continueRender(handle));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export const loadGltf = (path: string): Promise<GLTF> => new GLTFLoader().loadAsync(staticFile(path));

export const loadTexture = (path: string, srgb: boolean): Promise<THREE.Texture> =>
  new THREE.TextureLoader().loadAsync(staticFile(path)).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  });

export const loadHdr = (path: string): Promise<THREE.DataTexture> =>
  new RGBELoader().loadAsync(staticFile(path)).then((t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
