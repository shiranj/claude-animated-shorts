# Setup on Windows (step by step)

This guide takes you from nothing to your first rendered short. All commands are for **PowerShell**. Nothing here costs money.

Tested on: Windows 11, Node 22.19, Python 3.12, ffmpeg 2025-12-31, Chrome (current), NVIDIA GeForce RTX 5060 Ti with 8 GB, 32 GB RAM. Other setups should work but are not tested.

## 1. Software you need

| Tool | Version | Check with | Get it |
|---|---|---|---|
| Node.js | 18 to 22 (22 tested) | `node --version` | https://nodejs.org (LTS) |
| Python | 3.10 or newer (3.12 tested) | `python --version` | https://www.python.org (tick "Add to PATH") |
| ffmpeg | any recent build | `ffmpeg -version` | https://www.gyan.dev/ffmpeg/builds/ ("essentials"), then add its `bin` folder to PATH |
| Google Chrome | current | open it once | https://www.google.com/chrome/ (Remotion can download its own browser, but Chrome makes the GPU check simple) |
| A graphics card | NVIDIA, AMD or similar | `node produce.mjs doctor` | The render must use the **discrete** card, not the Intel one (step 6) |

Python packages (once):

```powershell
python -m pip install numpy pillow
```

No other Python packages are needed. The sound tool uses only numpy.

## 2. Make a project folder

This repository is the skill and the templates. It is not a Remotion app. Copy the cinematic folder into a new project:

```powershell
mkdir D:\Video\my-short
Copy-Item -Recurse <path to this repo>\templates\cinematic\* D:\Video\my-short\
cd D:\Video\my-short
npm install
```

`package.json` pins the versions that were tested: Remotion 4.0.250, three 0.160.1, @react-three/fiber 8.15.19, postprocessing 6.34.3, React 18.3.1, TypeScript 5.5.4. Do not upgrade them casually: a newer three.js changes lighting.

If PowerShell says "running scripts is disabled", you do not need to change the system. The tools here are run with `node` and `python`, which are not affected. Only the narration script is a `.ps1` file; `produce.mjs audio` starts it with a one-time bypass for that single run.

## 3. Download the free assets (not stored in this repository)

All characters come from Quaternius packs under CC0 (public domain). Poly Haven files are CC0 too. Follow `templates/cinematic/ASSETS.md`: it lists each pack, the exact files, and where to put them under `public/cinematic/`. The files are about 400 MB in total, so they are not in Git.

Check them (this also checks checksums):

```powershell
node check-assets.mjs
```

It must end with `All assets found`. Optional files (second character, villagers) are marked `optional-missing` and do not stop anything unless you use them. The licence of each file is in `ASSET_CREDITS.md` and `asset-manifest.json`.

## 4. Make the textures 2K (default)

The downloaded character textures are 4K. Each render tab loads its own copy, so 4K needs a lot of memory. Make 2K copies once:

```powershell
python downscale-textures.py public\cinematic\characters\quaternius 2048
```

It rewrites those PNG files in place. If you want to keep the 4K originals, copy `public` first and use the copy for 4K stills.

## 5. Check everything

```powershell
node produce.mjs doctor
```

It prints the Node, Python and ffmpeg versions, whether `public/` exists, the asset check, and the GPU check. Fix anything it marks `MISSING` or `WARNING`.

## 6. Make sure the graphics card is the NVIDIA one

```powershell
node check-gpu.mjs
```

You want to see a line like `WebGL renderer: ANGLE (NVIDIA ... GeForce RTX ... Direct3D11)` and `OK: a discrete graphics card is used.` If it says Intel, open Windows Settings, System, Display, Graphics, add `chrome.exe`, choose Options, and select High performance. Run the check again. The measured render (`render-measured.mjs`) runs this check first and will not start on an integrated card, unless you add `--allow-integrated`.

## 7. First render

Review stills first. They take about 3 seconds each:

```powershell
node produce.mjs stills index.ts StoryDemo 10,200,400 0.5
```

The images are in `out\`. Then the full video of the forest demo (18 s, about 90 seconds on the tested PC):

```powershell
node produce.mjs render index.ts StoryDemo out\story.mp4
```

This uses `--concurrency 4` and writes `out\story.mp4.report.json` (time and peak memory) and `out\story.mp4.log` (browser warnings).

## 8. Quality check

```powershell
node produce.mjs qa out\story.mp4 out\qa --frames 540
```

Open `out\qa\qa-report.md`, `contact-sheet.jpg` and the two `mobile-preview` images. The tool finds black, white, frozen and jumping frames and wrong size, speed or codec. It cannot judge faces, hands or beauty: look at the phone-size sheets yourself.

## 9. Common problems

| Problem | What to do |
|---|---|
| `check-assets` says MISSING | A file is not where `ASSETS.md` says, or it is damaged (checksum). Download it again. |
| Red figure instead of a character | The character files did not load. The browser log in `out\*.log` names the file. |
| "Discrete GPU not used" | Step 6. |
| Windows stalls or freezes during a render | Close other heavy programs (games, browsers with many tabs). Use `--concurrency 2`. Run `node check-gpu.mjs` first. One stall happened once on the tested PC and its cause was not found. Use `--timeout 180000` so a stuck frame stops with an error instead of hanging. |
| Out of memory | Use `--concurrency 2` (3 GB instead of 4.3 GB) and 2K textures. More tabs did not make renders faster. |
| Disk full while bundling | Remotion copies `public/` into the temp folder every time. Set a folder on a big drive: `$env:REMOTION_TMP = "D:\remotion-tmp"`. |
| `python` is not found | Install Python with "Add to PATH" ticked, or use `py`. Open a new PowerShell window. |
| `ffmpeg` is not found | Add the folder with `ffmpeg.exe` to PATH. Open a new PowerShell window. |
| First render downloads something | Remotion downloads its own headless browser once if it cannot find Chrome. Set `CHROME_PATH` to your `chrome.exe` to avoid it. |
| Two renders are not byte-identical | Normal. See `templates/cinematic/DETERMINISM.md`. |
| Git shows CRLF/LF warnings | The repository has a `.gitattributes` file. Pull the latest version. |
