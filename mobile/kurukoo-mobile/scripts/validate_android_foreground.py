from pathlib import Path
from PIL import Image, ImageDraw
root = Path('assets/images')
background = Image.open(root/'android-icon-background.png').convert('RGBA').resize((400,400))
foreground = Image.open(root/'android-icon-foreground.png').convert('RGBA').resize((400,400), Image.Resampling.LANCZOS)
background.alpha_composite(foreground)
mask = Image.new('L', (400,400), 0); ImageDraw.Draw(mask).ellipse((0,0,399,399), fill=255)
masked = background.copy(); masked.putalpha(mask)
draw = ImageDraw.Draw(masked); draw.ellipse((68,68,332,332), outline='#2E8060', width=3); draw.rectangle((68,68,332,332), outline='#2E8060', width=2)
mono = Image.open(root/'android-icon-monochrome.png').convert('RGBA').resize((400,400), Image.Resampling.LANCZOS); mono.putalpha(Image.open(root/'android-icon-monochrome.png').getchannel('A').resize((400,400), Image.Resampling.LANCZOS))
sheet = Image.new('RGB',(820,440),'#E6DED5'); sheet.paste(masked.convert('RGB'),(10,20)); sheet.paste(mono.convert('RGB'),(410,20)); d=ImageDraw.Draw(sheet); d.text((18,405),'Android adaptive masked',fill='#24221F'); d.text((418,405),'Android monochrome alpha',fill='#24221F'); sheet.save('/home/ubuntu/screenshots/kurukoo-logo-android-final.png')
print('/home/ubuntu/screenshots/kurukoo-logo-android-final.png')
