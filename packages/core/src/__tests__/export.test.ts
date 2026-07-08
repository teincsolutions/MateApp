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
import { ExportService } from '@mateapp/core';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type Database from 'better-sqlite3';
import { seedTestData, type TestSeedData } from './helpers';

describe('ExportService', () => {
  let db: Database.Database;
  let service: ExportService;
  let seed: TestSeedData;

  beforeEach(async () => {
    db = getMemoryDatabase();
    seed = await seedTestData(db);

    service = new ExportService({
      journeyRepo: new JourneyRepository(db),
      areaRepo: new AreaRepository(db),
      stopRepo: new StopRepository(db),
      journeyAreaRepo: new JourneyAreaRepository(db),
      journeyFareRepo: new JourneyFareRepository(db),
      trackPointRepo: new TrackPointRepository(db),
      areaFareLevelRepo: new AreaFareLevelRepository(db),
      areaStopRepo: new AreaStopRepository(db),
      validationLogRepo: new ValidationLogRepository(db),
    });
  });

  afterEach(() => {
    db.close();
  });

  function writeAndReadXlsx(base64: string): XLSX.WorkBook {
    const buf = Buffer.from(base64, 'base64');
    const tmpFile = path.join(os.tmpdir(), `mateapp-test-${Date.now()}.xlsx`);
    fs.writeFileSync(tmpFile, buf);
    try {
      return XLSX.readFile(tmpFile);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  }

  describe('exportJourneyXlsx', () => {
    it('returns base64 and filename for a seeded journey', async () => {
      const result = await service.exportJourneyXlsx(seed.journey.id);
      expect(result).not.toBeNull();
      expect(result!.base64).toBeTruthy();
      expect(typeof result!.base64).toBe('string');
      expect(result!.fileName).toBe('journey_Kejetia___Suame.xlsx');
    });

    it('produces parseable XLSX with expected sheets', async () => {
      const result = await service.exportJourneyXlsx(seed.journey.id);
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);
      const sheetNames = wb.SheetNames;
      expect(sheetNames).toContain('Journey');
      expect(sheetNames).toContain('JourneyAreas');
      expect(sheetNames).toContain('Areas');
      expect(sheetNames).toContain('Stops');
      expect(sheetNames).toContain('Fares');
      expect(sheetNames).toContain('FareLevels');
      expect(sheetNames).toContain('TrackPoints');
    });

    it('has correct row counts in sheets', async () => {
      const result = await service.exportJourneyXlsx(seed.journey.id);
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);

      const journeySheet = wb.Sheets['Journey'];
      const journeyData = XLSX.utils.sheet_to_json(journeySheet, { header: 1 }) as unknown[][];
      expect(journeyData.length).toBe(2);

      const journeyAreasSheet = wb.Sheets['JourneyAreas'];
      const jaData = XLSX.utils.sheet_to_json(journeyAreasSheet, { header: 1 }) as unknown[][];
      expect(jaData.length).toBe(4);

      const trackPointsSheet = wb.Sheets['TrackPoints'];
      const tpData = XLSX.utils.sheet_to_json(trackPointsSheet, { header: 1 }) as unknown[][];
      expect(tpData.length).toBe(12);
    });

    it('returns null for non-existent journey', async () => {
      const result = await service.exportJourneyXlsx('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('exportMasterXlsx', () => {
    it('returns base64 and filename', async () => {
      const result = await service.exportMasterXlsx();
      expect(result).not.toBeNull();
      expect(result!.base64).toBeTruthy();
      expect(result!.fileName).toBe('mateapp_master_export.xlsx');
    });

    it('produces parseable XLSX with expected sheets', async () => {
      const result = await service.exportMasterXlsx();
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);
      const sheetNames = wb.SheetNames;
      expect(sheetNames).toContain('Journeys');
      expect(sheetNames).toContain('Areas');
      expect(sheetNames).toContain('Stops');
      expect(sheetNames).toContain('ValidationLogs');
    });

    it('includes all journeys', async () => {
      const result = await service.exportMasterXlsx();
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);
      const journeysSheet = wb.Sheets['Journeys'];
      const journeysData = XLSX.utils.sheet_to_json(journeysSheet, { header: 1 }) as unknown[][];
      const rows = journeysData;
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('includes all areas', async () => {
      const result = await service.exportMasterXlsx();
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);
      const areasSheet = wb.Sheets['Areas'];
      const areasData = XLSX.utils.sheet_to_json(areasSheet, { header: 1 }) as unknown[][];
      const rows = areasData;
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('includes validation logs (empty initially)', async () => {
      const result = await service.exportMasterXlsx();
      expect(result).not.toBeNull();

      const wb = writeAndReadXlsx(result!.base64);
      const logsSheet = wb.Sheets['ValidationLogs'];
      const logsData = XLSX.utils.sheet_to_json(logsSheet, { header: 1 });
      expect(logsData.length).toBeGreaterThanOrEqual(1);
    });
  });
});
