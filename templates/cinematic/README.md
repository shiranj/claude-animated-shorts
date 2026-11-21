# Cinematic starter: animated adult character in a forest trail

A 10-second, 1080x1920, 30 fps vertical shot. It proves the cinematic pipeline end to end: a rigged, animated GLB character with adult proportions, a layered environment, motivated lighting, a tracking camera, and a deterministic Remotion render.

The scene is only an **example**. The reusable parts are `AnimatedCharacter.tsx`, `footLock.ts`, `useAsset.ts`, `Lantern.ts`, `Backpack.ts` and `ForestEnvironment.tsx`; the story lives in `CinematicPOC.tsx`.

## Files

| File | Purpose |
|---|---|
| `CinematicPOC.tsx` | The example shot: timeline, camera, lights, composition. Edit this for a new shot. |
| `AnimatedCharacter.tsx` | Reusable. Plays GLB clips from the Remotion frame number, with blending, bone attachments, and extra parts (head, hair) re-bound to the same skeleton. |
| `footLock.ts` | Reusable. Works out how far the character walks from its own animation, so planted feet do not slide. |
| `useAsset.ts` | Loads GLB, textures and HDR files and pauses the render until they are ready. Missing files do not crash. |
| `Lantern.ts`, `Backpack.ts` | Procedural props (hand lantern with a light, traveller's backpack). |
| `ForestEnvironment.tsx` | Reusable trail environment: trees, rocks, grass, ferns, flowers, path, light shafts, dust, HDRI lighting. |
| `ASSETS.md` | **Read first.** Where to get the free assets and where to put them. |
| `asset-manifest.json`, `ASSET_CREDITS.md` | Source, creator, licence and checksum of every external asset. |
| `check-assets.mjs` | Tells you which asset files are missing or damaged. |
| `downscale-textures.py` | Optional: shrink the 4K character textures to save render memory. |
| `render-stills.mjs` | Renders still frames of any composition for quick review. |
| `index.ts`, `Root.tsx`, `tsconfig.json`, `package.json` | Minimal Remotion test setup. This is not a full app. |

## Quick start

1. **Get the assets** (free, about 70 MB after unzipping): follow [ASSETS.md](ASSETS.md). They go in `public/cinematic/` and are not stored in this repository.
2. **Use a Remotion project that already works.** Tested versions: Remotion 4.0.250, three 0.160.1, @react-three/fiber 8.15.19, React 18.3.1, TypeScript 5.5.4, plus `@types/three` 0.160.0. Copy this folder into the project (for example `src/cinematic/`) and put `public/cinematic/` in the project's `public/` folder. In a new folder, `npm install` uses the pinned `package.json`.
3. **Check:**
   ```bash
   node check-assets.mjs        # assets present and unchanged?
   npx tsc -p tsconfig.json     # types ok?
   ```
4. **Preview stills** (about 5 s each at full size):
   ```bash
   node render-stills.mjs index.ts CinematicPOC out/p_ 0,75,150,225,299 1
   ```
   Set `CHROME_PATH` if Chrome is not found, and `REMOTION_TMP` to a folder on a big drive (each bundle copies `public/`).
5. **Render the 10-second MP4:**
   ```bash
   npx remotion render index.ts CinematicPOC out/cinematic-poc.mp4 --gl=angle --codec h264 --crf 18
   ```
   To use it in your own project, copy the `<Composition>` from `Root.tsx` into your `Root.tsx`.

**Memory:** with the original 4K textures the render used about 10 GB more than an idle PC. After `python downscale-textures.py <copy of public/cinematic/characters> 2048` it used about 6 GB more, with no visible difference (see Measured results). Do this on a copy; the script rewrites files in place.

## How the animation is driven by Remotion

- Everything is a function of `useCurrentFrame()`. Nothing uses the wall clock, `useFrame`, or state that carries over between frames.
- Pose: `AnimationMixer.setTime(frame / fps)` resets all actions to time 0 and applies the time, so the pose never accumulates. Walk and idle are blended by weights computed from the frame.
- Travel: `footLock.ts` builds a table (one entry per frame) from the same clips and weights. In each frame the character advances as far as its planted feet move backward, so a planted foot stays still in the world, and when the walk blends into the idle the travel slows by itself. The table is built once from the clips and is a pure function of them. The camera follows a smoothed copy of it.
- Camera, lights and dawn are pure functions of the frame. Scenery uses fixed random seeds.

## Measured results (development PC, Windows 11, Chrome with ANGLE/GPU)

| Check | P1 (chibi KayKit, simple trees) | P1.1 (this version) |
|---|---|---|
| Type-check | pass | pass |
| Still, full size | about 3 s | about 5 s |
| Full 300-frame MP4 | 40 s, 32.8 MB | 48.6 s, 32.7 MB (4K textures); 45.1 s (2K textures) |
| Peak memory above idle (Node + Chrome) | about 3 GB | about 10 GB (4K textures); about 6 GB (2K textures) |
| Frame QA (`short_qa.py`) | clean | clean: no black, white, frozen or jumping frames |
| Foot drift of a planted foot, walking | median 0.11 m/s | median 0.000 m/s (p90 0.05) |
| Foot drift during walk-to-idle blend | not measured | median 0.008 m/s, max 0.21 m/s |
| Foot drift when standing | not measured | exactly 0 |

- Foot drift was measured in Node on the skeleton, using the same travel table as the render. It was not measured on the rendered video.
- Determinism: frame 150 rendered alone equals frame 150 rendered after frames 0 to 149 in order (0 pixels differ in repeated runs). One earlier comparison showed a single pixel differing by 1 of 255; repeats were exact, so this was GPU noise and not accumulated state.
- 4K versus 2K textures: frame 225 differs by a mean of 1.5 of 255 (99th percentile 8); face and clothing look the same.
- Other machines will differ. 2K video output and long videos were not tested.

## Known limitations

- The head and the outfit come from two Quaternius kits. The free base kit has only "Superhero" bodies, so we use only its head; the head and the outfit hands use two different "Dark" skin textures, which are close but not identical. Hair colour is a tint on a grey texture.
- No facial animation (the eyes do not blink or look around), no cloth or cape physics, no ambient-occlusion pass. The hood puts the face in soft shadow.
- The hands are closed fists in the walk clip, so the lantern hangs from a fist. The backpack and its straps are approximate; the straps can read as loops behind the hood from some angles.
- Trees, rocks, grass, flowers and logs are generated shapes with smooth shading and colour variation. They are much softer than P1 but are not scanned assets (the free scanned trees are hundreds of MB).
- Memory use is high with the 4K textures (see above).
- No audio, music or narration. The MP4 has Remotion's silent audio track.
- One character, one location and one shot. Tested only with the package versions above and on Windows.

## If an asset is missing

The shot still renders. A missing character shows a red placeholder figure, a missing ground texture falls back to flat colours, and the browser console names the missing file. If only the head files are missing, the code is written to render the character with an empty hood (not tested). Run `node check-assets.mjs`.
