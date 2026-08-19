from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/kurukoo-mobile/assets/images')
for name in ['icon.png', 'splash-icon.png', 'favicon.png', 'android-icon-foreground.png']:
    path = root / name
    image = Image.open(path).convert('RGBA')
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    image.save(path, format='PNG', optimize=True, compress_level=9)
    print(name, path.stat().st_size)
