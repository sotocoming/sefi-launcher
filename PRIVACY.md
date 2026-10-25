# SEFI Launcher privacy policy

Last updated: October 25, 2026.

[Русская версия](PRIVACY.ru.md).

This policy describes the SEFI Launcher desktop application and the SEFI client
mods shipped with it. The project is maintained by SEFI Team, with repository
owner [sotocoming](https://github.com/sotocoming) as the project contact.
It describes the current implementation; it does not introduce new consent
controls or change how an already installed release behaves.

## Automatic launcher updates

Installed releases automatically check GitHub for new versions and download
available updates in the background. A downloaded update can be installed when
the launcher exits while no game is running. The interface also offers a manual
check and an install/restart action. There is currently no separate setting to
disable automatic update checks or downloads. These requests disclose connection
information to GitHub and its download infrastructure.

## Connections and data

| Feature | Data and recipient | When it happens |
| --- | --- | --- |
| News, configuration, server status and map | SEFI services at mc.sotocoming.ru receive network request information such as IP address, time, requested resource and client headers. The map is loaded from that site. Remote news images can also contact their image hosts. | Configuration and status are requested at startup and refreshed while the launcher runs. The map is loaded when opened. |
| SEFI Community sign-in | The community service receives the browser sign-in exchange and issues a launcher session token. The launcher stores the community profile, including Minecraft name/UUID, Twitch login/avatar and access status. Saved community sessions are refreshed automatically. Twitch authentication takes place through the community website. | When signing in, when a saved session is refreshed, and when checking access before game launch. |
| Microsoft / Xbox / Minecraft sign-in | Microsoft services receive authorization requests and issue tokens and the Minecraft name/UUID. When a community account is present, the launcher can send a Minecraft access token to the SEFI backend to verify and link that Minecraft profile; explicit linking also uses this verification. The Microsoft refresh token is not sent to the SEFI backend by this flow. | When signing in, linking accounts or refreshing the Microsoft session needed to launch the game. |
| Skins and avatars | SEFI receives a selected skin PNG and model when you save it. Skin lookups use player names/UUIDs, including other players rendered by the SEFI skin mod. Official Minecraft skin previews send the profile UUID to sessionserver.mojang.com and fetch public skin/cape textures from textures.minecraft.net over HTTPS, without account tokens or cookies. Avatar requests to mc-heads.net include a player name or UUID. Twitch avatar URLs may contact Twitch image hosts. Those hosts also see network request information. | When displaying an avatar, loading a saved skin, saving/resetting a skin, or rendering community players in Minecraft. |
| Game and Java downloads | Minecraft/Microsoft, Fabric, CurseForge, Modrinth, Eclipse Adoptium, GitHub, their download/CDN hosts and the SEFI download mirror receive download requests and connection information. Authenticated SEFI mirror requests include the community token; it is not forwarded to external download hosts. | When installing, repairing or launching a game that needs files, or preparing the managed Java runtime. |
| Launcher updates | GitHub and its download infrastructure receive requests for release metadata and update files, with connection information and updater headers. | Installed releases check automatically and download available updates in the background. |
| Discord activity | The launcher sends game/launcher state, play start time, game dimension, player count and the configured server-region label to the local Discord application. Discord can publish that activity according to the user's Discord settings. The launcher also requests the Discord application's icon metadata and uses a Discord CDN image URL. | Enabled by default; can be disabled in launcher settings. |
| Interface fonts | Google Fonts receives font/style requests and connection information from the interface. | When the interface loads and the font is fetched. |

These connections support the features above. Closing the launcher stops its
background work, but does not close a game or browser already opened from it.
The game and third-party mods may make their own connections and are subject
to their respective policies.

## Reports and optional input diagnostics

A launch or crash report can also be prepared manually in the launcher.
Opening the form does not upload anything. The user chooses attachments:
launcher version, OS, architecture and allocated memory; a limited launch log;
game warnings and errors; or a crash file from the last launch. The launcher
keeps bounded current-launch records in memory and checks only known log and
crash files for that launch when preparing a report. After restarting the
launcher, saved errors and crashes from the last 24 hours can be selected manually;
they are labeled as a previous session and are unchecked by default. Known authentication data,
personal paths and recognized chat lines are filtered before preview. The
preview shows the prepared contents; the comment and Discord-ticket option
are also chosen by the user.

Launcher reports go directly to the authenticated SEFI endpoint only when
the user presses Send to website. A manual retry of the same contents keeps
the same report ID. There are no automatic uploads or background retries.
Without signing in, a JSON copy can be saved to a folder chosen through Save
a copy. The website stores reports for SEFI support. If a ticket is requested,
Discord receives the description and a diagnostic link accessible to panel
administrators.

The in-game /report form sends data only after the user chooses to send a report.
It includes the entered title, description and reproduction steps, plus selected
attachments. Available attachments include mod names, versions and hashes,
Java/OS and graphics information, resource-pack information, selected settings
and key bindings, limited gameplay context, and filtered warning/error lines.
Attachments are selected by default but can be excluded and previewed. The form
also offers saving a local copy without sending it.

Input recording starts only when the user enables it, lasts up to two minutes,
and records mouse-button/modifier and game-input state rather than typed chat.
A recording is attached only if it exists and the input attachment is selected.
Filtering is not a guarantee that every possible personal detail is removed:
review the preview and do not enter passwords or other secrets in free text.

In-game /report submissions pass through a service bound to 127.0.0.1 on the user's computer and then
to the authenticated SEFI report endpoint. A local copy is saved in sefi-reports
inside the game directory. The Discord-ticket option is selected by default and
can be disabled before sending; if enabled, the server can forward report data
to a Discord support ticket. Reports are for the SEFI support team, and linked
Discord authors may be given access to their ticket. Server availability and
account linking determine whether a ticket can be created.

## Local storage and removal

The launcher stores settings, cached configuration, account identifiers and
session credentials under its Electron user-data directory (normally the
sefi-launcher folder inside %APPDATA% on Windows). It maintains accounts.json
and a recovery copy, accounts.json.bak. The Microsoft refresh token is encrypted
with Electron safeStorage (Windows DPAPI). This does not mean all stored account
fields or all other tokens are encrypted; protect access to the Windows profile.

Removing an account updates the active account file. It does not revoke provider
permissions, delete the SEFI website account or necessarily remove that account
from the recovery copy. To remove all local launcher credentials, close the
launcher and remove its account file and recovery copy, or its user-data folder.
Removing the folder also removes launcher settings. Revoke external access
separately through the relevant provider when needed.

Game files, settings backups, local reports and input recordings are stored in
the selected game directory. The managed Java runtime is kept in the launcher
user-data directory. Uninstalling the application preserves application data;
it does not automatically delete these files. Delete unneeded files yourself
when the launcher and Minecraft are closed, preserving any worlds or settings
you want to keep.

## Control, server storage and contact

You can disable Discord activity in settings, omit report attachments, disable
Discord-ticket creation, save reports locally, and choose not to start an input
recording. Removing a saved account stops the launcher's use of that account
except for copies you retain. The current release has no single offline/privacy
switch: automatic update, configuration, status, font and avatar requests are
not all controlled by separate switches.

Removing local files does not delete profiles, uploaded skins, reactions,
submitted reports, support tickets, server logs or backups already held by SEFI
or an external provider. The client does not set a universal deletion deadline
for those server-side records. For access, correction, retention or deletion
questions, contact the administrator at [sotocoming@proton.me](mailto:sotocoming@proton.me).
Do not include passwords, access tokens or other credentials in your message.
If identification is needed to handle your request, the administrator will
explain which information is required.

## External service policies

External providers operate their own services and infrastructure:

- [Microsoft, Xbox and Minecraft privacy statement](https://privacy.microsoft.com/privacystatement)
- [Twitch privacy notice](https://legal.twitch.com/en/legal/privacy-notice/)
- [Discord privacy policy](https://discord.com/privacy)
- [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- [Google privacy policy](https://policies.google.com/privacy)
- [Eclipse Foundation / Adoptium privacy policy](https://www.eclipse.org/legal/privacy/)
- [Modrinth privacy policy](https://modrinth.com/legal/privacy)
- [MCHeads service information](https://mc-heads.net/) (avatar lookup provider)
- [Fabric service information](https://fabricmc.net/) (loader and library metadata/downloads)
- [CurseForge](https://www.curseforge.com/) (modpack and mod downloads; see its current privacy links)

Changes to the launcher's data handling should be reflected in this document
with a new revision date. Consult the policy for the version you use.
