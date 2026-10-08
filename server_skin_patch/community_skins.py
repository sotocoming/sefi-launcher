"""Shared skins: authenticated ownership, live identity checks, bounded canonical PNGs."""
import base64
import binascii
import hashlib
import re
import struct
import uuid
import zlib
from web import community

MAX_PNG = 65536
SIGNATURE = b"\x89PNG\r\n\x1a\n"

class SkinError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def offline_uuid(name):
    return str(uuid.UUID(bytes=hashlib.md5(('OfflinePlayer:' + name).encode()).digest(), version=3))

def canonical_png(encoded):
    if not isinstance(encoded, str) or len(encoded) > (MAX_PNG + 2) // 3 * 4:
        raise SkinError('PNG должен быть не больше 64 КБ.')
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_PNG or not raw.startswith(SIGNATURE):
            raise ValueError()
        offset, header, pixels, ended = 8, None, bytearray(), False
        while offset < len(raw):
            size = struct.unpack_from('>I', raw, offset)[0]
            kind = raw[offset+4:offset+8]
            data = raw[offset+8:offset+8+size]
            crc = struct.unpack_from('>I', raw, offset+8+size)[0]
            if binascii.crc32(kind + data) & 0xffffffff != crc:
                raise ValueError()
            if header is None and kind != b'IHDR': raise ValueError()
            if kind == b'IHDR':
                if header is not None or size != 13: raise ValueError()
                width, height, depth, color, comp, filt, interlace = struct.unpack('>IIBBBBB', data)
                if (width, height, depth, comp, filt, interlace) != (64, 64, 8, 0, 0, 0) or color not in (2, 6):
                    raise SkinError('Нужен PNG 64 × 64 с обычными RGB/RGBA цветами.')
                header = data
            elif kind == b'IDAT': pixels.extend(data)
            elif kind == b'IEND':
                if size or offset+12 != len(raw): raise ValueError()
                ended = True
                break
            elif kind in (b'acTL', b'fcTL', b'fdAT') or kind[:1].isupper(): raise ValueError()
            offset += size + 12
        if not ended or not pixels: raise ValueError()
        stride = 1 + 64 * (4 if color == 6 else 3)
        decoder = zlib.decompressobj()
        decoded = decoder.decompress(bytes(pixels), stride*64 + 1)
        if len(decoded) != stride*64 or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
            raise ValueError()
        if any(decoded[row*stride] > 4 for row in range(64)): raise ValueError()
        def chunk(kind, data):
            return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', binascii.crc32(kind+data) & 0xffffffff)
        return SIGNATURE + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(decoded)) + chunk(b'IEND', b'')
    except SkinError: raise
    except (ValueError, struct.error, zlib.error, binascii.Error):
        raise SkinError('Файл повреждён или не является поддерживаемым PNG.') from None

def _table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS community_skins (user_id INTEGER PRIMARY KEY, png BLOB NOT NULL, model TEXT NOT NULL)")

def _eligible(user):
    if not user: raise SkinError('Войдите в SEFI Community.', 401)
    if user.get('mc_type') != 'offline' or user.get('mc_verified_at') or user.get('mc_uuid'):
        raise SkinError('Скин лицензии меняется на Minecraft.net.', 403)
    if user.get('whitelist_status') == 'rejected': raise SkinError('Доступ к сообществу отклонён.', 403)
    if not re.fullmatch(r'[A-Za-z0-9_]{3,16}', user.get('mc_nickname') or ''):
        raise SkinError('Сначала активируйте игровой профиль SEFI.', 409)

def _result(row):
    return None if row is None else {'png': base64.b64encode(row['png']).decode(), 'model': row['model'],
        'sha256': hashlib.sha256(row['png']).hexdigest()}

def own(user, body=None):
    # Serialize with license linking; never trust nickname, UUID or type from the request.
    with community.ACCESS_LOCK, community.get_db() as conn:
        current = conn.execute('SELECT * FROM users WHERE id=?', (user['id'],)).fetchone() if user else None
        _eligible(dict(current) if current else None)
        _table(conn)
        if body is not None:
            if body.get('reset') is True:
                conn.execute('DELETE FROM community_skins WHERE user_id=?', (current['id'],))
            else:
                if body.get('model') not in ('classic', 'slim'): raise SkinError('Выберите модель: обычная или тонкая.')
                png = canonical_png(body.get('png'))
                conn.execute('INSERT INTO community_skins VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET png=excluded.png,model=excluded.model',
                             (current['id'], png, body['model']))
        return {'skin': _result(conn.execute('SELECT * FROM community_skins WHERE user_id=?', (current['id'],)).fetchone())}

def public(identity, name):
    try: identity = str(uuid.UUID(identity))
    except (ValueError, TypeError): raise SkinError('Неверный UUID.') from None
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_]{3,16}', name): raise SkinError('Неверный ник.')
    if identity != offline_uuid(name): return {'skin': None}
    with community.ACCESS_LOCK, community.get_db() as conn:
        _table(conn)
        row = conn.execute("SELECT s.png,s.model,u.* FROM community_skins s JOIN users u ON u.id=s.user_id WHERE u.mc_nickname=? COLLATE NOCASE", (name,)).fetchone()
        if row is None: return {'skin': None}
        try: _eligible(dict(row))
        except SkinError: return {'skin': None}
        # Case is significant for offline UUIDs; do not alias identities by nickname alone.
        return {'skin': _result(row) if offline_uuid(row['mc_nickname']) == identity else None}
