# 03 - Business Rules

## Journey

-   Journey represents both directions.
-   Journey must contain at least two Areas.
-   Journey may be reopened and extended.
-   Extension always continues from the end.

------------------------------------------------------------------------

## Area

-   Area is created together with its first Stop.
-   Area polygon grows automatically.
-   Existing Area inside polygon is suggested, not forced.
-   Area is reusable across Journeys.

------------------------------------------------------------------------

## Stop

-   Stop is identified by GPS and radius.
-   Existing Stop inside radius must be reused.
-   Duplicate Stops inside radius are not allowed.
-   Every Stop must have a label.
-   Every Stop must reference a Fare Level through AreaStop.

------------------------------------------------------------------------

## Pricing

Inter-area: - Use JourneyFare only.

Intra-area: - Use AreaFareLevel only.

Fare Levels: - Unlimited supported. - Usually Minimum and Extended.

JourneyFare: - Overwrite on updates. - No history in Version 1.

------------------------------------------------------------------------

## Mapping

-   Offline only.
-   GPS driven.
-   TrackPoints recorded automatically.
-   Stops captured manually.
-   Journey fares entered before continuing.
-   Mapper must physically return to add a missed Stop.

------------------------------------------------------------------------

## Validation

Order: 1. Match Stop. 2. Match Area. 3. Resolve Journey. 4. Calculate
fare.

Rules: - Closest Stop wins. - Unknown Stop falls back to nearest Stop. -
Unknown Stops are logged. - No Journey = Journey Not Found. - Validator
never estimates fares.

------------------------------------------------------------------------

## Data Integrity

-   UUID for every entity.
-   SQLite is source of truth.
-   Reuse before create.
-   Derived geometry is stored for performance.
