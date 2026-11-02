import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("sync", pathlib.Path(__file__).with_name("sync.py"))
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)
HOST = "mc.sotocoming.ru"
IP1 = "77.90.13.212"
IP2 = "77.90.6.250"
CONFIG = {
    "source": "https://raw.githubusercontent.com/sotocoming/sefi-launcher/master/fallback-endpoints.json",
    "targets": [{"container": "homestead", "hosts": [HOST], "probe_host": HOST, "probe_path": "/health"}],
}


class FakeDocker:
    def __init__(self):
        self.container = "a" * 64
        self.hosts = "127.0.0.1 localhost\n::1 localhost ip6-localhost\n10.0.0.1 other.local\n"
        self.writes = []
        self.probes = []
        self.fail_candidate = False
        self.fail_normal = False
        self.concurrent = False
        self.reads = 0

    def identify(self, name):
        return self.container

    def read(self, container):
        self.reads += 1
        if self.concurrent and self.reads == 2:
            self.hosts += "# external edit\n"
        return self.hosts

    def write(self, container, content):
        self.writes.append(content)
        self.hosts = content

    def probe(self, container, host, path, ip=None):
        self.probes.append(ip)
        if ip is not None and self.fail_candidate or ip is None and self.fail_normal:
            raise RuntimeError("API unavailable")


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state = pathlib.Path(self.temp.name)
        self.docker = FakeDocker()

    def tearDown(self):
        self.temp.cleanup()

    def run_sync(self, ip=IP1, fetcher=None):
        return sync.run_sync(CONFIG, self.state, self.docker, fetcher or (lambda _: {HOST: ip, "ignored.example": "not an IP"}))

    def test_remote_change_cache_outage_and_recreated_container(self):
        original = self.docker.hosts
        first = self.run_sync()
        self.assertTrue(first["targets"][0]["changed"])
        self.assertIn(IP1 + " " + HOST, self.docker.hosts)
        self.assertTrue(self.docker.hosts.startswith(original))
        count = len(self.docker.writes)
        self.assertFalse(self.run_sync()["targets"][0]["changed"])
        self.assertEqual(len(self.docker.writes), count)
        self.run_sync(IP2)
        self.assertIn(IP2 + " " + HOST, self.docker.hosts)
        self.assertNotIn(IP1, self.docker.hosts)
        self.assertEqual(self.docker.hosts.count(sync.BEGIN), 1)
        def unavailable(_):
            raise OSError("offline")
        cached = self.run_sync(fetcher=unavailable)
        self.assertEqual(cached["mode"], "cache")
        self.assertIn(IP2, self.docker.hosts)
        self.docker.container = "b" * 64
        self.docker.hosts = original
        self.assertTrue(self.run_sync(fetcher=unavailable)["targets"][0]["changed"])
        self.assertIn(IP2, self.docker.hosts)
        self.assertEqual(json.loads((self.state / "status.json").read_text())["targets"][0]["id"], "b" * 64)

    def test_bad_remote_uses_last_good_cache(self):
        self.run_sync()
        for data in [{HOST: "1.2.3.999"}, {HOST: "1.2.3.4\nMAP *"}, {}, []]:
            report = self.run_sync(fetcher=lambda _, data=data: data)
            self.assertEqual(report["mode"], "cache")
            self.assertIn(IP1, self.docker.hosts)

    def test_unreachable_new_address_keeps_active_routes_and_cache(self):
        self.run_sync()
        before = self.docker.hosts
        self.docker.fail_candidate = True
        with self.assertRaises(RuntimeError):
            self.run_sync(IP2)
        self.assertEqual(before, self.docker.hosts)
        self.assertEqual(json.loads((self.state / "endpoints.json").read_text()), {HOST: IP1})
        self.assertFalse(json.loads((self.state / "status.json").read_text())["ok"])

    def test_post_write_probe_failure_rolls_back_exactly(self):
        before = self.docker.hosts
        self.docker.fail_normal = True
        with self.assertRaises(RuntimeError):
            self.run_sync()
        self.assertEqual(self.docker.hosts, before)
        self.assertEqual(len(self.docker.writes), 2)
        self.assertTrue(list(self.state.glob("hosts-*.bak")))

    def test_concurrent_edit_is_not_overwritten(self):
        self.docker.concurrent = True
        with self.assertRaisesRegex(RuntimeError, "concurrently"):
            self.run_sync()
        self.assertIn("# external edit", self.docker.hosts)
        self.assertEqual(self.docker.writes, [])

    def test_stopped_container_is_not_started_and_later_is_reconciled(self):
        self.docker.container = None
        self.assertEqual(self.run_sync()["targets"][0]["state"], "stopped")
        self.assertEqual(self.docker.writes, [])
        self.docker.container = "c" * 64
        self.assertTrue(self.run_sync()["targets"][0]["changed"])

    def test_preserves_other_aliases_and_replaces_only_managed_host(self):
        before = "127.0.0.1 localhost\n1.2.3.4 " + HOST + " another.example # operator note\n"
        after = sync.render_hosts(before, {HOST: IP1})
        self.assertIn("1.2.3.4 another.example # operator note", after)
        self.assertIn("127.0.0.1 localhost", after)
        self.assertEqual(after, sync.render_hosts(after, {HOST: IP1}))
        for corrupted in [sync.BEGIN + "\n", sync.END + "\n", sync.BEGIN + "\n" + sync.END + "\n" + sync.BEGIN + "\n" + sync.END]:
            with self.assertRaises(ValueError):
                sync.render_hosts(corrupted, {HOST: IP1})

    def test_atomic_cache_failure_does_not_replace_old_file(self):
        file = self.state / "cache.json"
        file.write_text('{"old": true}')
        with mock.patch.object(sync.os, "replace", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                sync.atomic_json(file, {"new": True})
        self.assertEqual(json.loads(file.read_text()), {"old": True})

    def test_duplicate_container_config_is_rejected(self):
        config = {**CONFIG, "targets": CONFIG["targets"] * 2}
        with self.assertRaisesRegex(ValueError, "one combined"):
            sync.run_sync(config, self.state, self.docker, lambda _: {HOST: IP1})
        self.assertEqual(self.docker.writes, [])

    def test_multiple_containers_reconcile_independently(self):
        class ManyDocker(FakeDocker):
            def __init__(self):
                super().__init__()
                self.contents = {"homestead-id": "127.0.0.1 localhost\n", "second-id": "127.0.0.1 localhost\n"}
            def identify(self, name):
                return name + "-id"
            def read(self, container):
                return self.contents[container]
            def write(self, container, content):
                self.contents[container] = content
        docker = ManyDocker()
        config = {**CONFIG, "targets": [CONFIG["targets"][0], {**CONFIG["targets"][0], "container": "second"}]}
        report = sync.run_sync(config, self.state, docker, lambda _: {HOST: IP2})
        self.assertEqual(len(report["targets"]), 2)
        for content in docker.contents.values():
            self.assertIn(IP2 + " " + HOST, content)
            self.assertEqual(content.count(sync.BEGIN), 1)

    def test_source_must_use_independent_https_authority(self):
        for url in ["http://raw.githubusercontent.com/a", "https://evil.example/a", "https://user:password@raw.githubusercontent.com/a"]:
            with self.assertRaises(ValueError):
                sync.fetch_registry(url)

    def test_registry_response_is_bounded(self):
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.read.return_value = b"x" * (sync.MAX_BYTES + 1)
        opener = mock.MagicMock()
        opener.open.return_value = response
        with mock.patch.object(sync.urllib.request, "build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError, "size limit"):
                sync.fetch_registry(CONFIG["source"])

    def test_empty_registry_and_missing_bootstrap_do_not_write_container(self):
        with self.assertRaises(FileNotFoundError):
            self.run_sync(fetcher=lambda _: {})
        self.assertEqual(self.docker.writes, [])


if __name__ == "__main__":
    unittest.main()
