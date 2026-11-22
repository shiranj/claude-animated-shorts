# Merge the four look sandboxes back into the main bridge folder, by owned files.
# Backs up main first (backup/bridge_<time>/), copies each sandbox's owned files, reports which owned files are
# missing or unchanged. Usage: python scripts/bridge_merge.py [cam,world,char,post]
# The Remotion project folder is the current folder, or the BRIDGE_ROOT environment variable, or --root <folder>.
import os, shutil, sys, time, filecmp

args = sys.argv[1:]
if "--root" in args:
    i = args.index("--root")
    root_arg = args[i + 1]
    del args[i:i + 2]
else:
    root_arg = None
ROOT = os.path.abspath(root_arg or os.environ.get("BRIDGE_ROOT") or os.getcwd())
if not os.path.isdir(os.path.join(ROOT, "src/videos/bridge")):
    sys.exit("Not a Remotion project with src/videos/bridge: " + ROOT + chr(10) + "Run from the project folder, set BRIDGE_ROOT, or pass --root <folder>.")
MAIN = os.path.join(ROOT, "src/videos/bridge")
OWN = {  # round 2 ownership (round 1: world also owned paint/build, post owned grade)
    "cam": ["story.ts"],
    "world": ["world.ts", "lights.ts", "shade.ts", "grade.ts"],
    "mat": ["paint.ts", "build.ts"],
    "char": ["toon.ts", "cast.ts", "cardshade.ts"],
    "post": ["ink.ts", "Bridge.tsx", "lensblur.ts"],
}
which = args[0].split(",") if args else list(OWN)
bak = os.path.join(ROOT, "backup", time.strftime("bridge_%Y%m%d_%H%M%S"))
shutil.copytree(MAIN, bak)
print("backup ->", bak)
for box in which:
    src = os.path.join(ROOT, f"src/videos/bridge_{box}")
    for f in OWN[box]:
        a, b = os.path.join(src, f), os.path.join(MAIN, f)
        if not os.path.exists(a):
            print(f"  {box}: {f} not in sandbox (skipped)")
            continue
        if os.path.exists(b) and filecmp.cmp(a, b, shallow=False):
            print(f"  {box}: {f} unchanged")
            continue
        shutil.copy2(a, b)
        print(f"  {box}: {f} -> main")
