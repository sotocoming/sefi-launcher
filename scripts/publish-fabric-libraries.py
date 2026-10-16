"""Publish exactly the pinned Fabric Maven files, preserving the current manifest."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time


def publish(root, source, catalog):
    root, source = Path(root).resolve(strict=True), Path(source).resolve(strict=True)
    entries = json.loads(Path(catalog).read_text())
    verified = []
    if len(entries) != 8:
        raise ValueError('Expected eight Fabric libraries')
    for url, entry in entries.items():
        name, sha = entry['name'], entry['sha256']
        if not url.startswith('https://maven.fabricmc.net/') or not re.fullmatch(r'[a-zA-Z0-9_.+\-]+\.jar', name) or not re.fullmatch(r'[a-f0-9]{64}', sha):
            raise ValueError('Invalid catalog entry')
        file = source / name
        if file.is_symlink():
            raise ValueError('Symlink source')
        raw = file.read_bytes()
        if len(raw) != entry['size'] or hashlib.sha256(raw).hexdigest() != sha or hashlib.sha1(raw).hexdigest() != entry['sha1']:
            raise ValueError('Library checksum mismatch: ' + name)
        verified.append((entry, raw))
    with (root / '.fabric-publication.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        manifest_path = root / 'manifest.json'
        previous = manifest_path.read_bytes()
        manifest = json.loads(previous)
        def atomic(path, data):
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                temporary.chmod(0o644)
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
        changed = False
        for entry, raw in verified:
            directory = root / entry['sha256']
            target = directory / entry['name']
            if directory.is_symlink() or target.is_symlink():
                raise ValueError('Symlink destination')
            directory.mkdir(mode=0o755, exist_ok=True)
            if target.exists() and target.read_bytes() != raw:
                raise ValueError('Existing destination differs')
            value = {'name': entry['name'], 'size': len(raw)}
            if manifest.get(entry['sha256']) != value or not target.exists():
                atomic(target, raw)
                manifest[entry['sha256']] = value
                changed = True
        if not changed:
            print('Already published; no changes')
            return
        if manifest_path.read_bytes() != previous:
            raise RuntimeError('Manifest changed concurrently')
        backup = root / ('manifest.before-fabric-libraries-' + str(time.time_ns()) + '.json')
        backup.write_bytes(previous)
        backup.chmod(0o600)
        atomic(manifest_path, json.dumps(manifest, ensure_ascii=False).encode())
        print('Published eight Fabric libraries; entries', len(manifest), 'rollback_manifest', backup)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--catalog', required=True)
    args = parser.parse_args()
    publish(args.root, args.source, args.catalog)
