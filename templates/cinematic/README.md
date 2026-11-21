# Cinematic starter: animated character in a forest trail

A 10-second, 1080x1920, 30 fps vertical shot. It proves the cinematic pipeline end to end: a rigged, animated GLB character, a layered environment, motivated lighting, a tracking camera, and a deterministic Remotion render.

The scene is only an **example**. The reusable parts are `AnimatedCharacter.tsx`, `useAsset.ts` and `ForestEnvironment.tsx`; the story lives in `CinematicPOC.tsx`.

## Files

| File | Purpose |
|---|---|
| `CinematicPOC.tsx` | The example shot: timeline, camera, lights, composition. Edit this for a new shot. |
| `AnimatedCharacter.tsx` | Reusable. Plays GLB animation clips from the Remotion frame number, with blending and bone attachments. |
| `ForestEnvironment.tsx` | Reusable trail environment: trees, rocks, grass, path, light shafts, dust, HDRI lighting. |
| `useAsset.ts` | Loads GLB, textures and HDR files and pauses the render until they are ready. Missing files do not crash. |
| `ASSETS.md` | **Read first.** Where to get the free assets and where to put them. |
| `asset-manifest.json`, `ASSET_CREDITS.md` | Source, creator, licence and checksum of every external asset. |
| `check-assets.mjs` | Tells you which asset files are missing or damaged. |
| `render-stills.mjs` | Renders still frames of any composition for quick review. |
| `index.ts`, `Root.tsx`, `tsconfig.json`, `package.json` | Minimal Remotion test setup. This is not a full app. |

## Quick start

1. **Get the assets** (free, about 15 MB to download): follow [ASSETS.md](ASSETS.md). They go in `public/cinematic/` and are not stored in this repository.
2. **Use a Remotion project that already works.** Required versions (tested): Remotion 4.0.250, three 0.160.1, @react-three/fiber 8.15.19, React 18.3.1, TypeScript 5.5.4, plus `@types/three` 0.160.0. Copy this folder into the project (for example `src/cinematic/`) and put `public/cinematic/` in the project's `public/` folder. In a new folder, `npm install` uses the pinned `package.json`.
3. **Check:**
   ```bash
   node check-assets.mjs        # assets present?
   npx tsc -p tsconfig.json     # types ok?
   ```
4. **Preview stills** (about 3 s each at half size):
   ```bash
   node render-stills.mjs index.ts CinematicPOC out/poc_ 0,75,150,225,299 0.5
   ```
   Set `CHROME_PATH` if Chrome is not found, and `REMOTION_TMP` to a folder on a big drive (each bundle copies `public/`).
5. **Render the 10-second MP4:**
   ```bash
   npx remotion render index.ts CinematicPOC out/cinematic-poc.mp4 --gl=angle --codec h264 --crf 18
   ```
   To use it in your own project, copy the `<Composition>` from `Root.tsx` into your `Root.tsx`.

## How the animation is driven by Remotion

- Everything is a function of `useCurrentFrame()`. Nothing uses the wall clock, `useFrame`, or state that carries over between frames.
- Character pose: `AnimationMixer.setTime(frame / fps)` resets all actions to time 0 and applies the time, so the pose never accumulates. Two clips (walk, idle) are blended by weights that are computed from the frame.
- Position along the path is summed from frame 0 every time, camera and light are pure functions of the frame, and scenery uses fixed random seeds.
- Verified: frame 150 rendered on its own is pixel-identical to frame 150 rendered after frames 0 to 149 in order.

## Measured on the development PC (Windows 11, Chrome with ANGLE/GPU)

- Type-check: passes, no errors.
- Stills: about 3 s each at half size.
- Full 300-frame MP4 at 1080x1920: **40 s** to render, 32.8 MB (h264, crf 18).
- Peak memory: about **3 GB** above the idle level for Node and Chrome together.
- Frame QA (`templates/scripts/short_qa.py`): no black, white, frozen or jumping frames.

Other machines will differ. 2K renders and longer videos were not tested.

## Known limitations

- The character is a stylized chibi low-poly figure (KayKit Ranger, about 8,900 triangles, one gradient texture). It is much better than primitive shapes, but it is not feature-film quality. Most of the cinematic feel comes from light, fog, depth and camera.
- Walking speed is set from the measured stance-foot speed of the `Walking_A` clip, but residual foot drift was measured in Node on the skeleton only (frames 0 to 185): a planted foot still moves at a median of about 0.11 units/s (character speed 0.45, height 1.6), and a different speed between 0.40 and 0.50 does not make it clearly better. It was not checked in the final video. Watch the feet, especially during the slow-down (frames 185 to 225).
- No facial animation, lip-sync, cloth simulation or ambient occlusion pass. Soft contact is faked with a shadow disc and a shadow-casting sun.
- Trees, rocks, grass and the lantern are simple generated shapes, not scanned assets. Heavy photoscanned trees (hundreds of MB) are not practical here.
- No audio, music or narration in this shot. The MP4 has Remotion's silent audio track.
- Only one character, one location and one shot have been built.
- Tested only with the package versions above and on Windows.

## If an asset is missing

The shot still renders. A missing character shows a red placeholder figure, a missing ground texture falls back to flat colours, and the browser console names the missing file. Run `node check-assets.mjs`.
