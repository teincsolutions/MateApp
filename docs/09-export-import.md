# 09 - Export & Import

## Purpose

Allow collected mapping data to be moved between devices and reviewed
externally.

------------------------------------------------------------------------

# Supported Formats

Export: - CSV - XLSX

Future: - GeoJSON - KML

------------------------------------------------------------------------

# Journey Export

One workbook per Journey.

Suggested sheets: - Journey - Areas - Stops - JourneyAreas -
JourneyFares - FareLevels - TrackPoints

------------------------------------------------------------------------

# Master Export

Entire SQLite dataset.

Includes: - All Journeys - All Areas - All Stops - All Fares -
Validation Logs

------------------------------------------------------------------------

# CSV Rules

-   UTF-8
-   Header row required
-   ISO date format
-   Decimal coordinates

------------------------------------------------------------------------

# Import

Validate: - UUID uniqueness - Missing references - Duplicate Stops -
Duplicate Areas - Invalid coordinates

Reject invalid rows with clear error messages.

------------------------------------------------------------------------

# Versioning

Every export contains: - Schema version - Export date - Application
version

Allows future compatibility checks.

------------------------------------------------------------------------

# Future Enhancements

-   Password protected exports
-   Incremental exports
-   Sync package exports
-   GIS exports
