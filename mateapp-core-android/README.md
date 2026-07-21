# mateapp-core-android

Kotlin validation library for MateApp's offline SQLite databases. Validates transport fares given pickup/destination coordinates.

## Usage

### One-liner validation (recommended)

```kotlin
val result = MateAppDatabase.validate(
    dbPath = "/path/to/exported-journey.db",
    pickupLat = 5.5620,
    pickupLng = -0.2050,
    destLat = 5.6200,
    destLng = -0.0170,
)

when (result.status) {
    ValidationStatus.SUCCESS -> println("Fare: GHS ${"%.2f".format(result.fare)}")
    ValidationStatus.STOP_NOT_FOUND -> println("Stop not found")
    ValidationStatus.JOURNEY_NOT_FOUND -> println("Journey not found")
    ValidationStatus.UNKNOWN -> println("Unknown error")
}
// Database is automatically opened and closed
```

### Manual lifecycle

```kotlin
val db = MateAppDatabase.open(pathToDb)
val result = ValidationEngine().validate(db, 5.5490, -0.2010, 5.5750, -0.2120)
MateAppDatabase.close(db)
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

### `MateAppDatabase` (convenience wrapper)

| Method | Description |
|--------|-------------|
| `open(dbPath)` | Opens exported .db in read-only mode |
| `close(db)` | Closes safely if open |
| `validate(dbPath, pickupLat, pickupLng, destLat, destLng)` | One-liner: open → validate → close |
| `getSchemaVersion(dbPath)` | Reads schema version from `_meta` table |
| `getSourceJourneyId(dbPath)` | Reads `source_journey_id` from `_meta` (present on exported journey .dbs) |

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
