# Forms Card Fix - Learnings

## TableCard.tsx
- Title overflow was already handled: `flex-1 min-w-0 space-y-1` container with `block truncate` on title and `truncate` on description, badge has `flex-shrink-0`. No changes needed.

## TableSelection.tsx
- Moved 'Todas' button from before `categories.map()` to after it — simple reorder of JSX blocks.
- Removed the entire 'Atajos' section (the `div` with shortcut hints for Ctrl+F and Enter) from the explorer aside.

## Verification
- `npm run build` — passes (2332 modules, 3.92s)
- `npm run test -- src/apps/forms` — 7 tests pass across 3 files
- `npm run lint` — no new errors; all lint issues are pre-existing in other files
- `check:forms-category-contract` — passes
