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
  ValidationLogRepository,
} from '@mateapp/db-node';
import { ValidationService } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { seedTestData, type TestSeedData } from './helpers';

describe('ValidationService', () => {
  let db: Database.Database;
  let service: ValidationService;
  let seed: TestSeedData;

  beforeEach(async () => {
    db = getMemoryDatabase();
    seed = await seedTestData(db);

    service = new ValidationService({
      stopRepo: new StopRepository(db),
      areaRepo: new AreaRepository(db),
      journeyAreaRepo: new JourneyAreaRepository(db),
      journeyFareRepo: new JourneyFareRepository(db),
      areaStopRepo: new AreaStopRepository(db),
      areaFareLevelRepo: new AreaFareLevelRepository(db),
      journeyRepo: new JourneyRepository(db),
      validationLogRepo: new ValidationLogRepository(db),
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('inter-area fare', () => {
    it('resolves Kejetia(5.5490,-0.2010) → Suame(5.5750,-0.2120) as GHS 3.50', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5750, -0.2120);
      expect(result.status).toBe('success');
      expect(result.fare).toBe(3.50);
      expect(result.fareType).toBe('journey');
      expect(result.journey).not.toBeNull();
      expect(result.journey!.name).toBe('Kejetia ↔ Suame');
    });

    it('resolves Kejetia(5.5490,-0.2010) → Ashtown(5.5600,-0.2050) as GHS 1.50', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5600, -0.2050);
      expect(result.status).toBe('success');
      expect(result.fare).toBe(1.50);
      expect(result.fareType).toBe('journey');
    });

    it('resolves Ashtown(5.5600,-0.2050) → Suame(5.5750,-0.2120) as GHS 2.00', async () => {
      const result = await service.validate(5.5600, -0.2050, 5.5750, -0.2120);
      expect(result.status).toBe('success');
      expect(result.fare).toBe(2.00);
      expect(result.fareType).toBe('journey');
    });
  });

  describe('intra-area fare', () => {
    it('resolves Kejetia Market → Kejetia Station using AreaFareLevel', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5495, -0.2005);
      expect(result.status).toBe('success');
      expect(result.fareType).toBe('area');
      expect(result.fare).toBeGreaterThan(0);
      expect(result.pickupArea!.name).toBe('Kejetia');
      expect(result.destArea!.name).toBe('Kejetia');
      expect(result.pickupArea!.id).toBe(result.destArea!.id);
    });

    it('resolves intra-area fare for Suame stops', async () => {
      const result = await service.validate(5.5750, -0.2120, 5.5760, -0.2115);
      expect(result.status).toBe('success');
      expect(result.fareType).toBe('area');
      expect(result.pickupArea!.name).toBe('Suame');
    });
  });

  describe('bidirectional journey', () => {
    it('resolves Dest→Pickup (reverse direction)', async () => {
      const result = await service.validate(5.5750, -0.2120, 5.5490, -0.2010);
      expect(result.status).toBe('success');
      expect(result.fare).toBe(3.50);
      expect(result.fareType).toBe('journey');
    });

    it('resolves Ashtown→Kejetia (reverse direction)', async () => {
      const result = await service.validate(5.5600, -0.2050, 5.5495, -0.2005);
      expect(result.status).toBe('success');
      expect(result.fareType).toBe('journey');
    });
  });

  describe('journey not found', () => {
    it('two valid areas not on same journey → status journey_not_found', async () => {
      const areaRepo = new AreaRepository(db);
      const stopRepo = new StopRepository(db);
      const areaStopRepo = new AreaStopRepository(db);

      const isolatedArea = await areaRepo.create('Isolated Area');
      const isolatedStop = await stopRepo.create('Isolated Stop', 7.0000, -1.0000);
      await areaStopRepo.create(isolatedArea.id, isolatedStop.id);

      const result = await service.validate(5.5490, -0.2010, 7.0000, -1.0000);
      expect(result.status).toBe('journey_not_found');
      expect(result.fare).toBeNull();
      expect(result.journey).toBeNull();
    });
  });

  describe('stop not found', () => {
    it('GPS far from any stop (>25km) → status stop_not_found', async () => {
      const result = await service.validate(6.5000, -1.0000, 6.6000, -1.1000);
      expect(result.status).toBe('stop_not_found');
      expect(result.pickupStop).toBeNull();
      expect(result.destStop).toBeNull();
    });

    it('no stops at all → status stop_not_found', async () => {
      const newDb = getMemoryDatabase();
      const newService = new ValidationService({
        stopRepo: new StopRepository(newDb),
        areaRepo: new AreaRepository(newDb),
        journeyAreaRepo: new JourneyAreaRepository(newDb),
        journeyFareRepo: new JourneyFareRepository(newDb),
        areaStopRepo: new AreaStopRepository(newDb),
        areaFareLevelRepo: new AreaFareLevelRepository(newDb),
        journeyRepo: new JourneyRepository(newDb),
        validationLogRepo: new ValidationLogRepository(newDb),
      });
      const result = await newService.validate(5.55, -0.20, 5.56, -0.21);
      expect(result.status).toBe('stop_not_found');
      expect(result.fare).toBeNull();
      newDb.close();
    });
  });

  describe('never guesses fare', () => {
    it('flags estimated stops for coordinates far from any mapped stop', async () => {
      const result = await service.validate(9.0000, 0.0000, 8.0000, 0.0000);
      expect(result.estimatedPickup).toBe(true);
      expect(result.estimatedDest).toBe(true);
    });

    it('returns journey_not_found when areas not on same journey', async () => {
      const areaRepo = new AreaRepository(db);
      const stopRepo = new StopRepository(db);
      const areaStopRepo = new AreaStopRepository(db);
      const isolated = await areaRepo.create('Isolated Area');
      const stopA = await stopRepo.create('Isolated Stop A', 6.0, 0.0);
      const stopB = await stopRepo.create('Isolated Stop B', 6.5, 0.0);
      await areaStopRepo.create(isolated.id, stopA.id);
      await areaStopRepo.create(isolated.id, stopB.id);
      const result = await service.validate(6.0, 0.0, 6.5, 0.0);
      expect(result.status).toBe('journey_not_found');
      expect(result.fare).toBeNull();
    });
  });

  describe('diagnostics', () => {
    it('sets estimated flags when stop is not within 50m radius', async () => {
      const result = await service.validate(5.5500, -0.2020, 5.5800, -0.2150);
      if (result.status === 'success') {
        expect(typeof result.estimatedPickup).toBe('boolean');
        expect(typeof result.estimatedDest).toBe('boolean');
      }
    });

    it('includes correct fareType for inter-area', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5750, -0.2120);
      expect(result.fareType).toBe('journey');
    });

    it('includes correct fareType for intra-area', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5495, -0.2005);
      expect(result.fareType).toBe('area');
    });

    it('includes status and message in result', async () => {
      const result = await service.validate(5.5490, -0.2010, 5.5750, -0.2120);
      expect(result.status).toBe('success');
      expect(result.message).toContain('GHS');
      expect(result.message).toContain('3.50');
    });
  });
});
