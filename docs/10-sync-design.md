# 10 - Synchronization Design

## Status

Synchronization is **not part of Version 1**.

The application is offline-only. This document captures the future
direction so current design decisions remain compatible.

## Principles

-   SQLite remains the local source of truth.
-   Every entity uses a UUID.
-   Sync must not require schema changes.
-   Sync operates per database (e.g. Trotro DB, Taxi DB).

## Sync Units

-   Journey
-   Area
-   Stop
-   JourneyArea
-   JourneyFare
-   AreaFareLevel
-   AreaStop
-   TrackPoint
-   ValidationLog

## Conflict Strategy

Automatic: - TrackPoints (merge) - ValidationLogs (append)

Manual review: - Area name conflicts - Stop conflicts - Journey fare
conflicts - Area fare level conflicts

## Conflict Detection

Compare: - UUID - Updated timestamp - Geometry - Relationships

## Future Workflow

1.  Export sync package
2.  Upload/download
3.  Detect conflicts
4.  Review conflicts
5.  Merge
6.  Update local database

## Notes

No cloud dependency is assumed. Synchronization may initially occur
through exported files.
