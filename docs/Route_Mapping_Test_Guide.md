# Route Mapping Application - Mapping & Validation Test Guide

## Purpose

Testing guide for mapping, validation, pricing and recovery.

## 1. Journey Mapping

### JM-001 Create Journey

-   Journey name required.
-   Draft status.
-   UUID generated.

### JM-002 Resume Journey

-   Restore Journey.
-   Restore current Area.
-   Resume GPS tracking.
-   Continue TrackPoint sequence.

## 2. Area

### AR-001 Create First Area

-   First GPS becomes first Stop.
-   Area cannot exist without first Stop.
-   Polygon starts from first Stop.

### AR-002 Existing Area

-   Recommend reuse.
-   Allow override.

### AR-003 Duplicate Area Name

-   Reject duplicate.

### AR-004 Area Expansion

-   Polygon recalculated after every Stop.

## 3. Stops

### ST-001 Create Stop

-   Save Stop.
-   Add to Area.
-   Update polygon.

### ST-002 Duplicate Stop

-   Inside radius → reuse existing Stop.

### ST-003 New Stop

-   Outside radius → create.

### ST-004 Stop Label

-   Required.

### ST-005 Fare Level

-   Every Stop references an Area Fare Level.
-   Default = Minimum.

### ST-006 New Fare Level

-   Future Stops use it.
-   Existing Stops unchanged.

## 4. Journey Progression

### JP-001 Area B

Require A→B fare.

### JP-002 Area C

Require A→C and B→C fares.

### JP-003 Area D

Require A→D, B→D, C→D fares.

### JP-004 Complete Journey

Minimum two Areas.

### JP-005 Resume

Continue only from last Area.

### JP-006 Missed Stop

Mapper must physically return.

## 5. GPS

-   Poor accuracy warning.
-   Pause when GPS unavailable.
-   Ignore abnormal jumps.
-   Auto-record TrackPoints.

## 6. Pricing

### Different Areas

Use JourneyFare only.

### Same Area

Use Area Fare Level only.

### Extended Fare

Return extended amount.

### Minimum Fare

Return minimum amount.

Missing JourneyFare → Validation error.

Missing AreaFareLevel → Validation error.

## 7. Validation

-   Inside Stop radius → matched.
-   Multiple Stops → nearest wins.
-   Unknown Stop → nearest Stop in Area, mark Estimated.
-   Unknown Area → fail.
-   Journey exists → resolve direction.
-   No Journey → Journey Not Found.

## 8. Data Integrity

-   Reject duplicate UUIDs.
-   Reject duplicate JourneyArea sequences.
-   Reject duplicate JourneyFare.
-   Reject duplicate AreaStop.
-   Reject duplicate TrackPoint sequence.

## 9. Recovery

-   Resume after crash.
-   Resume after battery loss.
-   Rollback failed imports.
-   Prevent partial exports.

## 10. Logging

Capture: - Unknown Stops - Estimated Stops - GPS - Nearest Area -
Nearest Stop - Distance - Timestamp

## 11. Ghana Scenarios

### Passing Through Area

A→B→C, passenger travels A→C. Expected fare = A→C.

### Large Area

Same Area with multiple Fare Levels. Same-area validation uses Area Fare
Level. Inter-area validation ignores Fare Levels.
