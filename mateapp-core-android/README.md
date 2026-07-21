# mateapp-core-android

Kotlin validation library for MateApp's offline SQLite databases. Validates transport fares given pickup/destination coordinates.

## Usage

### Builder pattern (reusable client)

```kotlin
val mateApp = MateAppDatabase.Builder()
    .dbPath("/path/to/exported-journey.db")
    .build()

// Reuse for multiple validations
val result1 = mateApp.validate(5.5620, -0.2050, 5.6200, -0.0170)
val result2 = mateApp.validate(5.55, -0.20, 5.65, -0.01)
// Database is opened and closed automatically per call

// Switch to a different exported .db without creating a new client
mateApp.useDatabase("/path/to/another-export.db")
val result3 = mateApp.validate(6.68, -1.62, 6.68, -1.62)

when (result1.status) {
    ValidationStatus.SUCCESS -> println("Fare: GHS ${"%.2f".format(result1.fare)}")
    ValidationStatus.STOP_NOT_FOUND -> println("Stop not found")
    ValidationStatus.JOURNEY_NOT_FOUND -> println("Journey not found")
    ValidationStatus.UNKNOWN -> println("Unknown error")
}
```

### One-liner static convenience

```kotlin
val result = MateAppDatabase.validate(
    dbPath = "/path/to/exported-journey.db",
    pickupLat = 5.5620,
    pickupLng = -0.2050,
    destLat = 5.6200,
    destLng = -0.0170,
)
```

## Build Local AAR

```bash
./gradlew :mateapp-core:assembleRelease
```

The AAR will be at:\
`mateapp-core/build/outputs/aar/mateapp-core-release.aar`

To use the AAR in your Android app:

```gradle
// Copy mateapp-core-release.aar into app/libs/
// In app/build.gradle.kts:
dependencies {
    implementation(files("libs/mateapp-core-release.aar"))
}
```

## JitPack Distribution

1. Push this repo to GitHub
2. Tag a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. Add JitPack repository to your Android app:

```gradle
repositories {
    maven { url = uri("https://jitpack.io") }
}
```

4. Add dependency:

```gradle
dependencies {
    implementation("com.github.YOUR_USERNAME:mateapp-core-android:1.0.0")
}
```

Replace `YOUR_USERNAME` with your GitHub username.

## API

### `MateAppDatabase` (Builder + convenience)

**Instance methods (from `Builder().build()`):**

| Method | Description |
|--------|-------------|
| `validate(pickupLat, pickupLng, destLat, destLng)` | Validates using the configured dbPath. Opens/closes DB per call. |
| `useDatabase(dbPath)` | Switch to a different exported .db on the same client |
| `getDatabasePath()` | Returns the currently configured path |
| `getSchemaVersion()` | Reads schema version from `_meta` |
| `getSourceJourneyId()` | Reads journey ID from `_meta` |

**Static methods (one-off):**

| Method | Description |
|--------|-------------|
| `validate(dbPath, pickupLat, pickupLng, destLat, destLng)` | One-liner open → validate → close |
| `openDb(dbPath)` | Opens exported .db in read-only mode |
| `closeDb(db)` | Closes safely if open |
| `getSchemaVersion(dbPath)` | Reads schema version from `_meta` |
| `getSourceJourneyId(dbPath)` | Reads `source_journey_id` from `_meta` |

### `ValidationEngine.validate(db, pickupLat, pickupLng, destLat, destLng)`

Runs the full 7-step fare validation pipeline:

1. **Pickup stop** — finds nearest stop within 50m, or falls back to nearest stop within 25km
2. **Pickup area** — resolves from area_stop link, or by point-in-polygon
3. **Destination stop** — same as step 1
4. **Destination area** — same as step 2
5. **Journey** — finds journey containing both areas
6. **Fare calculation** — intra-area (distance match) or inter-area (journey fare lookup)
7. **Result** — returns `ValidationResult`

### `GeometryUtils`

| Method | Description |
|--------|-------------|
| `haversineDistance(lat1, lng1, lat2, lng2)` | Returns meters between two coordinates |
| `pointInPolygon(point, polygon)` | Ray-cast point-in-polygon test |
| `convexHull(points)` | Monotone chain convex hull |
| `polygonFromStops(stops)` | Convex hull from a list of stops |
| `polygonFromJson(json)` | Parses `[{"latitude":..,"longitude":..}]` JSON |

### `DatabaseReader`

| Method | Description |
|--------|-------------|
| `findByRadius(db, lat, lng, radiusMeters)` | Stops within a bounding box + Haversine filter |
| `findNearestStop(db, lat, lng)` | Progressive bounding box (1km → 5km → 25km), no full scan |
| `getAreaStopsByStop(db, stopId)` | Area_stops linked to a stop |
| `getArea(db, areaId)` | Area by ID |
| `getAllAreasWithPolygons(db)` | All areas with non-null polygon |
| `getAllJourneys(db)` | All journeys |
| `getJourneyAreas(db, journeyId)` | Journey areas ordered by sequence |
| `getBetweenAreasFare(db, journeyId, fromAreaId, toAreaId)` | Journey fare between two areas |
| `getFareLevelsByJourney(db, journeyId)` | Fare levels for a journey (sorted by amount) |
| `getFareLevelsByArea(db, areaId)` | Fare levels linked to an area (sorted by amount) |

## Database Schema

Opens any SQLite `.db` file created by MateApp (schema version 5). Tables:

`journeys`, `areas`, `stops`, `fare_levels`, `area_fare_levels`, `area_stops`, `journey_areas`, `journey_fares`, `track_points`, `validation_logs`

## License

MIT
