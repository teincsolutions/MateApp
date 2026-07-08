# 05 - Validation Engine

## Purpose

Resolve two GPS coordinates into:

-   Journey
-   Pickup Area
-   Pickup Stop
-   Destination Area
-   Destination Stop
-   Fare
-   Diagnostics

------------------------------------------------------------------------

# Validation Pipeline

1.  Match Pickup Stop
2.  Resolve Pickup Area
3.  Match Destination Stop
4.  Resolve Destination Area
5.  Resolve Journey
6.  Calculate Fare
7.  Return Diagnostics

------------------------------------------------------------------------

# Stop Matching

-   Search by radius.
-   If multiple Stops match:
    -   Closest Stop wins.
-   If none:
    -   Find nearest Stop inside matched Area.
    -   Mark as estimated.

------------------------------------------------------------------------

# Area Matching

-   Use stored polygon.
-   Multiple candidate Areas may be returned.
-   Mapping uses recommendation.
-   Validation uses resolved Area.

------------------------------------------------------------------------

# Journey Resolution

Journey must contain:

Pickup Area ↓

Destination Area

in valid sequence.

Journey is bidirectional.

If no Journey exists:

Result: Journey Not Found

No fare returned.

------------------------------------------------------------------------

# Fare Resolution

Case 1

Pickup Area != Destination Area

Return JourneyFare.

Case 2

Pickup Area == Destination Area

Use destination Stop's AreaFareLevel.

Return AreaFareLevel amount.

------------------------------------------------------------------------

# Diagnostics

Every validation returns:

-   Journey
-   Pickup Area
-   Pickup Stop
-   Destination Area
-   Destination Stop
-   Fare
-   Estimated Stop flag
-   Confidence
-   Notes

------------------------------------------------------------------------

# Logging

Unknown Stops: - Save GPS. - Save nearest Stop. - Save nearest Area.

Journey failures: - Save validation attempt.

Purpose: Continuously improve mapping quality.

------------------------------------------------------------------------

# Design Principles

-   Never guess fares.
-   Never create Stops automatically.
-   Prefer deterministic results.
-   Always explain why a fare was returned.
