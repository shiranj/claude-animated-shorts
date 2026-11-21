#!/usr/bin/env python3
"""Automated checks for a rendered video. Needs ffmpeg and ffprobe on the PATH, plus Python with numpy and Pillow.

Usage:
  python qa-video.py <video.mp4> <out-folder> [--width 1080 --height 1920 --fps 30 --frames N]
                     [--cuts 120,232,284] [--shot-check out/shot-check.json] [--render-report out/render.json]

It writes into <out-folder>: qa-report.md, qa-report.json, contact-sheet.jpg (many frames, small) and mobile-preview.jpg
(frames at a typical phone size, 360x640, to judge character, face, prop and subject/background readability).

What it checks: the file exists and decodes; size, frame rate, frame count; black, white, very dark, very bright and frozen frames;
sudden jumps between frames (cuts you list with --cuts are expected and not reported); and, if you pass the output of check-shots.mjs,
whether the subject leaves the camera view. It cannot judge beauty, expression or clipping: look at the contact sheet and the video.
Exit code 0 = no problems found, 2 = problems found (warnings alone do not change the exit code).
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("out")
ap.add_argument("--width", type=int, default=1080); ap.add_argument("--height", type=int, default=1920); ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--frames", type=int, default=0, help="expected number of frames (0 = do not check)")
ap.add_argument("--cuts", default="", help="comma list of frames where a cut or fade is expected")
ap.add_argument("--fades", default="", help="comma list of frames where a planned fade to black happens (black frames near them are not reported)")
ap.add_argument("--shot-check", default=""); ap.add_argument("--render-report", default="")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
problems, warnings = [], []

# ---- file ----
if not os.path.isfile(a.video) or os.path.getsize(a.video) < 1000:
    print("Missing or empty output file:", a.video); sys.exit(2)
probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", a.video], capture_output=True, text=True).stdout or "{}")
vs = next((s for s in probe.get("streams", []) if s.get("codec_type") == "video"), None)
if not vs: print("No video stream."); sys.exit(2)
num, den = (vs.get("r_frame_rate", "0/1").split("/") + ["1"])[:2]; fps = float(num) / float(den or 1)
nb = int(vs.get("nb_frames") or 0); dur = float(probe["format"].get("duration", 0))
info = {"codec": vs.get("codec_name"), "width": vs["width"], "height": vs["height"], "fps": round(fps, 3), "frames": nb, "duration_s": round(dur, 3), "size_mb": round(os.path.getsize(a.video) / 1048576, 1), "pix_fmt": vs.get("pix_fmt"), "has_audio": any(s.get("codec_type") == "audio" for s in probe["streams"])}
if (vs["width"], vs["height"]) != (a.width, a.height): problems.append(f"Resolution is {vs['width']}x{vs['height']}, expected {a.width}x{a.height}.")
if abs(fps - a.fps) > 0.01: problems.append(f"Frame rate is {fps:.3f}, expected {a.fps}.")
if a.frames and nb and nb != a.frames: problems.append(f"Frame count is {nb}, expected {a.frames}.")
if vs.get("codec_name") != "h264": warnings.append(f"Codec is {vs.get('codec_name')}, not h264.")
dec = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
if dec: problems.append("Decoder reported errors: " + dec.splitlines()[0][:200])

# ---- frames (analysis size 108x192, and phone size 360x640) ----
def read(w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w, 3)
small = read(108, 192).astype(np.float32); n = len(small)
lum = small.mean(axis=(1, 2, 3)); diff = np.abs(small[1:] - small[:-1]).mean(axis=(1, 2, 3))
def runs(mask, label, minlen=1):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j + 1 < len(mask) and mask[j + 1]: j += 1
            if j - i + 1 >= minlen: out.append((i, j))
            i = j + 1
        else: i += 1
    return out
fmt = lambda rs: ", ".join(f"{s}-{e}" if s != e else str(s) for s, e in rs[:8]) + (" ..." if len(rs) > 8 else "")
fades = [int(c) for c in a.fades.split(",") if c.strip()]
planned = lambda f: any(abs(f - c) <= 14 for c in fades)
for name, mask, msg in (("black", lum < 8, "Black frames"), ("white", lum > 247, "White frames")):
    rs = runs(mask, name)
    bad = [(s0, e0) for s0, e0 in rs if not (name == "black" and planned(s0) and planned(e0))]
    if bad: problems.append(f"{msg}: {fmt(bad)}")
    if name == "black" and len(rs) > len(bad): warnings.append(f"Black frames inside the planned fades: {fmt([r for r in rs if r not in bad])} (expected).")
rs = runs((lum >= 8) & (lum < 30), "dark", 15)
if rs: warnings.append(f"Very dark stretches (mean brightness under 30 of 255, 15+ frames): {fmt(rs)}. Check they are meant to be dark.")
rs = runs(lum > 190, "bright", 15)
if rs: warnings.append(f"Very bright stretches (mean over 190, 15+ frames): {fmt(rs)}. Check for overexposure.")
rs = runs(diff < 0.02, "frozen", 4)
if rs: problems.append(f"Frozen frames (4+ identical in a row): {fmt([(s + 1, e + 1) for s, e in rs])}")
cuts = {int(c) for c in a.cuts.split(",") if c.strip()}
med = float(np.median(diff)); thr = max(med * 4.0, 6.0)
jmask = np.array([bool(d > thr) and not any(abs((i + 1) - c) <= 2 for c in cuts) and not planned(i + 1) for i, d in enumerate(diff)])
jr = [(s0 + 1, e0 + 1) for s0, e0 in runs(jmask, "jump")]
if jr: warnings.append(f"Large changes between frames in these ranges: {fmt(jr)} (threshold {thr:.1f}). A fast camera move or a fast action does this; a cut you did not list does too. Check by eye.")
for c in sorted(cuts):
    if 1 <= c <= len(diff) and diff[c - 1] < med: warnings.append(f"A cut was expected at frame {c} but the picture barely changes.")

# ---- composition report from check-shots.mjs ----
if a.shot_check and os.path.isfile(a.shot_check):
    sc = json.load(open(a.shot_check))
    if sc.get("issues"):
        kinds = {}
        for i in sc["issues"]: kinds.setdefault(i["what"], []).append(i["frame"])
        for k, fr in kinds.items(): problems.append(f"Composition: {k} at {len(fr)} frames (first {fr[0]}, last {fr[-1]}).")
    if sc.get("maxCameraStepPerFrame", 0) * a.fps > 3.5: warnings.append(f"Camera moves up to {sc['maxCameraStepPerFrame'] * a.fps:.1f} m/s inside a shot (frame {sc.get('maxCameraStepFrame')}). That may feel fast.")
elif a.shot_check: warnings.append("No shot-check file found; subject-in-view was not checked.")

# ---- contact sheet and phone-size preview ----
phone = read(360, 640); idx = np.linspace(0, len(phone) - 1, 12).astype(int)
def sheet(frames, cols, size, path, labels=True):
    tw, th = size; rows = (len(frames) + cols - 1) // cols
    img = Image.new("RGB", (tw * cols, th * rows)); d = ImageDraw.Draw(img)
    for k, f in enumerate(frames):
        im = Image.fromarray(phone[f]).resize(size, Image.LANCZOS); x, y = (k % cols) * tw, (k // cols) * th
        img.paste(im, (x, y))
        if labels: d.rectangle([x, y, x + 52, y + 12], fill=(0, 0, 0)); d.text((x + 3, y + 1), f"f{f}", fill=(255, 255, 255))
    img.save(path, quality=88)
sheet(list(np.linspace(0, len(phone) - 1, 24).astype(int)), 8, (180, 320), os.path.join(a.out, "contact-sheet.jpg"))
sheet(list(idx[:6]), 6, (360, 640), os.path.join(a.out, "mobile-preview.jpg"))
sheet(list(idx[6:]), 6, (360, 640), os.path.join(a.out, "mobile-preview-2.jpg"))
warnings.append("Manual review needed: open mobile-preview.jpg and mobile-preview-2.jpg (real phone size). Check that the character, the face, the prop and the subject-versus-background separation are readable. This tool does not judge them.")

# ---- report ----
render = json.load(open(a.render_report)) if a.render_report and os.path.isfile(a.render_report) else None
rep = {"video": a.video, "info": info, "frames_analysed": n, "brightness": {"min": round(float(lum.min()), 1), "max": round(float(lum.max()), 1), "mean": round(float(lum.mean()), 1)}, "frame_difference": {"median": round(med, 2), "max": round(float(diff.max()), 2)}, "problems": problems, "warnings": warnings, "render": ({k: v for k, v in render.items() if k != "samples"} if render else None)}
json.dump(rep, open(os.path.join(a.out, "qa-report.json"), "w"), indent=1)
with open(os.path.join(a.out, "qa-report.md"), "w", encoding="utf8") as f:
    f.write(f"# QA report: {os.path.basename(a.video)}\n\n**Result: {'PROBLEMS FOUND' if problems else 'no automatic problems found'}** ({len(problems)} problems, {len(warnings)} warnings)\n\n")
    f.write("## Output\n" + "\n".join(f"- {k}: {v}" for k, v in info.items()) + "\n\n")
    f.write(f"## Picture\n- brightness (0-255): min {rep['brightness']['min']}, mean {rep['brightness']['mean']}, max {rep['brightness']['max']}\n- frame-to-frame change: median {rep['frame_difference']['median']}, max {rep['frame_difference']['max']}\n\n")
    if render: f.write("## Render\n" + "\n".join(f"- {k}: {v}" for k, v in rep["render"].items()) + "\n\n")
    f.write("## Problems\n" + ("\n".join(f"- {p}" for p in problems) if problems else "- none") + "\n\n## Warnings (need a human look)\n" + "\n".join(f"- {w}" for w in warnings) + "\n\n## Pictures\n![contact sheet](contact-sheet.jpg)\n\n![phone size](mobile-preview.jpg)\n\n![phone size 2](mobile-preview-2.jpg)\n")
print(open(os.path.join(a.out, "qa-report.md"), encoding="utf8").read().split("## Pictures")[0])
sys.exit(2 if problems else 0)
