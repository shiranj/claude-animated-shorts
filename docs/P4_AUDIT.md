# P4 audit: architecture and technical debt

Written at the start of P4, before any change. The last column says what P4 did. Facts come from reading the files and running searches over the whole repo.

## 1. What the repository is

| Part | Role | State |
|---|---|---|
| `SKILL.md`, `README.md` | The skill instructions and the front page | Written for the old bridge style. The cinematic part was added on top, in P0 to P3. Long and mixed. |
| `templates/cinematic/` | The current system (P0 to P3): animation, camera, lighting, story runtime, tools | Healthy. 3,400 lines of code. Type-checks. |
| `templates/bridge/` | The old flat-card bridge short | Frozen legacy. Keep. |
| `templates/audio/` | Sound for the bridge short | Tied to the bridge timeline. Not reusable as it is. |
| `templates/scripts/` | Old bridge helper scripts | Two have hardcoded paths. |
| `references/` | Style notes, asset policy, 38 frames and 20 sheets of someone else's videos | The frames and sheets are a publishing risk. |
| `docs/` | The pipeline note and the result images of each phase | Pipeline note is from P0 and partly old. |

## 2. Technical debt found

| # | Finding | Evidence | Action in P4 |
|---|---|---|---|
| 1 | Third-party reference frames in the repo | `references/frames/` (38 jpg) and `references/sheets/` (20 jpg), from videos we do not own. README says "for style study only". | Remove from Git. Keep the written reports. |
| 2 | Hardcoded path in a bridge script | `bridge_merge.py` line 6: `ROOT = os.path.expanduser("your Remotion project")` (a placeholder, so it breaks) | Read the root from an argument or `BRIDGE_ROOT`. |
| 3 | Hardcoded browser path | `bridge-stills.mjs` line 11 (`C:/Program Files/...`), and the composition id `BridgeShort` | Use `CHROME_PATH` and a search list; id and project from arguments or env. |
| 4 | No `.gitattributes` | Every commit prints CRLF/LF warnings on Windows | Add one. |
| 5 | Unused dependency in the cinematic harness | `@react-three/postprocessing` is listed in `templates/cinematic/package.json`, but no cinematic file imports it. `post.tsx` uses `postprocessing` directly. Only the bridge template imports it. | Remove from the harness `package.json`. The bridge project needs it by itself. |
| 6 | Story runtime tied to the forest | `story.tsx` always draws `ForestEnvironment`, and the canvas size is fixed at 1080 x 1920 | Add an `environment` choice and `width`/`height` to `StoryConfig`. Keep the forest as the default. |
| 7 | The new-story workflow is not one path | Steps are spread over README, ANIMATION.md, CINEMATIC.md and SKILL.md | One entry tool `produce.mjs`, one `WORKFLOW.md`, a shorter `SKILL.md`. |
| 8 | Docs and code disagree in places | `SKILL.md` still tells the reader to use `Opus max` verifiers, `~/bridge-short/` and a user-specific "just do it" rule. `README.md` lists `references/frames`. The cinematic README says "one character, one location, one shot" in one place. | Rewrite `SKILL.md`. Fix README. Move the bridge details to `references/LEGACY_BRIDGE.md`. |
| 9 | Two copies of the same check idea | `check-shots.mjs` (composition) and `qa-video.py` (pixels) are separate on purpose, but the QA report does not say which one found what. | Keep both. `produce.mjs qa` runs both and prints one summary. |
| 10 | Obsolete audio | `templates/audio/*` mirrors the bridge timeline. Nothing generic exists for a new story. | Add a small generic sound tool (`templates/audio/story_sound.py`). Leave the bridge files alone. |
| 11 | Pixel noise between renders is unexplained | P3 found 5 pixels in 2.07 M that differ | Investigate and document (Phase D-A). |
| 12 | Open hand looks like a claw | Lantern shot, free right hand | Add a configurable hand pose (Phase D-B). |
| 13 | QA checks only heads and feet | `check-shots.ts` | Add prop visibility and subject positioning (Phase D-C). |

