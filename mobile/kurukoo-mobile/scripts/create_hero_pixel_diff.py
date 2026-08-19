from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageOps

reference_path = Path('/home/ubuntu/Kurukoo-develop/docs/design/authoritative-assets/pasted_file_3meWAy_image.webp')
implementation_path = Path('/home/ubuntu/screenshots/webdev-preview-root-1787122269525242111-2055.png')
out_dir = Path('/home/ubuntu/screenshots/hero-diff-2048-hero-crop')
out_dir.mkdir(parents=True, exist_ok=True)
size = (2048, 1152)

reference_source = Image.open(reference_path).convert('RGB')
implementation_source = Image.open(implementation_path).convert('RGB')
reference = reference_source.crop((0, 0, 1024, 576)).resize(size, Image.Resampling.LANCZOS)
implementation = implementation_source.crop((0, 0, 1440, 810)).resize(size, Image.Resampling.LANCZOS)
reference.save(out_dir / 'reference-normalized.png')
implementation.save(out_dir / 'implementation-normalized.png')

blend = Image.blend(reference, implementation, 0.5)
blend.save(out_dir / 'overlay-50.png')
diff = ImageChops.difference(reference, implementation)
diff = ImageEnhance.Contrast(diff).enhance(4.0)
diff.save(out_dir / 'pixel-diff-amplified.png')
heat = ImageOps.grayscale(diff).convert('RGB')
heat.save(out_dir / 'pixel-diff-grayscale.png')

hist = ImageChops.difference(reference, implementation).histogram()
mean_abs = sum(index * value for index, value in enumerate(hist)) / max(1, sum(hist))
print(f'reference={reference_path.name} crop=(0,0,1024,576) source_size={reference_source.size} normalized={size}')
print(f'implementation={implementation_path.name} crop=(0,0,1440,810) source_size={implementation_source.size} normalized={size}')
print(f'mean_channel_difference={mean_abs:.4f}')
for path in sorted(out_dir.iterdir()):
    print(path)
