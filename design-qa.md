# Approved light home QA

final result: passed

Reference: local option-1-light.png (1672 × 941), approved by the user.
Evidence: artifacts/launcher-ui-preview/approved-comparison.png.
Comparison shows source and implementation side by side, normalized to 1280 × 720, followed by a focused server/modpack comparison at matching coordinates.

No remaining P0/P1/P2 findings in the selected scope. Shared panel geometry, lighter type, segmented routes, single address, independent player count, pack artwork, separate news strip and muted play control match the selected direction.

Expected adaptations: original native artwork is preserved; real status descriptions remain accurate; auto-connect reflects settings; account fixture differs from the mock's contradictory no-account/enabled-play combination. Native empty-account state keeps Play disabled.

Validation: renderer TypeScript and production build passed. Quick-play opt-in, persistence and stale-selection tests passed. Five-screen/minimum-window regression passed, including equal panel tracks and centered arrow. Packaged native smoke result is saved with local evidence.
