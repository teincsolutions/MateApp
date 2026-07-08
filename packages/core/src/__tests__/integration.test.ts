import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMemoryDatabase } from '@mateapp/db-node';
import {
  JourneyRepository,
  AreaRepository,
  StopRepository,
  AreaFareLevelRepository,
  AreaStopRepository,
  JourneyAreaRepository,
  JourneyFareRepository,
  TrackPointRepository,
  ValidationLogRepository,
} from '@mateapp/db-node';
import { ValidationService, ExportService } from '@mateapp/core';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type Database from 'better-sqlite3';

describe('Integration: End-to-End Workflow', () => {
  let db: Database.Database;
  let journeyRepo: JourneyRepository;
  let areaRepo: AreaRepository;
  let stopRepo: StopRepository;
  let fareLevelRepo: AreaFareLevelRepository;
  let areaStopRepo: AreaStopRepository;
  let journeyAreaRepo: JourneyAreaRepository;
  let journeyFareRepo: JourneyFareRepository;
  let trackPointRepo: TrackPointRepository;
  let validationLogRepo: ValidationLogRepository;
  let validationService: ValidationService;
  let exportService: ExportService;

  beforeEach(() => {
    db = getMemoryDatabase();
    journeyRepo = new JourneyRepository(db);
    areaRepo = new AreaRepository(db);
    stopRepo = new StopRepository(db);
    fareLevelRepo = new AreaFareLevelRepository(db);
    areaStopRepo = new AreaStopRepository(db);
    journeyAreaRepo = new JourneyAreaRepository(db);
    journeyFareRepo = new JourneyFareRepository(db);
    trackPointRepo = new TrackPointRepository(db);
    validationLogRepo = new ValidationLogRepository(db);

    validationService = new ValidationService({
      stopRepo,
      areaRepo,
      journeyAreaRepo,
      journeyFareRepo,
      areaStopRepo,
      areaFareLevelRepo: fareLevelRepo,
      journeyRepo,
      validationLogRepo,
    });

    exportService = new ExportService({
      journeyRepo,
      areaRepo,
      stopRepo,
      journeyAreaRepo,
      journeyFareRepo,
      trackPointRepo,
      areaFareLevelRepo: fareLevelRepo,
      areaStopRepo,
      validationLogRepo,
    });
  });

  afterEach(() => {
    db.close();
  });

  function writeAndReadXlsx(base64: string): XLSX.WorkBook {
    const buf = Buffer.from(base64, 'base64');
    const tmpFile = path.join(os.tmpdir(), `mateapp-integration-${Date.now()}.xlsx`);
    fs.writeFileSync(tmpFile, buf);
    try {
      return XLSX.readFile(tmpFile);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  }

  it('full workflow: create, link, validate, export, complete, reopen, extend, re-validate, master export', async () => {
    // Step 1: Create journey "Test Route"
    const journey = await journeyRepo.create('Test Route');
    expect(journey.name).toBe('Test Route');
    expect(journey.status).toBe('draft');

    // Step 2: Create 2 areas with stops
    const area1 = await areaRepo.create('Downtown');
    const area2 = await areaRepo.create('Airport');

    const stop1a = await stopRepo.create('Downtown Station', 5.5500, -0.2000);
    const stop1b = await stopRepo.create('Downtown Market', 5.5510, -0.2010);

    const stop2a = await stopRepo.create('Airport Terminal', 5.6000, -0.2500);
    const stop2b = await stopRepo.create('Airport Gate', 5.6010, -0.2510);

    const fl1 = await fareLevelRepo.create(area1.id, 'Minimum', 0, 2.00);
    const fl2 = await fareLevelRepo.create(area2.id, 'Minimum', 0, 3.00);

    await areaStopRepo.create(area1.id, stop1a.id, fl1.id);
    await areaStopRepo.create(area1.id, stop1b.id, fl1.id);
    await areaStopRepo.create(area2.id, stop2a.id, fl2.id);
    await areaStopRepo.create(area2.id, stop2b.id, fl2.id);

    // Step 3: Link areas to journey
    const ja1 = await journeyAreaRepo.create(journey.id, area1.id, 1);
    const ja2 = await journeyAreaRepo.create(journey.id, area2.id, 2);

    const journeyAreas = await journeyAreaRepo.getByJourney(journey.id);
    expect(journeyAreas).toHaveLength(2);

    // Step 4: Set inter-area fares
    await journeyFareRepo.create(journey.id, ja1.id, ja2.id, 7.00);
    await journeyFareRepo.create(journey.id, ja2.id, ja1.id, 7.00);

    const fares = await journeyFareRepo.getByJourney(journey.id);
    expect(fares).toHaveLength(2);

    // Step 5: Record track points
    await trackPointRepo.create(journey.id, ja1.id, 1, 5.5500, -0.2000);
    await trackPointRepo.create(journey.id, ja1.id, 2, 5.5550, -0.2050);
    await trackPointRepo.create(journey.id, null, 3, 5.5650, -0.2150);
    await trackPointRepo.create(journey.id, ja2.id, 4, 5.5750, -0.2250);
    await trackPointRepo.create(journey.id, ja2.id, 5, 5.6000, -0.2500);

    const trackPoints = await trackPointRepo.getByJourney(journey.id);
    expect(trackPoints).toHaveLength(5);

    // Step 6: Validate fare between two stops
    const validation1 = await validationService.validate(5.5500, -0.2000, 5.6000, -0.2500);
    expect(validation1.status).toBe('success');
    expect(validation1.fare).toBe(7.00);
    expect(validation1.fareType).toBe('journey');
    expect(validation1.journey!.id).toBe(journey.id);

    // Step 7: Export journey as XLSX
    const journeyExport = await exportService.exportJourneyXlsx(journey.id);
    expect(journeyExport).not.toBeNull();
    expect(journeyExport!.fileName).toBe('journey_Test_Route.xlsx');

    const wb1 = writeAndReadXlsx(journeyExport!.base64);
    expect(wb1.SheetNames).toContain('Journey');
    expect(wb1.SheetNames).toContain('TrackPoints');

    // Step 8: Complete journey
    await journeyRepo.updateStatus(journey.id, 'completed', area2.id);
    const completed = await journeyRepo.getById(journey.id);
    expect(completed!.status).toBe('completed');
    expect(completed!.end_area_id).toBe(area2.id);

    // Step 9: Reopen journey
    await journeyRepo.updateStatus(journey.id, 'draft');
    const reopened = await journeyRepo.getById(journey.id);
    expect(reopened!.status).toBe('draft');

    // Step 10: Add a 3rd area
    const area3 = await areaRepo.create('Suburb');
    const stop3a = await stopRepo.create('Suburb Station', 5.6500, -0.3000);
    const fl3 = await fareLevelRepo.create(area3.id, 'Minimum', 0, 2.50);
    await areaStopRepo.create(area3.id, stop3a.id, fl3.id);

    const ja3 = await journeyAreaRepo.create(journey.id, area3.id, 3);
    await journeyFareRepo.create(journey.id, ja2.id, ja3.id, 4.00);
    await journeyFareRepo.create(journey.id, ja3.id, ja2.id, 4.00);

    const allAreas = await journeyAreaRepo.getByJourney(journey.id);
    expect(allAreas).toHaveLength(3);

    // Step 11: Validate again with 3rd area
    const validation2 = await validationService.validate(5.6000, -0.2500, 5.6500, -0.3000);
    expect(validation2.status).toBe('success');
    expect(validation2.fare).toBe(4.00);
    expect(validation2.journey!.id).toBe(journey.id);

    // Also validate original route still works
    const validation3 = await validationService.validate(5.5500, -0.2000, 5.6000, -0.2500);
    expect(validation3.status).toBe('success');
    expect(validation3.fare).toBe(7.00);

    // Intra-area Downtown
    const validationIntra = await validationService.validate(5.5500, -0.2000, 5.5510, -0.2010);
    expect(validationIntra.fareType).toBe('area');

    // Step 12: Export master
    const masterExport = await exportService.exportMasterXlsx();
    expect(masterExport).not.toBeNull();
    expect(masterExport!.fileName).toBe('mateapp_master_export.xlsx');

    const wb2 = writeAndReadXlsx(masterExport!.base64);
    expect(wb2.SheetNames).toContain('Journeys');
    expect(wb2.SheetNames).toContain('Areas');
    expect(wb2.SheetNames).toContain('Stops');
    expect(wb2.SheetNames).toContain('ValidationLogs');

    // Verify validation logs were created
    const logs = await validationLogRepo.getAll();
    expect(logs.length).toBeGreaterThanOrEqual(4);
  });
});
