# 02 - Domain Model

## Purpose

This document defines the core business objects and their relationships.
These are business concepts, not database tables.

------------------------------------------------------------------------

# Journey

A Journey is the advertised transport destination (e.g. Kejetia ↔
Suame).

Responsibilities: - Represents both travel directions. - Owns ordered
JourneyAreas. - Owns JourneyFares. - Owns TrackPoints.

Does NOT own: - Stops - Areas

------------------------------------------------------------------------

# Area

A fare area recognised by passengers and transport operators.

Characteristics: - Global object reusable by many Journeys. - Polygon is
automatically derived from Stops. - Begins with its first Stop. -
Expands automatically as Stops are added.

------------------------------------------------------------------------

# Stop

A physical bus stop.

Characteristics: - GPS coordinate. - Matching radius. - Human readable
label. - Can be referenced by multiple Areas. - References exactly one
Fare Level within each Area.

------------------------------------------------------------------------

# JourneyArea

Represents an Area within a Journey.

Responsibilities: - Maintains sequence. - Enables forward and reverse
validation. - Links Journey to reusable Areas.

Example

Journey: Kejetia ↔ Suame

Sequence: 1. Kejetia 2. Ashtown 3. Suame

------------------------------------------------------------------------

# JourneyFare

Defines travel fare between two JourneyAreas.

Example

Kejetia → Ashtown Kejetia → Suame Ashtown → Suame

Only one direction is stored because Journey is bidirectional.

------------------------------------------------------------------------

# AreaFareLevel

Represents pricing inside an Area.

Typical levels: - Minimum - Extended

Unlimited levels are supported.

------------------------------------------------------------------------

# TrackPoint

Automatically recorded GPS point.

Purpose: - Draw Journey polyline. - Visual mapping. - Future GIS export.

Not used directly for fare calculation.

------------------------------------------------------------------------

# ValidationLog

Stores diagnostics produced by validation.

Examples: - Unknown Stop - Journey not found - GPS outside mapped Area -
Closest matched Stop

------------------------------------------------------------------------

# Relationships

Journey └── JourneyArea

JourneyArea └── Area

Journey └── JourneyFare

Area ├── AreaFareLevel └── AreaStop

AreaStop └── Stop

Journey └── TrackPoint

Validation ├── Journey ├── Area └── Stop
