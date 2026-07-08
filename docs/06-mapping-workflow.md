# 06 - Mapping Workflow

## Goal

Provide a consistent field workflow for collecting accurate transport
data with minimal user interaction.

## Workflow

1.  Open app
2.  Select **New Journey** or **Resume Journey**
3.  Enter Journey name
4.  Select/Create first Area
5.  First Stop is created automatically at current GPS
6.  GPS tracking starts automatically
7.  Track Points are continuously recorded
8.  Mapper adds Stops as they travel
9.  Area polygon expands automatically
10. When entering a new Area:

-   App checks for existing Stop
-   App checks for existing Area
-   Suggest reuse if applicable

11. If creating a new Area:

-   Current location becomes first Stop
-   Mapper enters fares from all previous Areas

12. Continue until destination
13. End Journey
14. Export or resume later

## Journey Lifecycle

Draft → Mapping → Completed → Reopened → Mapping → Completed

## Stop Workflow

Current GPS → Existing Stop? Yes → Reuse No → Create Stop

## Area Workflow

Current GPS → Existing Area? Suggest reuse OR Create new Area

## GPS Tracking

-   Starts automatically
-   Runs only during active mapping
-   Records Track Points at configured intervals or significant movement
-   Pauses when Journey is paused

## Recovery

After app restart: - Restore active Journey - Restore active Area -
Restore GPS tracking - Resume Track Point recording

## Export

Journey exports: - CSV - XLSX

Master export: - Entire database

## Mapping Principles

-   Offline only
-   Mapper stays focused on travelling
-   App automates GPS collection
-   Prevent duplicate Stops
-   Recommend Area reuse
-   Require fares before continuing
