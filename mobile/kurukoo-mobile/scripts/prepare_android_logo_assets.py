from pathlib import Path
from PIL import Image

root = Path('assets/images')
source = Image.open(root / 'icon.png').convert('RGBA')
pixels = source.load()
background = pixels[0, 0][:3]
for y in range(source.height):
    for x in range(source.width):
        r, g, b, a = pixels[x, y]
        distance = sum(abs(channel - base) for channel, base in zip((r, g, b), background))
        pixels[x, y] = (r, g, b, 0 if distance < 28 else a)
alpha_bbox = source.getchannel('A').getbbox()
if not alpha_bbox:
    raise RuntimeError('Logo mark has no foreground pixels')
mark = source.crop(alpha_bbox)
mark.thumbnail((560, 560), Image.Resampling.LANCZOS)
foreground = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
foreground.alpha_composite(mark, ((1024 - mark.width) // 2, (1024 - mark.height) // 2))
foreground.save(root / 'android-icon-foreground.png')
monochrome = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
monochrome.putalpha(foreground.getchannel('A'))
monochrome.save(root / 'android-icon-monochrome.png')
print({'source_bbox': alpha_bbox, 'foreground_size': mark.size, 'safe_area_scale': '560px in 1024px adaptive canvas'})
