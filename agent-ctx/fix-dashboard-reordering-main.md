# Task: Fix Dashboard Section Reordering

## Summary
Refactored `/home/z/my-project/src/components/finance/dashboard-page.tsx` to render sections dynamically based on saved order from `dashboardPrefs`, instead of using hardcoded JSX order.

## Changes Made

### 1. Added `SECTION_KEYS` constant (module-level)
- Defined at line ~307 as a readonly array of all 10 section keys
- Used by `sortedVisibleSections` useMemo instead of `Object.keys(sectionRenderers)` to avoid hook-order violations

### 2. Added `prefsVersion` state and fixed useEffect dependency
- Added `const [prefsVersion, setPrefsVersion] = useState(0)`
- Changed useEffect dependency from `[customizeOpen]` to `[prefsVersion]`
- This ensures preferences are reloaded after the DB write is complete (avoiding React batching race condition)

### 3. Updated `DashboardCustomizeDialog` callback
- Changed `onPreferencesChange` from `() => { dashboardPrefsService.get().then(setDashboardPrefs) }` to `() => setPrefsVersion(v => v + 1)`
- Incrementing `prefsVersion` triggers the useEffect to reload preferences

### 4. Added `sectionRenderers` map
- Maps each section key to a function returning its ReactNode
- Defined after early returns (where `data` is guaranteed non-null)
- Each section keeps its internal layout:
  - `statCards`: 7 stat cards in responsive grid
  - `serviceDebtSummary`: 2 SectionCards side-by-side (md:grid-cols-2)
  - `monthlyComparison`: single SectionCard with 3-column comparison
  - `dailyChart`, `categoryChart`, `trendChart`: independent full-width SectionCards (removed from shared 3-column grid)
  - `accounts`: single SectionCard with account list
  - `budgets`: single SectionCard with budget bars + totals
  - `upcomingDue`: single SectionCard with due items
  - `recentTransactions`: single SectionCard with transaction list

### 5. Added `sortedVisibleSections` useMemo
- Placed BEFORE early returns to comply with React hooks rules
- Filters by `isSectionVisible(key)` and sorts by `getSectionOrder(a) - getSectionOrder(b)`
- Depends on `[isSectionVisible, getSectionOrder]`

### 6. Replaced hardcoded section JSX with dynamic rendering
- All hardcoded section blocks replaced with:
```jsx
{sortedVisibleSections.map((key) => (
  <div key={key}>
    {sectionRenderers[key]()}
  </div>
))}
```

### 7. Balance Projection (always visible)
- Not a reorderable section key, so rendered as a standalone SectionCard after the dynamic sections
- Always visible regardless of dashboard customization

## Build & Deploy
- `npm run build` - successful
- `bun run lint` - no new errors (pre-existing errors in other files only)
- Deployed with `npx gh-pages -d out`

## Files Modified
- `/home/z/my-project/src/components/finance/dashboard-page.tsx`

## Files NOT Modified (as instructed)
- `/home/z/my-project/src/lib/data/dashboard-prefs.ts`
- `/home/z/my-project/src/components/finance/dashboard-customize-dialog.tsx`
