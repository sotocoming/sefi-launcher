# SEFI Launcher visual system

Approved direction: Product Design option 1, lighter revision. Reference and visual evidence remain local in artifacts/launcher-ui-preview/product-design and approved-comparison.png.

- Preserve the original SEFI cat logo, Minecraft background, anime mascot and existing modpack artwork.
- Onest for Cyrillic and controls; Cabinet Grotesk where supported. Compact body text uses normal weight; main headings use semibold.
- Dark plum panels #18111f, shared borders #49374f, lilac accents, solid muted purple play button #803f9d, mint readiness text.
- Navigation 194 px, native title bar 32 px; minimum supported window 1100 × 680.
- Home console 612 px at 1280 × 720, 548 px at minimum width. Server and modpack share an outer surface and equal vertical tracks; news is a separate bordered strip beneath it.
- EURO/RU form a segmented route selector above one address and copy button. Ping and port sit beneath the address. Players are separate from the online badge. Auto-connect remains an independent opt-in footer.
- Route selection and copying work with auto-connect off. Arrow/Home/End keys and roving focus remain available.
- Pack artwork uses a large tilted, softly masked background. Readiness is text without a checkmark.
- News title precedes its Russian date; matching thin Lucide chevrons use equal button geometry.
- Play is 60 px high, with a thin arrow centered against the complete button. Native authentication, installation and progress states govern its behavior.
- News, account and settings retain their real functionality; the map loads immediately on entry.
- Preview uses --ui-preview and a separate user-data directory. Updater suppression applies only to this explicit local preview.

Mode: Operate. Favor restraint, readable grouping and consistent alignment. All status values come from native services; unavailable ping remains an em dash.

Settings refinement: content-sized groups replace the stretched enclosing card. Memory/display belong to Game, Java and paths to Files, imports/repairs to Pack, Discord/window behavior/updates to Launcher. Shared 12/20 body text and 34px actions. Collapsed news uses natural card height; only expanded articles scroll when required. Scroll thumbs are inset with transparent gutters. Window controls have contiguous 44×31 hit areas with matching 12px thin icons.
