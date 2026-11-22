# Production workflow: from a story idea to a finished video

One path for every story. Each step names the thing you make, the command that checks it, and how you know it is done. Run the commands from your project folder (see `SETUP_WINDOWS.md`). Everything is deterministic: a frame depends only on its frame number.

| # | Step | You make | Command | Done when |
|---|---|---|---|---|
| 1 | Story idea | One sentence: who wants what, and what stops them | none | The sentence has a person, a goal and a problem |
| 2 | Script | Narration lines with start times (`audio.json`) and the length in seconds (15 to 40 for a Short) | `node produce.mjs spec <template>` prints a starting file | Each line is short; there are pauses |
| 3 | Storyboard | A shot list: for each beat the shot size, the camera move, the light and the narration it covers | none (write it as a table) | Every beat has one picture and one reason |
| 4 | Characters and assets | Choose the cast and the place from the kit (section "The kit" in `templates/cinematic/story-templates/README.md`) | `node check-assets.mjs` | Assets found, licences listed |
| 5 | Scene | A template or a story data file: cast, scripts, points, shots, lighting | `node produce.mjs check template:<name>` or `... check stories/<data>.ts` | No composition issues |
| 6 | Animation | `CharacterScript`s: walk, turn, look, emotion, startle, point, reach, wave, carry, hand | `node produce.mjs stills index.ts <Comp> 40,150,300 0.5` | Faces and hands read at phone size |
| 7 | Camera and light | Shots (presets and moves), lighting keys | `check` again, then `stills` at the first and last frame of each shot | Subject in frame, light motivated |
| 8 | Sound | `audio.json` (narration placeholders, beds, cues) | `node produce.mjs audio audio.json out\audio` | `out\audio\mix.wav` exists |
| 9 | Render | The silent video | `node produce.mjs render index.ts <Comp> out\video.mp4` | The report says `ok: true` and the GPU is NVIDIA |
| 10 | Mux | Video plus sound | `node produce.mjs mux out\video.mp4 out\audio\mix.wav out\final.mp4` | One file with an audio track |
| 11 | QA | Report, contact sheet, phone-size sheets | `node produce.mjs qa out\final.mp4 out\qa --frames <N> --cuts <list> --fades <list> --shot-check out\shot-check.json --render-report out\video.mp4.report.json` | No problems; every warning looked at; sheets inspected by eye |
| 12 | Deliver | The MP4, the stills, the QA report, the project files, the asset credits | none | The user has the files and `ASSET_CREDITS.md` |

## A complete example (the P4 story)

```powershell
node produce.mjs doctor
node produce.mjs check stories\fiveSecondsData.ts
node produce.mjs stills index.ts FiveSeconds 40,150,230,360,560,700,820 0.5
node produce.mjs audio stories\fiveSecondsAudio.json out\audio
node produce.mjs render index.ts FiveSeconds out\five-seconds-silent.mp4
node produce.mjs mux out\five-seconds-silent.mp4 out\audio\mix.wav out\five-seconds-ahead.mp4
node produce.mjs qa out\five-seconds-ahead.mp4 out\qa --frames 1080 --cuts 205,262,322,420,530,600,668,684,770 --fades 1050,1080 --shot-check out\shot-check.json --render-report out\five-seconds-silent.mp4.report.json
```

Placeholders: the narration is read by a free Windows voice. To use a real voice, record each line, save it as `out\audio\voice\n1.wav`, `n2.wav`, ... and run only the `story_sound.py` step again (see `templates/audio/story_sound.py`), then `mux`.

## Rules that save time

- Check before you render. `check` takes seconds. A render takes minutes.
- Render stills of the first and last frame of every shot before the full video.
- Never change timing between preview and final. Only quality settings may change.
- Fix composition and light first. Add post effects last (they are off by default).
- If a check fails, change the shot or the script. Do not widen the check.
