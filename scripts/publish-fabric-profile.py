"""Add the pinned Fabric profile to the existing mirror without removing mod entries."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time

SHA = '64304099b29c771cd5a18e349c460122ce27f4ec08fb22efd5f04ace053eebcf'
NAME = 'fabric-loader-0.18.4-1.20.1.json'

def publish(root, source):
    import fcntl
    root = Path(root).resolve(strict=True)
    raw = Path(source).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError('Fabric profile checksum mismatch')
    profile = json.loads(raw)
    if profile['id'] != 'fabric-loader-0.18.4-1.20.1' or profile['inheritsFrom'] != '1.20.1':
        raise ValueError('Fabric profile version mismatch')
    with (root / '.fabric-publication.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        manifest_path = root / 'manifest.json'
        previous = manifest_path.read_bytes()
        manifest = json.loads(previous)
        if not isinstance(manifest, dict):
            raise ValueError('Invalid existing manifest')
        directory = root / SHA
        if directory.is_symlink():
            raise ValueError('Symlink directory')
        directory.mkdir(mode=0o755, exist_ok=True)
        target = directory / NAME
        if target.is_symlink():
            raise ValueError('Symlink file')
        if target.exists() and target.read_bytes() != raw:
            raise ValueError('Existing profile differs')
        def atomic(path, data):
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
                temp = Path(stream.name)
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                temp.chmod(0o644)
                os.replace(temp, path)
            finally:
                temp.unlink(missing_ok=True)
        entry = {'name': NAME, 'size': len(raw)}
        if manifest.get(SHA) == entry and target.exists():
            print('Already published; no changes')
            return
        backup = root / ('manifest.before-fabric-' + str(time.time_ns()) + '.json')
        # The existing mirror serves only allowlisted hash/name pairs, never this backup.
        backup.write_bytes(previous)
        backup.chmod(0o600)
        atomic(target, raw)
        manifest[SHA] = entry
        if manifest_path.read_bytes() != previous:
            raise RuntimeError('Manifest changed concurrently; retry after coordinating deployment')
        atomic(manifest_path, json.dumps(manifest, ensure_ascii=False).encode())
        print('Published', NAME, SHA, 'entries', len(manifest), 'rollback_manifest', backup)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    publish(args.root, args.source)
