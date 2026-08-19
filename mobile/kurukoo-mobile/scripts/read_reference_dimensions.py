from pathlib import Path
from PIL import Image

for raw in ("/home/ubuntu/Kurukoo-develop/docs/design/authoritative-assets/pasted_file_3meWAy_image.webp", "/home/ubuntu/Kurukoo-develop/docs/design/authoritative-assets/pasted_file_lZf52W_image.webp"):
    path = Path(raw)
    with Image.open(path) as image:
        print(f"{path.name}: {image.size[0]}x{image.size[1]}")
