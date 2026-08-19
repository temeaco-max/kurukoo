from pathlib import Path
from PIL import Image
for path in sorted(Path('/home/ubuntu/screenshots').glob('webdev-preview-root-*.png'), key=lambda p: p.stat().st_mtime, reverse=True)[:12]:
    with Image.open(path) as image:
        print(path.name, image.size)
