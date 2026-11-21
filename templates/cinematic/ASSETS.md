# Assets for the cinematic starter

The repository does **not** contain the 3D character, animations, textures or HDRI. They are free (CC0), but they are binary files, so you download them yourself and put them in your Remotion project's `public/` folder. Exact sources, creators, licences and checksums are in `asset-manifest.json`. Credits are in `ASSET_CREDITS.md`.

If a file is missing, nothing crashes: the scene shows a red placeholder figure (character) or flat colours (ground), and the browser console prints which file is missing.

## Folder layout

```
public/cinematic/
  characters/Ranger.glb
  animations/Rig_Medium_General.glb
  animations/Rig_Medium_MovementBasic.glb
  polyhaven/forrest_ground_03_diff_1k.jpg
  polyhaven/forrest_ground_03_nor_gl_1k.jpg
  polyhaven/forrest_ground_03_rough_1k.jpg
  polyhaven/spruit_dawn_1k.hdr
```

## 1. Character and animations (KayKit Adventurers 2.0, CC0)

1. Open https://kaylousberg.itch.io/kaykit-adventurers and click **Download Now**. The pack is "name your own price"; the free file is called **Free 2.0** (about 12 MB).
2. Unzip it. Copy these three files:
   - `Characters/gltf/Ranger.glb` into `public/cinematic/characters/`
   - `Animations/gltf/Rig_Medium/Rig_Medium_General.glb` into `public/cinematic/animations/`
   - `Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb` into `public/cinematic/animations/`
3. Keep the zip's `License.txt` next to your project notes. It says CC0: free for personal, educational and commercial use; credit "Kay Lousberg, www.kaylousberg.com" is optional.

## 2. Ground texture and HDRI (Poly Haven, CC0)

Pages: https://polyhaven.com/a/forrest_ground_03 and https://polyhaven.com/a/spruit_dawn. From a terminal inside your project (Git Bash, macOS or Linux; on Windows PowerShell use `curl.exe`):

```bash
mkdir -p public/cinematic/polyhaven && cd public/cinematic/polyhaven
B=https://dl.polyhaven.org/file/ph-assets
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_diff_1k.jpg
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_nor_gl_1k.jpg
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_rough_1k.jpg
curl -L -O $B/HDRIs/hdr/1k/spruit_dawn_1k.hdr
```

## 3. Check everything

From the folder that contains `public/`:

```bash
node check-assets.mjs
```

It lists each file as `OK` or `MISSING`, and compares the Poly Haven files with their recorded MD5 checksums.

## Using a different character

The scene needs a skinned character and clips that use the same bone names. Any KayKit `Rig_Medium` character (Knight, Mage, Rogue, Rogue_Hooded, Barbarian) works with the same animation files: change `ASSET_PATHS.character` in `useAsset.ts`. Other rigs need animation files made for that rig. Before using any new asset, verify its licence on the source page and add it to `asset-manifest.json`.
