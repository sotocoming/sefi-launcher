# SEFI Launcher visual system

The native React UI follows the approved original composition: left navigation, full-height Minecraft world, SEFI mascot and a compact launch console. Assets are in src/assets/interface; the pack watermark uses the existing modpack icon.

- Onest for Cyrillic and controls; Cabinet Grotesk for supported display glyphs with Onest fallback.
- Dark plum canvas #140f1c, panels #191121, shared borders #594064, lilac text accents #d9b6ed, launch button #803aa5, positive status #88ddbb.
- 194 px navigation (180 px at 1100 px); 32 px native draggable title bar. Minimum window remains 1100 × 680.
- Main server and modpack panels share header, body and footer tracks. News date follows its title.
- Pack artwork is enlarged, rotated, clipped and softly faded behind text. Keep the mascot and original logo. No decorative status checkmark.
- News uses article + selection list, account uses identity + real skin editor, settings use functional sections. Map iframe starts loading as soon as its page opens.
- Motion uses existing Framer Motion transitions and respects reduced motion. No animated layout scaling on the play button; the arrow is centered against the entire button.

All server status, authentication, skin editing, launch progress and settings remain native. Unavailable ping displays an em dash rather than fabricated latency.

Local preview launches with --ui-preview and a separate --user-data-dir. This disables updater installation only for that explicit preview switch; normal production behavior is retained.
