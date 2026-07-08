# 01 - Project Overview

## Purpose

The Route Mapping application is an offline-first Expo React Native
application for collecting, managing and validating public transport
journey maps.

The application is intended for field mappers who physically travel
transport routes, record GPS data, define Areas and Stops, capture fare
information, and produce a structured transport network that can later
be used by a fare validation engine.

This first version is designed to work completely offline using SQLite.
Synchronization with a backend is intentionally deferred until a later
phase.

------------------------------------------------------------------------

# Objectives

The application should enable a mapper to:

-   Create and manage Journeys.
-   Reuse existing Areas and Stops where possible.
-   Record Track Points while travelling.
-   Build Area polygons automatically from Stops.
-   Capture inter-area fares during mapping.
-   Capture intra-area fare levels.
-   Validate two GPS coordinates to determine:
    -   Journey
    -   Pickup Area
    -   Pickup Stop
    -   Destination Area
    -   Destination Stop
    -   Correct fare
-   Export collected data to CSV and XLSX.

------------------------------------------------------------------------

# Design Principles

## Offline First

All functionality must work without internet access.

The SQLite database is the source of truth.

Synchronization will be introduced later without changing the domain
model.

------------------------------------------------------------------------

## GPS Driven

Almost every mapping activity is driven by GPS.

Manual data entry is kept to the minimum necessary, mainly:

-   Journey name
-   Area name
-   Stop label
-   Fare amounts

------------------------------------------------------------------------

## Reuse Before Create

The application should always try to reuse existing data before allowing
new records.

Examples:

-   Existing Stop within radius → reuse it.
-   Existing Area containing the location → recommend it.

This reduces duplication while still allowing mapper judgement.

------------------------------------------------------------------------

## Simple Mapping Experience

The mapper should focus on travelling the Journey rather than managing
data.

The application should automate wherever possible:

-   GPS recording
-   Polyline generation
-   Polygon generation
-   Journey progress
-   Validation suggestions

------------------------------------------------------------------------

## Accurate Validation

The validation engine should never guess fares.

If a Journey cannot be determined, the result should clearly state:

"Journey not found"

rather than estimating a fare.

------------------------------------------------------------------------

## Continuous Improvement

Validation should generate useful diagnostic information.

Examples include:

-   Unknown Stops
-   GPS outside mapped Areas
-   Closest matched Stop
-   Journey not found

These logs become future mapping tasks.

------------------------------------------------------------------------

# Target Platform

-   Expo Managed Workflow
-   React Native
-   TypeScript
-   SQLite
-   Offline only (Version 1)

------------------------------------------------------------------------

# Out of Scope (Version 1)

The following are intentionally excluded:

-   Cloud synchronization
-   Multi-user collaboration
-   Authentication
-   Backend APIs
-   Vehicle assignment
-   Live tracking
-   Historical fare versioning

These may be added in later phases after the offline mapping workflow
has been validated.

------------------------------------------------------------------------

# Documentation Structure

This document is the first in a series of design documents.

1.  Project Overview
2.  Domain Model
3.  Business Rules
4.  Database Schema
5.  Validation Engine
6.  Mapping Workflow
7.  React Native Architecture
8.  UI/UX Design
9.  Export & Import
10. Synchronization Design
11. API Design
12. Future Enhancements
