# Optional: shrink the large character textures to save memory while rendering (each render tab decodes its own copy).
# Usage: python downscale-textures.py <folder-with-png-files> [max-size=2048]
# Files are rewritten IN PLACE, so run it on a copy of your public/ folder if you want to keep the full-size originals.
import sys, glob, os
from PIL import Image

folder = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 2048
changed = 0
for path in glob.glob(os.path.join(folder, "**", "*.png"), recursive=True):
    im = Image.open(path)
    if max(im.size) <= limit:
        continue
    im.load()
    scale = limit / max(im.size)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(path, optimize=True)
    changed += 1
    print(f"{path}: now {im.size}")
print(f"{changed} file(s) resized to at most {limit}px")