## 3. Documented but not implemented

- A real dissolve between shots (documented as not implemented in P3).
- Depth of field (listed as not done).
- Hardware NVENC encoding (documented as not adopted).

These are stated honestly in the docs already. P4 does not add them (no new features).

## 4. Implemented but not documented well

- `StoryConfig` options (`keepClear`, `world`, `post`, `endFade`, `shadowSize`) are described in code comments only.
- `ActorSpec.visible` for actors that enter the shot.
- `produce`-style order of commands (only in SKILL.md prose).

P4 puts these in `templates/cinematic/CINEMATIC.md` and `WORKFLOW.md`.

## 5. Dead or duplicate code

Checked every file in `templates/cinematic` for imports.

- `CinematicPOC.tsx` and `AnimationDemo.tsx`: used only by `Root.tsx`. They are the P0/P1 and P2 demos. **Kept** as regression tests (they still render).
- `demoScript.ts`: used by `AnimationDemo.tsx`. Kept.
- `render-stills.mjs`, `check-*.mjs`, `downscale-textures.py`: tools. Kept.
- No file was found that nothing uses and that has no purpose. Nothing is deleted except the reference frames (item 1).

## 6. Dependencies

Pinned set (unchanged in P4): Remotion 4.0.250, three 0.160.1, @react-three/fiber 8.15.19, postprocessing 6.34.3, React 18.3.1, TypeScript 5.5.4. No new package is needed for P4. Python tools use numpy, Pillow and ffmpeg, which were already needed. The sound tool will use numpy only (and scipy if it is present).


## 7. Status at the end of P4

| # | Finding | Result |
|---|---|---|
| 1 | Third-party reference frames | **Removed** from the working tree (`references/frames`, `references/sheets`). They are still in the Git history of earlier commits (nothing was pushed). Rewriting history needs your approval. |
| 2, 3 | Hardcoded bridge paths | **Fixed**: `--root` / `BRIDGE_ROOT`, `CHROME_PATH`, `BRIDGE_COMP`. Tested with a fake project folder and a wrong folder. The bridge template itself was not touched. The scripts were not run against a real bridge project. |
| 4 | `.gitattributes` | **Added and tested**: no CRLF warnings for tracked file types; warnings remain only for files written by Windows tools (Python text mode) and disappear on the next normalisation. |
| 5 | Unused dependency | **Removed** from the harness `package.json`. Clean install tested: 226 packages, type-check passes. |
| 6 | Forest hard-wired | **Fixed**: `environment`, `width`, `height`, `appear`. The forest is still the default; the old demos render the same. |
| 7 | No single path | **Done**: `produce.mjs`, `docs/WORKFLOW.md`, `docs/SETUP_WINDOWS.md`, new `SKILL.md`. |
| 8 | Docs disagree | **Fixed**: `SKILL.md` and `README.md` rewritten; bridge details moved unchanged to `references/LEGACY_BRIDGE.md`; the P0 pipeline note marked as historical. |
| 9 | Two QA tools | Kept. `produce.mjs qa` and `check` are the documented order. |
| 10 | No generic sound | **Added** `templates/audio/story_sound.py` (numpy only) and `narration_sapi.ps1`. |
| 11 | Pixel noise | **Investigated**: see `templates/cinematic/DETERMINISM.md`. Cause is rare GPU noise, amplified by the H.264 encoder. Not fully traced inside the driver. |
| 12 | Claw hand | **Fixed**: per-joint finger shape, new poses, `hand` script action. Checked on a render of the same frame. |
| 13 | QA gaps | **Added**: watched props, camera speed limit (failure), face size, subject low or far to the side (warnings), multi-range `visible`, aspect ratio. The checker found real problems in the new story and in all six templates while they were written. |

Not done and not planned in P4: real dissolve, depth of field, hardware encoding, history rewrite, other skeletons, automatic clipping detection.
