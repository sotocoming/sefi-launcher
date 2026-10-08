# Client authentication regression checks

Run `node scripts/test-auth-client.cjs` with JDK 17+ available (JAVA_HOME or the standard JDK 21 installation).

The checks cover deferred EasyAuth warnings during launcher authentication, restoring the warning on timeout, preserving genuine errors, and a single delayed voice reconnect after successful authentication. Disconnect cancels pending work. Connected or initializing voice chat is left intact by the optional adapter in SefiAuthClient.

Build the bundled mod with `.tools/gradle-8.12.1/bin/gradle.bat -p mod_build remapJar`. The server protocol and server-side authentication checks are unchanged in 2.0.1; the client remains compatible with the existing 2.0.0 server.

The client JAR contains no private server configuration. Authentication uses an account-authorized, short-lived, single-use ticket bound to the signed server challenge and the client's ephemeral key. Copying the JAR does not provide account credentials or server signing keys. A client binary is not a trust boundary: stolen account sessions or malware on the user's computer require separate protection.

Server security checks were run against temporary SQLite databases: 32 tests including the ticket and community security suites passed. Client helper tests, remapped mod compilation, installer contents, TypeScript build, Markdown UI, and skin regression checks passed. Actual bidirectional audio still requires two connected game clients after restart.
