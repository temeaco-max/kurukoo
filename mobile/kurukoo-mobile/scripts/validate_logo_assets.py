from pathlib import Path
from PIL import Image
import hashlib

root = Path('assets/images')
full_square = ['icon.png', 'splash-icon.png', 'favicon.png', 'kurukoo-logo.png']
hashes = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in full_square}
assert len(set(hashes.values())) == 1, hashes
foreground = Image.open(root / 'android-icon-foreground.png').convert('RGBA')
monochrome = Image.open(root / 'android-icon-monochrome.png').convert('RGBA')
assert foreground.size == (1024, 1024)
assert monochrome.size == (1024, 1024)
assert foreground.getchannel('A').getbbox() == (282, 232, 741, 792)
assert monochrome.getchannel('A').getbbox() == (282, 232, 741, 792)
assert monochrome.getchannel('A').tobytes() == foreground.getchannel('A').tobytes()
print('logo validation: passed')
print('full-square authority:', next(iter(hashes.values())))
print('android foreground alpha bbox:', foreground.getchannel('A').getbbox())
