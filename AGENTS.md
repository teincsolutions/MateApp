## Goal
Build an offline-first Expo SDK 57 public transport route mapping app with SQLite persistence, GPS tracking, area/stop/fare management, validation engine, and export capabilities, plus a Kotlin Android validation library.

## Constraints & Preferences
- Expo SDK 57, yarn workspaces monorepo, TypeScript, expo-router
- Offline-first, no backend in v1
- UUID-based entities, SQLite source of truth
- No emojis in UI, use `@expo/vector-icons` Ionicons for tab icons
- Fare levels journey-scoped, reusable across areas within same journey
- Intra-area fare validation uses distance-based matching
- Reverse geocode rate-limited (cache by rounded coords, 30min TTL)
- Autocomplete min 2 chars, debounced 300ms, suggestion results only show on keyup, hidden on blur/tap selection
- `findNearestStop` capped at 25km, no full scan fallback
- Settings persisted via `expo-file-system/legacy` async methods, no module-level side effects
- EAS Update for OTA JS updates, channels: `production` and `preview`
- All TextInputs must have `autoCorrect={false}` and `autoCapitalize="none"`
- Screens with inputs need `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`

## Progress
### Done
- Monorepo architecture: `@mateapp/core` (types, interfaces, services, stores), `@mateapp/db-sqlite` (expo-sqlite impl), `@mateapp/db-node` (better-sqlite3 for testing)
- 9 entity types, repository interfaces, and implementations for both DB packages
- 199 tests across 7 test files (TS) + 44 unit tests for Kotlin lib
- CLI scripts: seed, visualize, export-data
- Fare levels unified under `fare_levels` (journey-scoped) with `area_fare_levels` junction
- Mapping screen with GPS tracking, stop/area creation, fare entry, 4 native BottomSheets
- Header with area switcher, recording dot, GPS accuracy
- FareLevelPicker reusable inline expandable component
- Validate screen with "Use Current" location buttons
- Export screen with XLSX/CSV; lat/lng columns added to all sheets
- Manage Data screens: stops, areas, fare levels, journeys CRUD
- `findNearestStop` capped to 25km (`[1000, 5000, 25000]`), full scan fallback removed
- Reverse geocode service (`reverseGeocode()` + `autocomplete()`) with caching and logging
- Autocomplete suggestion dropdown in area name and stop label inputs (debounced, hidden on blur/tap)
- Stop `seq` column added, `SCHEMA_VERSION` bumped to 5, stops ordered by `seq, label`
- Settings persistence: debounced 500ms save, lazy path construction inside load/save functions, uses `expo-file-system/legacy`
- Area delete cascade: removes FK references systematically, UI shows impact summary before confirm
- EAS Update configured with `production` and `preview` channels
- `react-native-mmkv` fully removed; `react-native-worklets` pinned to `0.10.0`
- Fare Summary inter-area fare rows show destination area's first stop lat/lng
- Journey edit screen at `manage/journeys/[id].tsx` with name editing, status/area/stop info, "Complete Journey" button, delete
- Journey list screen: journey name tappable → navigates to edit screen
- Route registered in `_layout.tsx` for `manage/journeys/[id]`
- Stops list: each row shows linked area names
- Area edit screen: "Add Existing Stop" modal shows each stop's linked area names
- `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` on all input screens
- All 16 TextInputs across 9 files have `autoCorrect={false}` `autoCapitalize="none"`
- Areas and stops lists use `SectionList` grouped by `created_at` day, sorted by descending sequence
- Fare levels sorted by amount ascending in all 4 display/selection UIs
- Completed journeys skip GPS subscription; map auto-fits to stops + track points via `fitToCoordinates()`
- **Export DB button** added to Settings screen (`app/(tabs)/settings.tsx`) — copies `mateapp.db` to cache and shares via `expo-sharing`
- **`mateapp-core-android/`** Kotlin library created at workspace root:
  - `GeometryUtils.kt` — Haversine, point-in-polygon, convex hull, JSON polygon parser
  - `DatabaseReader.kt` — 11 SQL query methods against exported `.db` files
  - `ValidationEngine.kt` — full 7-step validation pipeline ported from TS
  - `ValidationResult.kt` — data classes for all entity types
  - `MateAppDatabase.kt` — convenience wrapper with Builder pattern, `validate()`, `getSchemaVersion()`, `getSourceJourneyId()`
  - 44 unit tests (JUnit 4 + Robolectric 4.12) — all passing
  - Gradle build with `android.useAndroidX=true`, AGP 8.2.2, Kotlin 1.9.22
  - `.gitignore` excluding `build/`, `.gradle/`, `local.properties`
  - `README.md` with local AAR build and JitPack instructions
