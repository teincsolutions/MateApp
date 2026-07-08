# 07 - React Native Architecture

## Platform

-   Expo Managed Workflow
-   React Native
-   TypeScript

## Core Libraries

-   expo-router
-   expo-sqlite
-   expo-location
-   react-native-maps
-   expo-file-system
-   xlsx
-   zustand
-   react-native-mmkv (settings/cache if needed)

## Folder Structure

app/ components/ features/ database/ repositories/ services/ stores/
types/ utils/

## Feature Modules

Journey Area Stop Mapping Validation Export

Each feature contains: - UI - Hooks - Repository - Services - Types

## State Management

JourneyStore - active journey - current area

MappingStore - GPS - tracking state - active stop

ValidationStore - validation result - diagnostics

SettingsStore - GPS interval - export options

## Repository Layer

Repositories isolate SQLite from UI.

Examples: - JourneyRepository - AreaRepository - StopRepository -
ValidationRepository

## Service Layer

GeometryService - distance - point-in-polygon - polygon generation

GPSService - tracking - filtering - permissions

ValidationService - fare resolution - stop matching

ExportService - CSV - XLSX

## Design Principles

-   Offline-first
-   Feature-based architecture
-   Repository pattern
-   Service isolation
-   UUID-based entities
-   Testable business logic
-   UI independent from database
