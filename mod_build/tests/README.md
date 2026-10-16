# SEFI Auth 2.0.3 regression checks

Run `node scripts/test-auth-client.cjs` with JDK 17+ available (JAVA_HOME or the standard JDK 21 installation).

The checks cover three bounded attempts, wall-clock deadlines, retry backoff, permanent rejection, success/disconnect cancellation, trusted server addresses, deferred EasyAuth warnings, and delayed voice reconnect. Run `node scripts/test-ticket-broker.cjs` for actual local HTTP requests with signed challenges, temporary failure recovery, revoked sessions, replay rejection and secret-free diagnostics.

Build the bundled mod with Gradle 8.12.1 and JDK 21: `gradle -p mod_build build`. Full retry support requires SEFI Auth 2.0.3 on the server and client. See `mod_build/AUTH-RETRY.md` for deadlines, validation limits, deployment and rollback.

The client JAR contains no private server configuration. Authentication uses an account-authorized, short-lived, single-use ticket bound to the signed server challenge and the client's ephemeral key. Copying the JAR does not provide account credentials or server signing keys. A client binary is not a trust boundary: stolen account sessions or malware on the user's computer require separate protection.

Server security checks use temporary SQLite databases. Live Minecraft login and actual bidirectional audio still require connected test players after installation.
