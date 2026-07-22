# mateapp-core-android

Android/Kotlin library for offline fare validation against MateApp SQLite databases. Accepts pickup/destination coordinates and returns validated fare, route, and area information.

## Install

### JitPack

```gradle
// settings.gradle.kts or root build.gradle.kts
repositories {
    maven { url = uri("https://jitpack.io") }
}

// app/build.gradle.kts
dependencies {
    implementation("com.github.teincsolutions:MateApp:v1.0.0")
}
```

```groovy
// settings.gradle
repositories {
    maven { url "https://jitpack.io" }
}

// app/build.gradle
dependencies {
    implementation 'com.github.teincsolutions:MateApp:v1.0.0'
}
```

### Local AAR

```bash
./gradlew :mateapp-core:assembleRelease
# AAR at: mateapp-core/build/outputs/aar/mateapp-core-release.aar
```

```gradle
// app/build.gradle.kts
dependencies {
    implementation(files("libs/mateapp-core-release.aar"))
}
```

## Usage (Java)

```java
import com.mateapp.validation.MateAppDatabase;
import com.mateapp.validation.ValidationResult;
import com.mateapp.validation.ValidationStatus;
```

### One-off validation

```java
ValidationResult result = MateAppDatabase.validate(
    "/path/to/exported-journey.db",
    5.5620,   // pickupLat
    -0.2050,  // pickupLng
    5.6200,   // destLat
    -0.0170   // destLng
);

if (result.getStatus() == ValidationStatus.SUCCESS) {
    System.out.println("Fare: GHS " + String.format("%.2f", result.getFare()));
    System.out.println("Journey: " + result.getJourneyName());
    System.out.println("Pickup: " + result.getPickupAreaName() + " → " + result.getPickupStopLabel());
    System.out.println("Destination: " + result.getDestAreaName() + " → " + result.getDestStopLabel());
} else {
    System.out.println("Validation failed: " + result.getMessage());
}
```

### Builder pattern (reusable client)

```java
// imports same as above

MateAppDatabase mateApp = new MateAppDatabase.Builder()
MateAppDatabase mateApp = new MateAppDatabase.Builder()
    .dbPath("/path/to/exported-journey.db")
    .build();

// Reuse for multiple lookups — DB opens/closes per call
ValidationResult r1 = mateApp.validate(5.5620, -0.2050, 5.6200, -0.0170);
ValidationResult r2 = mateApp.validate(5.55, -0.20, 5.65, -0.01);

// Switch DB without creating a new client
mateApp.useDatabase("/path/to/another-export.db");
ValidationResult r3 = mateApp.validate(6.68, -1.62, 6.68, -1.62);
```

### Inspect metadata

```java
MateAppDatabase db = new MateAppDatabase.Builder()
    .dbPath("/path/to/export.db")
    .build();

int schemaVersion = db.getSchemaVersion();               // e.g. 5
String journeyIds = db.getSourceJourneyIds();             // e.g. "uuid-1,uuid-2"
String journeyId = db.getSourceJourneyId();               // single

// Static convenience
int version = MateAppDatabase.getSchemaVersion("/path/to/export.db");
String id = MateAppDatabase.getSourceJourneyId("/path/to/export.db");
String ids = MateAppDatabase.getSourceJourneyIds("/path/to/export.db");
```

### ValidationResult fields

```java
result.getStatus()          // ValidationStatus enum
result.getFare()            // Double? — null if not configured
result.getFareType()        // String? — "intra-area" or "journey" or null
result.getJourneyName()     // String?
result.getPickupAreaName()  // String?
result.getPickupStopLabel() // String?
result.getDestAreaName()    // String?
result.getDestStopLabel()   // String?
result.getEstimatedPickup() // boolean — true if nearest stop >50m
result.getEstimatedDest()   // boolean
result.getMessage()         // String — human-readable summary
```

### ValidationStatus enum

```java
ValidationStatus.SUCCESS             // Fare found
ValidationStatus.STOP_NOT_FOUND      // No stop within 25km
ValidationStatus.JOURNEY_NOT_FOUND   // No journey linking both areas
ValidationStatus.UNKNOWN             // Unexpected error
```

## Usage (Kotlin)

### One-off

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
```

### Builder

```kotlin
val mateApp = MateAppDatabase.Builder()
    .dbPath("/path/to/exported-journey.db")
    .build()

val result = mateApp.validate(5.5620, -0.2050, 5.6200, -0.0170)

