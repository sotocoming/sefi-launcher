#!/usr/bin/env python3
"""Keep Docker API host records aligned with the launcher's HTTPS endpoint registry."""
import argparse
import datetime
import hashlib
import ipaddress
import json
import os
import pathlib
import re
import subprocess
import urllib.request

MAX_BYTES = 16384
BEGIN = "# BEGIN SEFI MANAGED ENDPOINTS"
END = "# END SEFI MANAGED ENDPOINTS"


def validate_registry(data, hosts):
    if not isinstance(data, dict):
        raise ValueError("Registry must be an object")
    result = {}
    for host in hosts:
        value = data.get(host)
        if not isinstance(value, str):
            raise ValueError("Registry is missing " + host)
        result[host] = str(ipaddress.IPv4Address(value.strip()))
    return result


def fetch_registry(url):
    # Fixed independent HTTPS authority; never forward credentials or follow redirects.
    from urllib.parse import urlsplit
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != "raw.githubusercontent.com" or parsed.username or parsed.password:
        raise ValueError("Registry URL must use HTTPS on raw.githubusercontent.com")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    request = urllib.request.Request(url, headers={"User-Agent": "SEFI-Endpoint-Sync/1.0", "Accept": "application/json"})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=6) as response:
        if response.status != 200:
            raise ValueError("Registry HTTP status " + str(response.status))
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Registry exceeds size limit")
    return json.loads(raw)


def render_hosts(content, mapping):
    """Own only configured aliases and our marked block; preserve all unrelated records."""
    lines = content.splitlines(keepends=True)
    output, inside, blocks = [], False, 0
    for line in lines:
        if line.strip() == BEGIN:
            if inside or blocks:
                raise ValueError("Duplicate managed block")
            inside = True
            blocks += 1
            continue
        if line.strip() == END:
            if not inside:
                raise ValueError("Unmatched managed block end")
            inside = False
            continue
        if inside:
            continue
        record, separator, comment = line.partition("#")
        fields = record.split()
        if len(fields) >= 2 and any(host in mapping for host in fields[1:]):
            aliases = [host for host in fields[1:] if host not in mapping]
            if aliases:
                output.append(fields[0] + " " + " ".join(aliases) + ((" #" + comment.rstrip("\r\n")) if separator else "") + "\n")
            elif separator:
                output.append("#" + comment.rstrip("\r\n") + "\n")
        else:
            output.append(line)
    if inside:
        raise ValueError("Unclosed managed block")
    base = "".join(output)
    if base and not base.endswith("\n"):
        base += "\n"
    return base + BEGIN + "\n" + "".join(mapping[host] + " " + host + "\n" for host in sorted(mapping)) + END + "\n"


def atomic_json(file, data):
    file = pathlib.Path(file)
    temporary = file.with_suffix(file.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        os.chmod(temporary, 0o600)
        json.dump(data, handle, sort_keys=True, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, file)


class Docker:
    def run(self, *args, input=None):
        return subprocess.run(["docker", *args], input=input, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=12, check=True).stdout.decode()

    def identify(self, name):
        result = self.run("inspect", "--format", "{{.Id}} {{.State.Running}}", name).split()
        return result[0] if len(result) == 2 and result[1] == "true" else None

    def read(self, container):
        return self.run("exec", container, "cat", "/etc/hosts")

    def write(self, container, content):
        self.run("exec", "-i", container, "sh", "-c", "cat > /etc/hosts", input=content.encode())

    def probe(self, container, host, path, ip=None):
        args = ["exec", container, "curl", "--connect-timeout", "3", "--max-time", "6",
                "--silent", "--show-error", "--fail", "--output", "/dev/null", "--write-out", "%{http_code}"]
        if ip is not None:
            args += ["--resolve", host + ":443:" + ip]
        status = self.run(*args, "https://" + host + path)
        if status != "200":
            raise RuntimeError("API probe returned HTTP " + status)


def sync_target(docker, target, registry, state):
    container = docker.identify(target["container"])
    if container is None:
        return {"container": target["container"], "state": "stopped", "changed": False}
    mapping = {host: registry[host] for host in target["hosts"]}
    before = docker.read(container)
    after = render_hosts(before, mapping)
    changed = after != before
    if changed:
        # Verify the proposed address with the original hostname and normal TLS validation.
        docker.probe(container, target["probe_host"], target["probe_path"], mapping[target["probe_host"]])
        backup = state / ("hosts-" + container[:12] + "-" + hashlib.sha256(before.encode()).hexdigest()[:16] + ".bak")
        if not backup.exists():
            backup.write_text(before, encoding="utf-8")
            os.chmod(backup, 0o600)
        if docker.read(container) != before:
            raise RuntimeError("Container hosts changed concurrently")
        docker.write(container, after)
        try:
            if docker.read(container) != after:
                raise RuntimeError("Container hosts verification failed")
            docker.probe(container, target["probe_host"], target["probe_path"])
        except Exception:
            # Do not overwrite an unrelated concurrent edit during rollback.
            if docker.read(container) == after:
                docker.write(container, before)
            raise
    else:
        docker.probe(container, target["probe_host"], target["probe_path"])
    return {"container": target["container"], "id": container, "state": "healthy", "changed": changed, "mapping": mapping}


def run_sync(config, state, docker=None, fetcher=fetch_registry):
    state = pathlib.Path(state)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    hosts = set()
    containers = set()
    for target in config["targets"]:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", target["container"]):
            raise ValueError("Invalid container name")
        if target["container"] in containers:
            raise ValueError("Each container must have one combined target entry")
        containers.add(target["container"])
        for host in target["hosts"]:
            if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", host):
                raise ValueError("Invalid host")
        if target["probe_host"] not in target["hosts"] or not target["probe_path"].startswith("/"):
            raise ValueError("Probe must use a managed hostname and relative path")
        hosts.update(target["hosts"])
    if not hosts:
        raise ValueError("At least one target hostname is required")
    cache = state / "endpoints.json"
    report = {"checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "source": config["source"]}
    try:
        registry = validate_registry(fetcher(config["source"]), hosts)
        report["mode"] = "remote"
    except Exception as error:
        report["mode"] = "cache"
        report["fetch_error"] = type(error).__name__ + ": " + str(error)
        registry = validate_registry(json.loads(cache.read_text(encoding="utf-8")), hosts)
    report["registry_sha256"] = hashlib.sha256(json.dumps(registry, sort_keys=True).encode()).hexdigest()
    try:
        report["targets"] = []
        adapter = docker or Docker()
        for target in config["targets"]:
            report["targets"].append(sync_target(adapter, target, registry, state))
        if report["mode"] == "remote":
            atomic_json(cache, registry)
        report["ok"] = True
        atomic_json(state / "status.json", report)
    except Exception as error:
        report["ok"] = False
        report["error"] = type(error).__name__ + ": " + str(error)
        atomic_json(state / "status.json", report)
        raise
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/sefi-endpoints-sync.json")
    parser.add_argument("--state-dir", default="/var/lib/sefi-endpoints-sync")
    args = parser.parse_args()
    state = pathlib.Path(args.state_dir)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    import fcntl
    with (state / "sync.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        report = run_sync(json.loads(pathlib.Path(args.config).read_text(encoding="utf-8")), state)
        if report["mode"] == "cache" or any(target["changed"] for target in report["targets"]):
            print(json.dumps(report))


if __name__ == "__main__":
    main()