- **Journey-specific DB export**: `packages/db-sqlite/src/services/JourneyExportService.ts` — accepts **multiple journey IDs** and bundles them into a **single `.db` file** with all referenced data (areas, stops, fare levels, track points). Uses `INSERT OR IGNORE` to deduplicate shared areas/stops. Metadata stored as `source_journey_ids` (comma-separated) and `exported_at`.
- **Export tab** (`app/(tabs)/export.tsx`): 3-format toggle (XLSX / CSV / .db). **Checkbox multi-select** to pick which journeys to bundle. "Export Selected (N) as .db" button creates one `.db` with all checked journeys. "Export All Data (.db)" exports full `mateapp.db`.
- **Settings "Export Database"** kept for quick full-DB backup.
- **Journey edit screen** still has "Export Journey (.db)" for single-journey convenience.

### In Progress
- App fails to launch — crash predates settings changes, may originate from the MMKV experiment (missing `react-native-nitro-modules` peer dep or worklets version conflict). Not yet isolated.

### Blocked
- (none)

## Key Decisions
- **No Drizzle/Prisma**: Interface-based DI pattern with concrete expo-sqlite/better-sqlite3 implementations
- **Fare levels journey-scoped**: `fare_levels` table with `journey_id`, linked via `area_fare_levels` junction
- **Distance-based intra-area fares**: Algorithm uses northernmost stop (A1) as reference distances
- **UUID without crypto**: Custom `Math.random()`-based `uuidv4()` for Hermes compatibility
- **BottomSheet from @expo/ui**: Replaced Modal components with native sheets
- **FareLevelPicker**: Inline expandable dropdown (no native Picker module) to avoid keyboard overlay
- **Reverse geocode caching**: 30min TTL by lat/lng at 4dp precision (~11m) to respect rate limits
- **Settings via expo-file-system/legacy**: Rejected MMKV (CocoaPods `NitroModules` failure) and new `File`/`Paths` API (throws on legacy method calls)
- **Area delete cascade**: Deletes downstream FK references before the area itself; nullifies `journeys.start_area_id`/`end_area_id` rather than deleting the journey
- **Stop seq ordering**: Auto-incremented from existing `stops` state in mapping screen, queried when creating replacement in manage view
- **EAS Update channels**: `production` for production builds, `preview` for internal testing
- **Inter-area fare lat/lng**: Uses first stop (`seq`-sorted) of destination area instead of `-`
- **Completed journey GPS**: No location watcher subscription; map still shows stops + track path via `fitToCoordinates()`
- **Day sections + seq sort**: Areas/stops lists group by `created_at` day and sort descending by sequence within each section
- **Fare levels sort by amount**: Ascending sort across all fare level selection/display UIs
- **Journey export (multi)**: Accepts multiple journey IDs, builds a single `.db` with `INSERT OR IGNORE` to deduplicate shared areas/stops. Metadata key `source_journey_ids` (comma-separated) instead of single `source_journey_id`.
- **polygonFromJson regex parser**: Uses Kotlin Regex instead of `org.json.JSONArray` (unavailable on unit test classpath)
- **MateAppDatabase convenience wrapper**: Builder pattern for config reuse, `useDatabase()` to switch DB files, static methods for one-off calls
- **Exported `.db` metadata**: Includes `_meta` table with `source_journey_ids` (comma-separated, plural for multi-journey), `exported_at` for provenance

