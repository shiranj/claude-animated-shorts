# Cinematic proof of concept — The Lantern at Dawn

A 10-second, 1080x1920 vertical scene to validate the new cinematic stylized-3D direction.

## What the shot tests

- A custom stylized 3D traveller with layered clothing, belt, satchel, face details and a lantern.
- A layered mountain / pine-forest environment with foreground rocks and distant silhouettes.
- A slow camera push with a slight change in framing.
- A gradual dawn lighting transition and a motivated lantern glow.
- Deterministic frame-based animation at 30 fps.

The character and environment in this first technical proof of concept are procedural Three.js geometry. This keeps the test fully free and self-contained. They are **prototype assets**, not the final quality ceiling. The next iteration should replace the hero character and selected environment elements with polished, licence-verified free GLB assets or custom Blender models.

## Standalone test setup (P0)

This folder now contains a minimal test harness: `index.ts`, `Root.tsx`, `tsconfig.json`, `package.json` (pinned versions) and `render-stills.mjs`. It does not turn the repository into an app. Use it one of two ways:

1. **In an existing Remotion project** (recommended): copy this folder into `src/`, or copy `CinematicPOC.tsx` and register the composition as shown below. Then run `node render-stills.mjs index.ts CinematicPOC out/poc_ 0,150,299 0.5` from the folder that has `node_modules`.
2. **Fresh folder**: copy this folder somewhere, run `npm install`, then `npm run typecheck` and `npm run still`.

Optional environment variables for `render-stills.mjs`: `CHROME_PATH`, `REMOTION_TMP`, `REMOTION_PUBLIC`.

Verified (P0): type-check passes and stills render with Remotion 4.0.250, three 0.160.1, R3F 8.15.19. See `docs/p0-results/` for before and after stills.

## Integration

This file is designed to be copied into the user's Remotion project. It relies on the existing skill stack:

- Remotion
- `@remotion/three`
- `three`
- `@react-three/fiber`
- React

Copy `CinematicPOC.tsx` into your Remotion source tree. Then register the composition in `src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { CinematicPOC, CINEMATIC_POC_CONFIG } from "./CinematicPOC";

// Inside your existing Remotion root:
<Composition
  id={CINEMATIC_POC_CONFIG.id}
  component={CinematicPOC}
  durationInFrames={CINEMATIC_POC_CONFIG.durationInFrames}
  fps={CINEMATIC_POC_CONFIG.fps}
  width={CINEMATIC_POC_CONFIG.width}
  height={CINEMATIC_POC_CONFIG.height}
/>
```

Render:

```bash
npx remotion render src/index.ts CinematicPOC out/cinematic-poc.mp4 --codec h264 --crf 18
```

Render representative stills at frames 0, 90, 180 and 299 before judging the full video. Check both full-frame and phone-size readability.

## Known limitations in this first pass

- It is a visual-system prototype, not a finished short with narration and sound.
- The traveller is assembled from procedural meshes; facial animation, hand articulation and cloth simulation are not included.
- The distant mountain silhouettes and trees are deliberately simplified.
- No external assets are downloaded. The next pass should test a CC0 character and environment asset, with its licence captured in the manifest.
- The source repository is a skill/template repository rather than the user's complete Remotion app, so the final render must be run in the local Remotion project where the dependencies and Remotion root are installed.
