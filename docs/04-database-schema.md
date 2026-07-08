# 04 - Database Schema

## Purpose

Defines the SQLite schema for the offline-first application.

Design goals:

-   UUID primary keys.
-   Optimized for offline validation.
-   Normalized where appropriate.
-   Store derived geometry for fast lookups.

------------------------------------------------------------------------

# Journey

  Column          Notes
  --------------- --------------------------------
  id              UUID PK
  name            Display name (Kejetia ↔ Suame)
  start_area_id   FK Area
  end_area_id     FK Area
  status          Draft, Completed
  created_at      Timestamp
  updated_at      Timestamp

Indexes: - name - status

------------------------------------------------------------------------

# Area

  Column       Notes
  ------------ ------------------------------
  id           UUID
  name         Unique display name
  polygon      Stored polygon (GeoJSON/WKT)
  created_at   Timestamp
  updated_at   Timestamp

Indexes: - name

------------------------------------------------------------------------

# Stop

  Column       Notes
  ------------ --------------------------
  id           UUID
  label        Passenger-visible name
  latitude     REAL
  longitude    REAL
  radius       Matching radius (meters)
  created_at   Timestamp
  updated_at   Timestamp

Indexes: - latitude - longitude

------------------------------------------------------------------------

# AreaFareLevel

  Column     Notes
  ---------- -------------------------
  id         UUID
  area_id    FK Area
  label      Minimum, Extended, etc.
  order_no   Display order
  amount     Decimal

Composite index: - area_id + order_no

------------------------------------------------------------------------

# AreaStop

  Column          Notes
  --------------- ------------------
  id              UUID
  area_id         FK Area
  stop_id         FK Stop
  fare_level_id   FK AreaFareLevel
  created_at      Timestamp
  updated_at      Timestamp

Composite indexes: - area_id + stop_id - stop_id

------------------------------------------------------------------------

# JourneyArea

  Column       Notes
  ------------ ---------------
  id           UUID
  journey_id   FK Journey
  area_id      FK Area
  sequence     Integer order
  created_at   Timestamp
  updated_at   Timestamp

Composite index: - journey_id + sequence

------------------------------------------------------------------------

# JourneyFare

  Column                 Notes
  ---------------------- ----------------
  id                     UUID
  journey_id             FK Journey
  from_journey_area_id   FK JourneyArea
  to_journey_area_id     FK JourneyArea
  amount                 Decimal
  created_at             Timestamp
  updated_at             Timestamp

Composite index: - journey_id + from_journey_area_id +
to_journey_area_id

------------------------------------------------------------------------

# TrackPoint

  Column            Notes
  ----------------- ----------------
  id                UUID
  journey_id        FK Journey
  journey_area_id   FK JourneyArea
  sequence          Integer
  latitude          REAL
  longitude         REAL
  created_at        Timestamp

Composite index: - journey_id + sequence

------------------------------------------------------------------------

# ValidationLog

Stores validation diagnostics and unknown stop reports.

Typical fields:

-   pickup coordinates
-   destination coordinates
-   matched stop ids
-   matched area ids
-   matched journey id
-   result status
-   message
-   created_at

------------------------------------------------------------------------

# General Rules

-   UUIDs everywhere.
-   Foreign keys enabled.
-   Soft deletes not required in V1.
-   Derived geometry stored for performance.
