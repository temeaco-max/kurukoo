from pathlib import Path
from PIL import Image, ImageDraw
root = Path('assets/images')
icon = Image.open(root/'icon.png').convert('RGBA')
# iOS/Expo splash uses contain: keep the square mark centered inside a 200x200 image box.
splash = Image.new('RGBA', (400, 400), '#F7F2EC')
contained = icon.copy(); contained.thumbnail((200, 200), Image.Resampling.LANCZOS)
splash.alpha_composite(contained, ((400-contained.width)//2, (400-contained.height)//2))
# Android adaptive icon safe-area preview: a circular mask over the full asset, plus 66% safe-area guide.
adaptive = icon.resize((400, 400), Image.Resampling.LANCZOS)
mask = Image.new('L', (400, 400), 0); ImageDraw.Draw(mask).ellipse((0,0,399,399), fill=255)
adaptive.putalpha(mask)
preview = adaptive.convert('RGBA'); draw = ImageDraw.Draw(preview)
draw.ellipse((68,68,332,332), outline='#2E8060', width=3)
draw.rectangle((68,68,332,332), outline='#2E8060', width=2)
# side-by-side review sheet.
sheet = Image.new('RGB', (820, 440), '#E6DED5'); sheet.paste(splash.convert('RGB'), (10, 20)); sheet.paste(preview.convert('RGB'), (410, 20));
d = ImageDraw.Draw(sheet); d.text((18, 405), 'iOS splash contain', fill='#24221F'); d.text((418, 405), 'Android adaptive circular + safe area', fill='#24221F')
sheet.save('/home/ubuntu/screenshots/kurukoo-logo-platform-crops.png')
print({'source_size': icon.size, 'splash_preview': '/home/ubuntu/screenshots/kurukoo-logo-platform-crops.png', 'adaptive_safe_area': '66% centered guide'})
