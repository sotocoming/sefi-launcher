# SEFI endpoint registry and container synchronization

## Change an existing IP in one place

The canonical table is [fallback-endpoints.json](../../fallback-endpoints.json) on launcher master.
It is a flat hostname → IPv4 JSON object, also bundled into new launcher builds. Do not maintain
another independent IP table in an installer, Java arguments, container ExtraHosts, or this service.

1. Bring up the destination API with the same HTTPS certificate/hostname and working game service.
2. Change the corresponding values in fallback-endpoints.json and merge to master.
3. The container service checks the registry every 60 seconds (plus up to 10 seconds scheduling
   tolerance), probes the new API with normal TLS validation, and then updates its owned hosts block.
4. Launchers refresh the registry on opening. If addresses changed they persist them and relaunch once
   before opening their window. Already open launchers keep their current routing until reopened.
5. Keep the old destination alive until active game sessions and open launchers have moved.

An IP-only change needs no launcher release. New hostnames belong in the reviewed registry/bundled
allowlist, and therefore require a client update before depending on them. IPv4 is the registry format.
Changing IPs does not move worlds, databases, certificates, or DNS records for other applications.

## Why the server has a service

The host machine's /etc/hosts is not inherited by Docker containers. The server-side SEFI Auth Java
module verifies tickets through the HTTPS API inside the game container. The sync service manages
only the configured API aliases, without changing certificates, credentials, mod JARs, or Java trust.

The service does not start, stop, or recreate game containers. It checks the configured container name
each time, so a new container ID with the same name is reconciled on the next timer tick.
Stopped containers stay stopped. Host records for unrelated names and aliases are preserved.

Configure multiple containers in /etc/sefi-endpoints-sync.json using the example. Give each container
one target entry, combine its managed aliases in hosts, and choose a public read-only HTTPS health
endpoint. Container names/hostnames are checked; commands use argument arrays, never interpolated shell.
The same source URL serves every configured target.

## Installation

Install sync.py as /usr/local/libexec/sefi-endpoints-sync.py (root:root, mode 0755),
config.example.json as /etc/sefi-endpoints-sync.json (root:root, mode 0644), and the service/timer
under /etc/systemd/system. Review container names and probe route before enabling.
Run systemd-analyze verify, systemctl daemon-reload, systemctl start sefi-endpoints-sync.service,
then systemctl enable --now sefi-endpoints-sync.timer. No Minecraft restart is needed.

The root oneshot requires the local Docker socket and Python 3 standard library. Persistent state,
backups, last good endpoints, and status live under /var/lib/sefi-endpoints-sync with mode 0700.
Installation/deployment must be serialized with the project owner and recorded with its source commit.

## Observe and recover

- systemctl status sefi-endpoints-sync.timer sefi-endpoints-sync.service
- cat /var/lib/sefi-endpoints-sync/status.json
- journalctl -u sefi-endpoints-sync.service

Remote data is bounded and fetched over verified HTTPS without credentials or redirects.
Only configured aliases with valid IPv4 values are used. GitHub/network/JSON failures reuse the
last good cache. Failed candidate TLS/API probes preserve the active routes and cache; a post-write
failure restores the exact prior hosts contents if no other writer changed them.
The timer retries automatically. It does not clear accounts or change the signature/ticket protocol.

Backups are hosts-<container-id-prefix>-<content-hash>.bak in the state directory. To remove the
integration, disable its timer first, then remove only the marked BEGIN/END SEFI MANAGED ENDPOINTS
block from the current container (or restore its exact pre-change backup after checking for other edits).
Removing this integration during a DNS outage makes server-side auto-login unavailable again.
Changing Docker creation files/ExtraHosts or restarting Minecraft is unnecessary.

## Validation

python ops/endpoint-sync/test_sync.py covers changed IPs, source outage, invalid/oversized data,
cache preservation, candidate and post-write failures, exact rollback, concurrent edit protection,
container replacement, stopped containers, and preservation of unrelated records.
Client tests additionally cover configured/reserve addresses for SEFI menu/EURO/RU launches,
the actual Java exact-address validator, signatures, replay, revoked sessions, and broker expiry.
