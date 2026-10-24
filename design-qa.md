# Approved light home QA

final result: passed

Reference: local option-1-light.png (1672 × 941), approved by the user.
Evidence: artifacts/launcher-ui-preview/approved-comparison.png.
Comparison shows source and implementation side by side, normalized to 1280 × 720, followed by a focused server/modpack comparison at matching coordinates.

No remaining P0/P1/P2 findings in the selected scope. Shared panel geometry, lighter type, segmented routes, single address, independent player count, pack artwork, separate news strip and muted play control match the selected direction.

Expected adaptations: original native artwork is preserved; real status descriptions remain accurate; auto-connect reflects settings; account fixture differs from the mock's contradictory no-account/enabled-play combination. Native empty-account state keeps Play disabled.

Validation: renderer TypeScript and production build passed. Quick-play opt-in, persistence and stale-selection tests passed. Five-screen/minimum-window regression passed, including equal panel tracks and centered arrow. Packaged native smoke result is saved with local evidence.

## Settings/news/chrome refinement
Visual checks at 1280×720 and regression at 1100×680 passed. Collapsed news has equal scrollHeight/clientHeight; settings show only the active group with no unnecessary scroll at the checked desktop size. Real overflow remains scrollable. Discord missing-value default remains enabled; explicit false is preserved. Discord persistence, repair states, Markdown expansion and all-screen regressions passed. Evidence: settings-polish-java.png, settings-polish-launcher.png, news-polish.png.

## Settings contrast pass
Opaque settings surface and flat page background verified in settings-contrast-game.png. Body contrast against #211a29 is 10.3:1; secondary copy is 9.1:1. Range track and switch boundaries were brightened. Renderer typecheck, production build, all-screen/minimum-window regression and Discord persistence passed. Existing open preview was not restarted.

## Approved refined settings implementation
Final result: passed. Source reference: settings-refined-game.png and settings-refined-java.png, approved by user. Implemented screenshots: settings-final-game.png, settings-final-java.png, settings-final-pack.png and settings-final-launcher.png. Matched at1280×720 with same fixture. All four categories have zero horizontal overflow; Java, pack and launcher also have zero vertical overflow. Native controls replace preview DOM adaptation; fullscreen accessible label and settings guards retained. Renderer typecheck/build, Discord persistence, repair states and all-screen/minimum-window checks passed.

Discord row refinement: removed repeated heading and explanatory labels. One switch row now contains a title and purpose; one short prerequisite line follows. Screenshot settings-discord-refined.png; detail settings-discord-detail.png. Production build and Discord default/persistence regression passed. Packaged preview was not replaced or restarted in this pass.

Discord typography correction: restored shared h2 (Onest15px/22px weight600) with inline switch in heading row. Descriptions use shared12px/20px text, helper11px/19px. Computed typography verified against all section headings, IAB capture produced a blank frame; verified evidence copied unchanged from the existing Discord UI regression screenshot at1100×850 and opened with view_image. Evidence settings-discord-unified-verified.png. Renderer build and Discord persistence passed.
