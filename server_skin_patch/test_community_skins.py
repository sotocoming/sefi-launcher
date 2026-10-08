"""Isolated skin API regression tests; no live users or external requests."""
import base64
import binascii
import struct
import zlib
import tempfile
import unittest
from pathlib import Path
from test_community_security import community, Api, ApiError
from web import community_skins as skins

def png(color=6):
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', binascii.crc32(kind+data)&0xffffffff)
    return skins.SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',64,64,8,color,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+b'\xff'*(64*(4 if color==6 else 3)))*64))+chunk(b'IEND',b'')

class SkinTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        old = community.DB_PATH
        self.addCleanup(setattr, community, 'DB_PATH', old)
        community.DB_PATH = str(Path(self.temp.name)/'community.db')
        community.init_db()
        self.user = community.upsert_twitch_user({'id':'skin-owner','login':'skin_owner'}, '')
        self.other = community.upsert_twitch_user({'id':'skin-other','login':'skin_other'}, '')
        self.api = object.__new__(Api)
        self.body = {'png':base64.b64encode(png()).decode(),'model':'slim'}
    def request(self, method='POST', body=None, user=None):
        user = self.user if user is None else user
        return self.api.handle(method,'/api/public/community/skin',{},self.body if body is None else body,
            {'headers':{'X-Community-Token':user['session_token']}})[0]
    def lookup(self, name=None, identity=None):
        name = name or self.user['mc_nickname']
        return self.api.handle('GET','/api/public/community/skins/'+(identity or skins.offline_uuid(name)),
            {'name':[name]}, {}, {})[0]['skin']
    def test_upload_read_public_reset_and_model(self):
        saved = self.request()['skin']
        self.assertEqual(saved['model'],'slim')
        self.assertEqual(self.request('GET')['skin'], saved)
        self.assertEqual(self.lookup(), saved)
        self.request(body={'reset':True})
        self.assertIsNone(self.lookup())
    def test_ownership_cannot_be_chosen_by_request(self):
        self.request(body={**self.body,'user_id':self.other['id'],'mc_nickname':self.other['mc_nickname']})
        self.assertIsNone(self.lookup(self.other['mc_nickname']))
        self.assertIsNone(self.request('GET',user=self.other)['skin'])
    def test_anonymous_invalid_sessions_forbidden(self):
        for headers in ({},{'X-Community-Token':'bad'}):
            with self.assertRaises(ApiError) as e:
                self.api.handle('POST','/api/public/community/skin',{},self.body,{'headers':headers})
            self.assertEqual(e.exception.code,401)
    def test_linking_license_hides_old_skin_and_blocks_writes(self):
        self.request()
        with community.get_db() as conn:
            conn.execute("UPDATE users SET mc_type='microsoft',mc_verified_at=1,mc_uuid=? WHERE id=?",('01234567-89ab-4def-8123-456789abcdef',self.user['id']))
        self.assertIsNone(self.lookup())
        self.assertIsNone(self.lookup(identity='01234567-89ab-4def-8123-456789abcdef'))
        with self.assertRaises(ApiError) as e: self.request()
        self.assertEqual(e.exception.code,403)
    def test_uuid_case_mismatch_ban_and_rename(self):
        self.request()
        self.assertIsNone(self.lookup(identity='01234567-89ab-4def-8123-456789abcdef'))
        self.assertIsNone(self.lookup(name=self.user['mc_nickname'].upper()))
        with community.get_db() as conn: conn.execute("UPDATE users SET whitelist_status='rejected' WHERE id=?",(self.user['id'],))
        self.assertIsNone(self.lookup())
        with self.assertRaises(ApiError): self.request()
    def test_png_validation_preserves_previous_on_failure(self):
        saved = self.request()['skin']
        for bad in ('not-png',base64.b64encode(png()[:-5]).decode(),'A'*90000,base64.b64encode(png()[:-1]+b'x').decode()):
            with self.assertRaises(ApiError): self.request(body={'png':bad,'model':'classic'})
        with self.assertRaises(ApiError): self.request(body={**self.body,'model':'other'})
        self.assertEqual(self.lookup(),saved)
    def test_png_decompression_bomb_and_bad_filters(self):
        def chunk(kind, data):
            return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)
        head=png()[:33]
        for raw in (b'0'*1000000,(b'\x05'+b'\xff'*256)*64):
            payload=head+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
            with self.assertRaises(skins.SkinError): skins.canonical_png(base64.b64encode(payload).decode())

if __name__ == '__main__': unittest.main()
