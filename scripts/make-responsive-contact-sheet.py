from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

source = Path(sys.argv[1])
output = Path(sys.argv[2])
files = sorted(source.glob('*.png'), key=lambda item: int(item.stem.rsplit('-', 1)[-1]))
thumb_width, thumb_height, label_height, columns = 300, 500, 28, 2
rows = (len(files) + columns - 1) // columns
sheet = Image.new('RGB', (columns * thumb_width, rows * (thumb_height + label_height)), 'white')
draw = ImageDraw.Draw(sheet)
for index, file in enumerate(files):
    image = Image.open(file).convert('RGB')
    image.thumbnail((thumb_width, thumb_height))
    x = (index % columns) * thumb_width + (thumb_width - image.width) // 2
    y = (index // columns) * (thumb_height + label_height)
    sheet.paste(image, (x, y))
    draw.text((x + 8, y + thumb_height + 7), file.stem, fill='black')
sheet.save(output)
print(output)
