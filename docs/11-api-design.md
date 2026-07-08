# 11 - Future Integration Design

## Status

There is **no backend in Version 1**.

This document exists only to ensure the mobile architecture remains
backend-ready.

## Guiding Principles

-   Mobile business logic must not depend on an API.
-   SQLite remains the primary data source.
-   Repository interfaces should make future backend integration
    transparent.

## Repository Pattern

The UI communicates only with repositories.

Future implementations may include: - SQLiteRepository (Version 1) -
RemoteRepository (future) - HybridRepository (future)

## Future Sync Contract

If a backend is introduced later it should exchange:

-   Journeys
-   Areas
-   Stops
-   Fare Levels
-   Journey Fares
-   Track Points
-   Validation Logs

using UUIDs.

## Current Decision

No HTTP APIs, authentication, server validation or online services are
implemented in Version 1.
