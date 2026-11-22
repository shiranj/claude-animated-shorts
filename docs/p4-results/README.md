# P4 results

Story: **Five Seconds Ahead**, 36 s, 1080 x 1920, 30 fps, H.264 + AAC, two characters, workshop set, four lighting looks. The MP4 is outside the repository: `D:\Video\cinematic-p4\five-seconds-ahead.mp4` (32 MB).

| File | What |
|---|---|
| `p4_story_sheet.jpg`, `p4_*.jpg` | Stills from the final MP4 (frames 40, 150, 234, 290, 360, 470, 562, 650, 720, 820, 1000) |
| `p4_templates_sheet.jpg` | One still from each of the six story templates |
| `qa/` | Automatic QA report, contact sheet, two phone-size sheets |
| `render-report-five-seconds.json` | Render time and memory samples |
| `shot-check-five-seconds.json` | Composition check of the story |

## Measurements (RTX 5060 Ti, `--concurrency 4`, 2K textures, render's own process tree)

| Render | Frames | Time | Peak memory |
|---|---|---|---|
| Five Seconds Ahead (3 renders of the same data over the work) | 1080 | 172, 167, 170 s (0.157 s per frame) | 5.87, 5.87, 5.89 GB |
| Forest demo `StoryDemo` (regression) | 540 | 110 s (P3: 87 s) | 4.2 GB (P3: 4.3 GB) |
| `TwoCharacterTest` (regression) | 180 | 41 s (P3: 33 s) | 6.2 GB (P3: 6.2 GB) |

The two regression renders were slower than in P3. Other programs (a browser, an npm install that ran at the same time as the first attempt) were running; one attempt was lost when Windows changed the network connection and the render browser crashed. It was run again with `--timeout 180000`. Memory is the same as in P3.

Sound: integrated loudness -17.0 LUFS, loudness range 12.3 LU after `produce.mjs mux` (loudnorm target -16).

## Tests

| Test | Result |
|---|---|
| Type-check (scratch project and a fresh `npm install` of the pinned `package.json`: 226 packages) | pass |
| `check-assets.mjs` (including the new CC0 files, with checksums) | All assets found |
| `check-gpu.mjs` | NVIDIA GeForce RTX 5060 Ti, Direct3D 11 |
| Composition check, Five Seconds Ahead | no issues (it found 5 real problems while the story was built) |
| Composition check, 6 templates at 1080 x 1920, and `informative` at 1920 x 1080 | no issues (it found problems in all 6 on the first run; fixed) |
| Video QA, Five Seconds Ahead | no problems; warnings: the planned fade to black (frames 1078 to 1079), the startle jolt (frames 241 to 243), camera speed 4.6 m/s at frame 124 (inside the blend; looked at by eye) |
| Video QA, forest demo and two-character test (regression) | no problems |
| Regression: forest demo frame 300 vs the P3 video | identical; other frames differ by 0.3 to 0.7 of 255 on average (hands changed on purpose) |
| Determinism | see `templates/cinematic/DETERMINISM.md` |
| Bridge scripts | `bridge_merge.py` tested with a fake project and a wrong folder; `bridge-stills.mjs` syntax checked only |
| `produce.mjs` `doctor`, `check`, `stills`, `render`, `audio`, `mux`, `qa`, `spec` | each run once; `audio` gave byte-identical output on a second run |

## Implemented, tested, and not verified

- **Implemented and tested:** everything in the tables above.
- **Implemented, checked by eye only:** faces, hands, expressions, prop interaction, lighting mood, story continuity (contact sheets and phone-size sheets).
- **Not verified:** narration timing against a real voice (the placeholder voice was used; timings were checked against the line lengths of that voice), other GPUs, other PCs, 16:9 rendering (only the composition check ran at 1920 x 1080), the five templates other than `historical` and `informative` as full videos (each was rendered as one still), `bridge-stills.mjs` against a real project.
