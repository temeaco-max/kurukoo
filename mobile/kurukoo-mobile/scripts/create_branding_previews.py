from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

mobile = Path('/home/ubuntu/kurukoo-mobile/assets/images')
web = Path('/home/ubuntu/kurukoo-website/client/public/kurukoo-logo.png')
out = Path('/home/ubuntu/screenshots')
out.mkdir(parents=True, exist_ok=True)

def font(size):
    for candidate in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

cream = '#F7F2EC'; ink = '#24221F'; border = '#E6DED5'; accent = '#B95D3C'
icon = Image.open(mobile/'splash-icon.png').convert('RGBA')
# Splash device preview: portrait frame with contain-centered splash mark.
splash = Image.new('RGB', (720, 1280), cream)
mark = icon.copy(); mark.thumbnail((280, 280), Image.Resampling.LANCZOS)
splash_rgba = Image.new('RGBA', splash.size, cream); splash_rgba.alpha_composite(mark, ((720-mark.width)//2, (1280-mark.height)//2-40))
d = ImageDraw.Draw(splash_rgba); d.text((245, 920), 'Kurukoo', font=font(36), fill=ink); d.text((205, 974), 'Mobile splash screen', font=font(22), fill='#6D665F')
splash_rgba.save(out/'kurukoo-mobile-splash-preview.png')
# Web branding preview: favicon, header shell, and assistant message mark.
page = Image.new('RGB', (1100, 600), cream); d = ImageDraw.Draw(page)
d.rectangle((0,0,1100,76), fill='#FFFFFF', outline=border)
logo = Image.open(web).convert('RGBA')
for size, xy in [(34,(30,21)), (18,(180,31))]:
    resized = logo.copy(); resized.thumbnail((size,size), Image.Resampling.LANCZOS); page.paste(resized, xy, resized)
d.text((76, 27), 'Kurukoo', font=font(26), fill=ink); d.text((210, 31), 'Chat', font=font(20), fill='#6D665F')
d.rounded_rectangle((28, 136, 870, 430), radius=18, fill='#FFFFFF', outline=border, width=2)
small = logo.copy(); small.thumbnail((22,22), Image.Resampling.LANCZOS); page.paste(small, (48, 162), small)
d.text((86, 160), 'Kurukoo', font=font(18), fill=accent); d.text((48, 214), 'Welcome to Kurukoo.', font=font(26), fill=ink); d.text((48, 270), "I'm your AI agent, here to help you get things done.", font=font(22), fill=ink)
d.rounded_rectangle((932, 22, 1070, 160), radius=22, fill='#FFFFFF', outline=border, width=2)
fav = logo.copy(); fav.thumbnail((80,80), Image.Resampling.LANCZOS); page.paste(fav, (961, 49), fav)
d.text((28, 510), 'Web header / Chat mark and favicon use the same Kurukoo logo source.', font=font(20), fill='#6D665F')
page.save(out/'kurukoo-web-branding-preview.png')
print(out/'kurukoo-mobile-splash-preview.png')
print(out/'kurukoo-web-branding-preview.png')
