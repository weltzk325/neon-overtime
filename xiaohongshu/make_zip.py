#!/usr/bin/env python3
"""Package only the standalone H5 runtime, without any development dependencies."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'package'
OUTPUT = ROOT / 'neon-overtime-xhs-tool.zip'
ALLOWED = {'.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'}


def main():
    files = sorted(path for path in SOURCE.rglob('*') if path.is_file())
    if not files or not (SOURCE / 'index.html').is_file():
        raise ValueError('package/index.html is required')
    if [p.relative_to(SOURCE).as_posix() for p in files if p.suffix == '.html'] != ['index.html']:
        raise ValueError('Exactly one root index.html is required')
    for path in files:
        if path.is_symlink() or path.suffix.lower() not in ALLOWED:
            raise ValueError('Unsupported file: ' + str(path))
    with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for path in files:
            package.write(path, path.relative_to(SOURCE).as_posix())
    with zipfile.ZipFile(OUTPUT) as package:
        if package.testzip() is not None:
            raise ValueError('ZIP integrity check failed')
    if OUTPUT.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('ZIP exceeds the documented 10 MiB limit')
    print(OUTPUT)
    print(f'{len(files)} files; {OUTPUT.stat().st_size:,} bytes')
    print('SHA256 ' + hashlib.sha256(OUTPUT.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