mateApp.useDatabase("/path/to/another.db")
val result2 = mateApp.validate(6.68, -1.62, 6.68, -1.62)
```

## CLI (headless)

For scripting/CI — runs as a Gradle test and prints JSON to stdout:

```bash
./gradlew :mateapp-core:testDebugUnitTest --tests "*ValidationCLITest" \
  -DdbPath=/path/to/export.db \
  -DpickupLat=6.7386 -DpickupLng=-1.5057 \
  -DdestLat=6.6947 -DdestLng=-1.6156
```

Output:

```
=== VALIDATION_RESULT ===
{
  "status": "SUCCESS",
  "fare": 3,
  "fareType": "journey",
  "journeyName": "Roman Hill to Tikrom",
  "pickupAreaName": "Baworo",
  "pickupStopLabel": "Ahenfie Last Stop",
  ...
}
=== END_VALIDATION_RESULT ===
```

## API Reference

### `MateAppDatabase.Builder`

| Method | Description |
|--------|-------------|
| `.dbPath(String)` | Set path to exported `.db` file |
| `.build()` | Build the instance |

### `MateAppDatabase` instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `validate(double, double, double, double)` | `ValidationResult` | Validate fare (pickupLat, pickupLng, destLat, destLng). Opens/closes DB per call. |
| `useDatabase(String)` | `void` | Switch to a different `.db` on same client |
| `getDatabasePath()` | `String` | Currently configured path |
| `getSchemaVersion()` | `int` | Schema version from `_meta` table |
| `getSourceJourneyId()` | `String?` | Single journey ID from `_meta` |
| `getSourceJourneyIds()` | `String?` | Comma-separated journey IDs from `_meta` |

### `MateAppDatabase` static methods

| Method | Returns | Description |
|--------|---------|-------------|
| `validate(String, double, double, double, double)` | `ValidationResult` | One-shot open → validate → close |
| `openDb(String)` | `SQLiteDatabase` | Open read-only |
| `closeDb(SQLiteDatabase)` | `void` | Close if open |
| `getSchemaVersion(String)` | `int` | Schema version by path |
| `getSourceJourneyId(String)` | `String?` | Single journey ID by path |
| `getSourceJourneyIds(String)` | `String?` | Comma-separated IDs by path |

### `ValidationEngine`

```java
ValidationResult result = ValidationEngine.validate(
    database,          // SQLiteDatabase (opened read-only)
    5.5620, -0.2050,  // pickup
    5.6200, -0.0170   // destination
);
```

7-step pipeline:

1. **Pickup stop** — nearest stop within 50m, or fallback within 25km
2. **Pickup area** — from `area_stops` link or point-in-polygon
3. **Destination stop** — same as step 1
4. **Destination area** — same as step 2
5. **Journey** — find journey containing both areas
6. **Fare** — intra-area (distance-match) or inter-area (journey fare lookup)
7. **Result** — package into `ValidationResult`

### `GeometryUtils`

| Method | Description |
|--------|-------------|
| `haversineDistance(lat1, lng1, lat2, lng2)` | Meters between two coordinates |
| `pointInPolygon(LatLng, List<LatLng>)` | Ray-cast point-in-polygon |
| `convexHull(List<LatLng>)` | Monotone chain convex hull |
| `polygonFromStops(List<Stop>)` | Convex hull from stops |
| `polygonFromJson(String)` | Parse `[{"latitude":..,"longitude":..}]` JSON (uses Regex, not org.json) |

### `DatabaseReader`

| Method | Description |
|--------|-------------|
| `findByRadius(db, lat, lng, radiusMeters)` | Stops within bounding box + Haversine |
| `findNearestStop(db, lat, lng)` | Progressive bounding box (1km → 5km → 25km) |
| `getAreaStopsByStop(db, stopId)` | area_stops for a stop |
| `getArea(db, areaId)` | Area by ID |
| `getAllAreasWithPolygons(db)` | Areas with non-null polygon |
| `getAllJourneys(db)` | All journeys |
| `getJourneyAreas(db, journeyId)` | Journey areas ordered by sequence |
| `getBetweenAreasFare(db, journeyId, fromAreaId, toAreaId)` | Journey fare between areas |
| `getFareLevelsByJourney(db, journeyId)` | Fare levels for a journey (by amount) |
| `getFareLevelsByArea(db, areaId)` | Fare levels linked to an area (by amount) |

## Schema

Opens any SQLite `.db` file created by MateApp (schema version 5). Tables:

`journeys`, `areas`, `stops`, `fare_levels`, `area_fare_levels`, `area_stops`, `journey_areas`, `journey_fares`, `track_points`, `validation_logs`, `_meta`

## License

MIT
