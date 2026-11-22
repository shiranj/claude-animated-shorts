# Determinism: what is guaranteed and what is not

Short answer: **the animation is deterministic; the pixels are almost, but not always, bit-identical.** Do not promise pixel-perfect output.

## What was measured (P4, RTX 5060 Ti, ANGLE / Direct3D 11, StoryDemo, 2K textures)

| Test | Result |
|---|---|
| Frame 300 rendered alone, twice (fresh browser each time) | identical |
| Frame 300 alone vs after frames 299, 290–299, 0–299 in the same tab | identical |
| Same, with 4 tabs, and while another full render used the GPU | identical |
| Frames 250–300, three runs (PNG) | 2 runs identical; the 3rd differed in 2 frames: 4 and 1 pixels, by 1 level of 255 |
| Frames 250–330 as JPEG files, two runs | identical bytes |
| Same 41 JPEG frames encoded by ffmpeg x264 four times (pipe and files, any thread count) | identical video |
| `renderMedia` H.264, same range, repeated | different file each time; 33 of 81 frames differ, mean 0.1–0.35 of 255 |
| `renderMedia` ProRes (no motion prediction), same range, twice | 1 frame of 81 differs: 38 pixels, by at most 2 levels |
| P3, earlier test | 5 of 2.07 million pixels differed by up to 27 levels in one small area |

## Cause

| Suspect | Verdict |
|---|---|
| Animation evaluation | **Not the cause.** Every value is a function of the frame number. Rendering a frame after any history gives the same result in the large majority of runs. |
| Texture loading | **Unlikely.** The renderer waits for all assets before each frame. Differences were not tied to the first frames of a run. Not fully excluded. |
| Post-processing | **Not the cause.** It is off by default and was off in all tests. |
| Shader precision / GPU | **Most likely.** Rare differences of 1–2 levels (very rarely larger) in a few pixels, which appear in single runs of the same frame. Typical sources are floating point order in rasterisation, multisampling and shadow-map filtering on the graphics driver. The exact place inside the driver was not found. |
| Video encoder | **Amplifies it.** x264 is deterministic on identical frames. But one changed pixel changes its prediction and rate-control choices for the frames after it, so the final H.264 files differ in many frames, by very small amounts. |

## Practical impact

- Nobody can see the difference. Mean difference between two full H.264 renders: 0.27 of 255 per pixel (P3 measurement).
- Two renders of the same story are **not bit-identical files**. Compare them with a tolerance (QA does), never with a file hash.
- A scene is stable: same camera, same pose, same light for a given frame, on the same machine and driver.
- Not tested: other GPUs, other drivers, other operating systems. Different hardware can give different low-level pixels. Expect small changes there.

## Check it yourself

`node check-determinism.mjs index.ts StoryDemo 250-300 3 --public-dir public`
