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
