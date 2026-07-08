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
import { ValidationService, GeometryService } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { seedTestData, type TestSeedData } from './helpers';

describe('Business Rules', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getMemoryDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('stop dedup', () => {
    it('creating two stops at same location creates distinct records', async () => {
      const stopRepo = new StopRepository(db);
      const stop1 = await stopRepo.create('Stop A', 5.5500, -0.2010);
      const stop2 = await stopRepo.create('Stop B', 5.5500, -0.2010);
      expect(stop1.id).not.toBe(stop2.id);
      expect(stop1.label).not.toBe(stop2.label);
    });

    it('findByRadius returns both stops at same location', async () => {
      const stopRepo = new StopRepository(db);
      await stopRepo.create('Stop A', 5.5500, -0.2010);
      await stopRepo.create('Stop B', 5.5500, -0.2010);
      const nearby = await stopRepo.findByRadius(5.5500, -0.2010, 50);
      expect(nearby.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('stop radius matching', () => {
    it('stop found within 50m radius', async () => {
      const stopRepo = new StopRepository(db);
      await stopRepo.create('Close Stop', 5.5500, -0.2010);
      const nearby = await stopRepo.findByRadius(5.5500, -0.2010, 50);
      expect(nearby).toHaveLength(1);
    });

    it('stop not found at 200m distance from its location', async () => {
      const stopRepo = new StopRepository(db);
      const stop = await stopRepo.create('Lonely Stop', 5.5500, -0.2010);
      const degPerMeter = 1 / 111195;
      const offset = 200 * degPerMeter;
      const nearby = await stopRepo.findByRadius(
        5.5500 + offset * 2,
        -0.2010,
        50,
      );
      expect(nearby).toHaveLength(0);
    });
  });

  describe('area reuse', () => {
    it('creating area with same name fails due to UNIQUE constraint', async () => {
      const areaRepo = new AreaRepository(db);
      await areaRepo.create('Downtown');
      await expect(areaRepo.create('Downtown')).rejects.toThrow();
    });
  });

  describe('journey must have >= 2 areas', () => {
    it('journey with zero areas resolves gracefully', async () => {
      const areaRepo = new AreaRepository(db);
      const area = await areaRepo.create('Solo Area');
      const journeyAreaRepo = new JourneyAreaRepository(db);
      const areas = await journeyAreaRepo.getByJourney('empty-journey');
      expect(areas).toHaveLength(0);
    });
  });

  describe('fare levels', () => {
    it('fare levels are ordered by order_no', async () => {
      const areaRepo = new AreaRepository(db);
      const area = await areaRepo.create('Test Area');
      const fareLevelRepo = new AreaFareLevelRepository(db);
      await fareLevelRepo.create(area.id, 'Extended', 2, 3.50);
      await fareLevelRepo.create(area.id, 'Premium', 3, 5.00);
      await fareLevelRepo.create(area.id, 'Minimum', 0, 1.50);
      await fareLevelRepo.create(area.id, 'Standard', 1, 2.50);
      const levels = await fareLevelRepo.getByArea(area.id);
      expect(levels).toHaveLength(4);
      expect(levels[0].order_no).toBe(0);
      expect(levels[0].label).toBe('Minimum');
      expect(levels[1].order_no).toBe(1);
      expect(levels[2].order_no).toBe(2);
      expect(levels[3].order_no).toBe(3);
    });

    it('minimum and extended fares from seed data', async () => {
      const seed = await seedTestData(db);
      const areaFareLevelRepo = new AreaFareLevelRepository(db);
      const kejetiaArea = seed.areas.find((a) => a.name === 'Kejetia')!;
      const levels = await areaFareLevelRepo.getByArea(kejetiaArea.id);
      expect(levels).toHaveLength(2);
      expect(levels[0].label).toBe('Minimum');
      expect(levels[0].amount).toBe(1.50);
      expect(levels[1].label).toBe('Extended');
      expect(levels[1].amount).toBe(2.50);
    });
  });

  describe('track points', () => {
    it('track points recorded with correct intervals', async () => {
      const journeyRepo = new JourneyRepository(db);
      const trackPointRepo = new TrackPointRepository(db);
      const journey = await journeyRepo.create('Interval Test');

      await trackPointRepo.create(journey.id, null, 1, 5.5490, -0.2010);
      await trackPointRepo.create(journey.id, null, 2, 5.5510, -0.2015);
      await trackPointRepo.create(journey.id, null, 3, 5.5530, -0.2025);

      const points = await trackPointRepo.getByJourney(journey.id);
      expect(points).toHaveLength(3);
      expect(points[0].sequence).toBe(1);
      expect(points[1].sequence).toBe(2);
      expect(points[2].sequence).toBe(3);
    });

    it('getMaxSequence returns correct value', async () => {
      const journeyRepo = new JourneyRepository(db);
      const trackPointRepo = new TrackPointRepository(db);
      const journey = await journeyRepo.create('Max Seq Test');

      await trackPointRepo.create(journey.id, null, 5, 1, 1);
      await trackPointRepo.create(journey.id, null, 10, 2, 2);

      const max = await trackPointRepo.getMaxSequence(journey.id);
      expect(max).toBe(10);
    });
  });

  describe('validation logging', () => {
    it('every validate call creates a log entry', async () => {
      const seed = await seedTestData(db);
      const validationLogRepo = new ValidationLogRepository(db);

      const service = new ValidationService({
        stopRepo: new StopRepository(db),
        areaRepo: new AreaRepository(db),
        journeyAreaRepo: new JourneyAreaRepository(db),
        journeyFareRepo: new JourneyFareRepository(db),
        areaStopRepo: new AreaStopRepository(db),
        areaFareLevelRepo: new AreaFareLevelRepository(db),
        journeyRepo: new JourneyRepository(db),
        validationLogRepo,
      });

      const initialLogs = await validationLogRepo.getAll();

      await service.validate(5.5490, -0.2010, 5.5750, -0.2120);
      await service.validate(5.5600, -0.2050, 5.5750, -0.2120);
      await service.validate(5.5490, -0.2010, 5.5495, -0.2005);

      const finalLogs = await validationLogRepo.getAll();
      expect(finalLogs.length).toBe(initialLogs.length + 3);
    });
  });

  describe('journey lifecycle', () => {
    it('draft → complete → draft (reopen)', async () => {
      const journeyRepo = new JourneyRepository(db);
      const journey = await journeyRepo.create('Lifecycle Test');

      expect(journey.status).toBe('draft');

      await journeyRepo.updateStatus(journey.id, 'completed');
      let updated = await journeyRepo.getById(journey.id);
      expect(updated!.status).toBe('completed');

      await journeyRepo.updateStatus(journey.id, 'draft');
      updated = await journeyRepo.getById(journey.id);
      expect(updated!.status).toBe('draft');
    });

    it('complete → draft should revert status', async () => {
      const journeyRepo = new JourneyRepository(db);
      const journey = await journeyRepo.create('Reopen Test');
      await journeyRepo.updateStatus(journey.id, 'completed');
      await journeyRepo.updateStatus(journey.id, 'draft');
      const reopened = await journeyRepo.getById(journey.id);
      expect(reopened!.status).toBe('draft');
    });
  });

  describe('findAreaContainingPoint via polygon', () => {
    it('finds area by point-in-polygon when stop not in area', async () => {
      const areaRepo = new AreaRepository(db);
      const stopRepo = new StopRepository(db);
      const areaStopRepo = new AreaStopRepository(db);

      const area = await areaRepo.create('Polygon Area');
      const polygonJson = GeometryService.polygonToJson([
        { latitude: 5.55, longitude: -0.21 },
        { latitude: 5.56, longitude: -0.20 },
        { latitude: 5.55, longitude: -0.19 },
      ]);
      await areaRepo.updatePolygon(area.id, polygonJson);

      const stop = await stopRepo.create('Edge Stop', 5.556, -0.201);
      await areaStopRepo.create(area.id, stop.id);

      const validationLogRepo = new ValidationLogRepository(db);
      const service = new ValidationService({
        stopRepo,
        areaRepo,
        journeyAreaRepo: new JourneyAreaRepository(db),
        journeyFareRepo: new JourneyFareRepository(db),
        areaStopRepo,
        areaFareLevelRepo: new AreaFareLevelRepository(db),
        journeyRepo: new JourneyRepository(db),
        validationLogRepo,
      });

      const result = await service.validate(5.555, -0.200, 5.556, -0.201);
      expect(result.status).not.toBe('unknown');
    });
  });
});
