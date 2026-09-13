from pathlib import Path

repo = Path('/home/ubuntu/kurukoo-git')
replacement = '/assets/brand/logo-icon.png'
external = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663712619985/mFhtTSVkfJaqmuhJ.png'
changed = []

for root in [repo / 'views', repo / 'frontend/public']:
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in {'.ejs', '.html', '.css', '.js', '.svg'}:
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        new = text.replace(external, replacement)
        # Legacy static shells used a literal K in the brand slot. Replace
        # only the known brand spans, never arbitrary content text.
        new = new.replace('<span class="k-mark" aria-hidden="true">K</span>', '<img class="k-mark" src="/assets/brand/logo-icon.png" alt="" aria-hidden="true" width="24" height="24">')
        new = new.replace('<span class="k-mark">K</span>', '<img class="k-mark" src="/assets/brand/logo-icon.png" alt="" aria-hidden="true" width="24" height="24">')
        if new != text:
            path.write_text(new)
            changed.append(str(path.relative_to(repo)))

partial = repo / 'views/_partials/brand-mark.ejs'
partial.write_text('<img class="brand-mark" src="/assets/brand/logo-icon.png" alt="" aria-hidden="true" width="28" height="28">\n')
changed.append(str(partial.relative_to(repo)))
print('\n'.join(changed))
print(f'changed={len(set(changed))}')