## Next Steps
- Debug app launch crash — check Metro logs for module resolution errors; rollback to known-good commit if needed
- Run `eas update --branch production --message "..."` after fix to push first OTA update
- Tag JitPack release (`git tag v1.0.0 && git push origin v1.0.0`) to publish Kotlin lib

## Critical Context
- **Schema versioning**: `SCHEMA_VERSION=5` in both `db-sqlite`/`db-node`. Bump when changing schema to trigger clean migration
- **`findNearestStop`**: Progressive bounding-box `[1000, 5000, 25000]`, returns null if nothing within 25km
- **Reverse geocode**: Uses `EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL` env var. Add to `.env` file before running
- **Autocomplete**: Uses `primaryText` to fill input on tap. Clears pending debounce timer on selection and blur
- **GPS positioning**: `lastLocationRef` throttles `setCurrentLocation` updates to >2m changes
- **FareLevelPicker**: At `components/FareLevelPicker.tsx`, used in 3 places
- **Settings persistence**: Calls `expo-file-system/legacy` methods inside load/save functions (no module-level `documentDirectory` access)
- **Area delete cascade order**: `journey_fares` → `track_points` → `journey_areas` → nullify `journeys.start_area_id`/`end_area_id` → `area_fare_levels` → `area_stops` → `areas`. UI shows warning with impact summary
- **EAS Update**: Project ID `ca4ac20b-0e4d-444e-bb12-c6cfacae6fd1`. Runtime version policy is `appVersion`. Update URL: `https://u.expo.dev/ca4ac20b-0e4d-444e-bb12-c6cfacae6fd1`
- **App launch crash**: May be caused by leftover native module linkage from `react-native-mmkv` (missing `react-native-nitro-modules`) or `react-native-worklets@0.10.2` incompatibility
- **JourneyExportService**: `exportJourneyDb(sourceDb, journeyIds[])` — accepts array of journey IDs, fetches all rows for all journeys, creates one `.db` with `INSERT OR IGNORE` dedup. File name: `export-<singleId>.db` or `export-<N>-journeys.db`.
- **Export tab workflow**: Toggle to `.db` mode → check journeys → tap "Export Selected (N) as .db" → one `.db` shared. Master export for full `mateapp.db`.
- **`.db` path pattern**: `<docDir>/SQLite/export-<journeyId>.db` or `<docDir>/SQLite/export-<N>-journeys.db` — same SQLite schema as main `mateapp.db`, journey-scoped rows merged.

## Relevant Files
- `adapters/settings.ts` — settings load/save using `expo-file-system/legacy` async methods
- `app/(tabs)/settings.tsx` — Export Database button copies `<docDir>/SQLite/mateapp.db` and shares via `expo-sharing`
- `packages/db-sqlite/src/services/JourneyExportService.ts` — multi-journey DB export (accepts `string[]`), uses `INSERT OR IGNORE`, stores `source_journey_ids`
- `MateApp/app/manage/journeys/[id].tsx` — Export Journey (.db) for single journey
- `MateApp/adapters/fileWriter.ts` — `exportJourneyToFile(journeyIds[], format)` supports XLSX/CSV/`.db`
- `MateApp/app/(tabs)/export.tsx` — Multi-select checkboxes, single "Export Selected" button, 3-format toggle
- `MateApp/adapters/index.ts` — exports `exportJourneyDb(journeyIds[])`
- `mateapp-core-android/` — Kotlin validation library (GeometryUtils, DatabaseReader, ValidationEngine, ValidationResult, MateAppDatabase with Builder)
- `mateapp-core-android/mateapp-core/src/test/kotlin/com/mateapp/validation/` — 44 unit tests
- `mateapp-core-android/README.md` — local AAR build (`./gradlew :mateapp-core:assembleRelease`) and JitPack instructions
- `mateapp-core-android/.gitignore` — excludes `build/`, `.gradle/`, `local.properties`
- `MateApp/app.json` — `runtimeVersion: { policy: "appVersion" }`, `updates.url: https://u.expo.dev/ca4ac20b-0e4d-444e-bb12-c6cfacae6fd1`
- `MateApp/eas.json` — `preview` and `production` profiles with `"channel"` setting
- `.env` — must define `EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL` for reverse geocode and autocomplete
