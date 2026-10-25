# SEFI Launcher visual system

Approved direction: Product Design option 1, lighter revision. Reference and visual evidence remain local in artifacts/launcher-ui-preview/product-design and approved-comparison.png.

- Preserve the original SEFI cat logo, Minecraft background, anime mascot and news artwork. Keep the original modpack illustration in source assets for possible future use.
- Onest for Cyrillic and controls; Cabinet Grotesk where supported. Compact body text uses normal weight; main headings use semibold.
- Dark plum panels #18111f, shared borders #49374f, lilac accents, solid muted purple play button #803f9d, mint readiness text.
- Navigation 194 px, native title bar 32 px; minimum supported window 1100 × 680.
- Home console 612 px at 1280 × 720, 548 px at minimum width. Server and modpack share an outer surface and equal vertical tracks; news is a separate bordered strip beneath it.
- EURO/RU form a segmented route selector above one address and copy button. Ping and port sit beneath the address. Players are separate from the online badge. Auto-connect remains an independent opt-in footer.
- Route selection and copying work with auto-connect off. Arrow/Home/End keys and roving focus remain available.
- The pack card uses a quiet text composition without background illustration: title/version, short summary, and a bottom state row aligned with the server auto-connect row. Readiness remains text without a checkmark.
- News title precedes its Russian date; matching thin Lucide chevrons use equal button geometry.
- Play is 60 px high, with a thin arrow centered against the complete button. Native authentication, installation and progress states govern its behavior.
- News, account and settings retain their real functionality; the map loads immediately on entry.
- Preview uses --ui-preview and a separate user-data directory. Updater suppression applies only to this explicit local preview.

Mode: Operate. Favor restraint, readable grouping and consistent alignment. All status values come from native services; unavailable ping remains an em dash.

Settings keep the approved horizontal categories and600px content column. All atomic settings use the same SettingRow: Onest13/20/500 title,12/20/400 descriptions/help/status,12/18/400 buttons. The control slot and title share a32px first-line track. SwitchSetting owns one40×32 target, one34×20 track and the accessible description IDs. There are no service-specific toggle or typography variants.

Memory retains its raised control surface and value; Java/file paths use one shared path field. Only actual multi-setting groups use15/22 headings. Four categories are checked at1280×720 and1100×680, including long paths, disabled/game-active states and native IPC. No meaningful copy below12px. Legacy viewport-based repair stacking is removed because the actual form width remains600px.

Updater uses the same Onest and plum surface. The header control is fixed at204×24px across every visible state. Eight small sparks originate along its lower perimeter and drift outward while downloading/ready; reduced motion and hidden surfaces stop particles. Settings status icons keep a static glow. Header status opens the launcher settings tab. All errors retain readable recovery and native game/install guards. Browser consent and loopback receipt share original SEFI branding and Onest, explicit permission and truthful handoff copy.

Play failures replace the main action with one compact plum/rose recovery surface: clear cause, next step, retry when valid, expandable diagnostics and copy feedback. Account, Java/files, memory and launcher-update errors link directly to the appropriate screen/tab. Normal no-account and Microsoft-required states are actionable navigation, not disabled dead ends. Preparation uses real progress only, and the renderer enters checking before awaiting settings/native IPC to deduplicate clicks. Error summaries fit1280×720 and1100×680 without extra scroll; expanded technical logs can scroll and reveal themselves on open.

The update indicator has a bounded static external mint halo (soft7px blur), visible beyond the button and below its edge, with the existing perimeter sparks. Geometry and reduced-motion behavior stay unchanged. Pack titles and versions ellipsize with full title attributes; checking/missing/update/ready variants retain the same shared footer geometry.

Pack status semantics: checking uses soft blue#a9c8f2, missing installation uses rose-red#eda8b5, available update uses amber#e6c777, ready keeps mint#92dfbd. Text labels always remain alongside color.

Preview implementation is integrated with upstream master fe6aaca (published launcher1.0.33). Keep claims fix1.0.2 and current installer/privacy packaging alongside the UI; package metadata and sidebar version come from the same package.json. This is a local UI preview, not a published replacement release.

The map uses one shared SEFI surface. Launcher embeds /maps?embed=launcher and owns title/reload/open-browser; the embedded website hides its standalone header and retains one zoom/fit group. Refresh uses a bounded origin/source-validated message and preserves the child document/view, with a reload fallback for older pages. The15s slow notice is canceled once loaded. map-preview is an explicit local build mode only; ordinary builds use the HTTPS website.


Release notes extend the existing Operate surface as one native dialog,560px maximum width and viewport-bounded height. Onest, shared plum/lilac palette, one title with version, four concise changes separated by shared borders, one acknowledgement action; no imagery or new visual identity. Escape and close acknowledge the current app version atomically in the local profile; save failure offers a readable explanation and a dismiss-without-saving action. The launcher settings category reopens the list. No player-map/server-login changes are claimed before server deployment.
Account panels keep their typography and actions at1100×680 and1280×720. At shorter heights the skin preview adapts to available space and vertical padding contracts; the page remains scrollable for longer messages. Verified empty, community, Microsoft, separate and linked profiles.


Optional diagnostic reporting extends the existing launch-failure panel and launcher settings. A native820px dialog uses the shared Onest/plum system: comment and explicit attachment choices left, exact prepared report preview right. The footer stays visible at1100×680; local-save confirmation reuses its status slot. Nothing is uploaded on preparation, preview, cancellation or export. Errors distinguish website receipt from Discord ticket creation; no-account and empty manual forms remain actionable. Original art and local fonts are reused; no new raster artwork.

Official Minecraft accounts share the existing SkinPreview stage with community profiles, with a taller read-only stage at compact window heights. Show the actual official skin/cape, a single Minecraft.net action and refresh, plus loading/missing/error/retry states. No community upload/reset/model controls for a license. News likes use a persistent lilac pressed fill and border alongside aria-pressed; a counter alone does not indicate selection. Release notes describe user-facing changes from the last public launcher, not intermediate preview fixes.
