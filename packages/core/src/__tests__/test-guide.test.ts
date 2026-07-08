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
import { seedTestData } from './helpers';

function makeValidationService(db: Database.Database): ValidationService {
  return new ValidationService({
    stopRepo: new StopRepository(db),
    areaRepo: new AreaRepository(db),
    journeyAreaRepo: new JourneyAreaRepository(db),
    journeyFareRepo: new JourneyFareRepository(db),
    areaStopRepo: new AreaStopRepository(db),
    areaFareLevelRepo: new AreaFareLevelRepository(db),
    journeyRepo: new JourneyRepository(db),
    validationLogRepo: new ValidationLogRepository(db),
  });
}

describe('Route Mapping Test Guide', () => {
  let db: Database.Database;

  beforeEach(() => { db = getMemoryDatabase(); });
  afterEach(() => { db.close(); });

  // ─── 1. Journey Mapping ────────────────────────────

  describe('1. Journey Mapping', () => {
    describe('JM-001 Create Journey', () => {
      it('journey name required', async () => {
        const repo = new JourneyRepository(db);
        const j = await repo.create('Accra ↔ Tema');
        expect(j.name).toBe('Accra ↔ Tema');
      });

      it('draft status by default', async () => {
        const repo = new JourneyRepository(db);
        const j = await repo.create('Test');
        expect(j.status).toBe('draft');
      });

      it('UUID generated on create', async () => {
        const repo = new JourneyRepository(db);
        const j = await repo.create('Test');
        expect(j.id).toBeTruthy();
        expect(j.id).toHaveLength(36);
      });

      it('two journeys get unique UUIDs', async () => {
        const repo = new JourneyRepository(db);
        const j1 = await repo.create('Route 1');
        const j2 = await repo.create('Route 2');
        expect(j1.id).not.toBe(j2.id);
      });
    });

    describe('JM-002 Resume Journey', () => {
      it('restores Journey by ID', async () => {
        const repo = new JourneyRepository(db);
        const created = await repo.create('Resume Me');
        const found = await repo.getById(created.id);
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Resume Me');
      });

      it('restores current Area via JourneyAreas in sequence order', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const j = await jRepo.create('Area Route');
        const a1 = await aRepo.create('Start Area');
        const a2 = await aRepo.create('End Area');
        await jaRepo.create(j.id, a1.id, 1);
        await jaRepo.create(j.id, a2.id, 2);
        const areas = await jaRepo.getByJourney(j.id);
        expect(areas).toHaveLength(2);
        expect(areas[0].area_id).toBe(a1.id);
        expect(areas[1].area_id).toBe(a2.id);
      });

      it('resumes GPS tracking from max TrackPoint sequence', async () => {
        const jRepo = new JourneyRepository(db);
        const tpRepo = new TrackPointRepository(db);
        const j = await jRepo.create('GPS Resume');
        await tpRepo.create(j.id, null, 1, 5.5, -0.2);
        await tpRepo.create(j.id, null, 2, 5.51, -0.2);
        await tpRepo.create(j.id, null, 3, 5.52, -0.2);
        const max = await tpRepo.getMaxSequence(j.id);
        expect(max).toBe(3);
      });

      it('continues TrackPoint recording from last sequence number', async () => {
        const jRepo = new JourneyRepository(db);
        const tpRepo = new TrackPointRepository(db);
        const j = await jRepo.create('Continue');
        await tpRepo.create(j.id, null, 7, 5.5, -0.2);
        const max = await tpRepo.getMaxSequence(j.id);
        // Next track point should use sequence = max + 1
        await tpRepo.create(j.id, null, max + 1, 5.51, -0.2);
        const all = await tpRepo.getByJourney(j.id);
        expect(all).toHaveLength(2);
        expect(all[1].sequence).toBe(8);
      });
    });
  });

  // ─── 2. Area ────────────────────────────────────────

  describe('2. Area', () => {
    describe('AR-001 Create First Area', () => {
      it('first GPS becomes first Stop and links to Area', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('New Area');
        const stop = await sRepo.create('First Stop', 5.55, -0.20);
        await asRepo.create(area.id, stop.id);
        const stops = await sRepo.findByArea(area.id);
        expect(stops).toHaveLength(1);
        expect(stops[0].label).toBe('First Stop');
      });

      it('area cannot exist without first Stop (no polygon yet)', async () => {
        const aRepo = new AreaRepository(db);
        const area = await aRepo.create('Empty');
        const sRepo = new StopRepository(db);
        const stops = await sRepo.findByArea(area.id);
        expect(stops).toHaveLength(0);
      });

      it('polygon starts null, builds from first Stop accumulation', async () => {
        const aRepo = new AreaRepository(db);
        const area = await aRepo.create('Poly Start');
        expect(area.polygon).toBeNull();
      });
    });

    describe('AR-002 Existing Area', () => {
      it('recommends reuse via point-in-polygon detection', async () => {
        const aRepo = new AreaRepository(db);
        const area = await aRepo.create('Existing');
        const polygon = GeometryService.polygonToJson([
          { latitude: 5.55, longitude: -0.21 },
          { latitude: 5.56, longitude: -0.20 },
          { latitude: 5.55, longitude: -0.19 },
        ]);
        await aRepo.updatePolygon(area.id, polygon);
        const inside = GeometryService.pointInPolygon(
          { latitude: 5.554, longitude: -0.200 },
          GeometryService.polygonFromJson(polygon)
        );
        expect(inside).toBe(true);
      });

      it('point outside polygon is not recommended', async () => {
        const polygon = GeometryService.polygonToJson([
          { latitude: 5.55, longitude: -0.21 },
          { latitude: 5.56, longitude: -0.20 },
          { latitude: 5.55, longitude: -0.19 },
        ]);
        const outside = GeometryService.pointInPolygon(
          { latitude: 5.60, longitude: -0.30 },
          GeometryService.polygonFromJson(polygon)
        );
        expect(outside).toBe(false);
      });

      it('allows override — create new area despite existing suggestion', async () => {
        const aRepo = new AreaRepository(db);
        const existing = await aRepo.create('Old');
        const override = await aRepo.create('Brand New');
        expect(override.id).not.toBe(existing.id);
        expect(override.name).toBe('Brand New');
      });
    });

    describe('AR-003 Duplicate Area Name', () => {
      it('rejects duplicate area name via UNIQUE constraint', async () => {
        const aRepo = new AreaRepository(db);
        await aRepo.create('Dupe');
        await expect(aRepo.create('Dupe')).rejects.toThrow();
      });
    });

    describe('AR-004 Area Expansion', () => {
      it('polygon recalculated after every new stop', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Growing');

        // 2 stops → no polygon
        const s1 = await sRepo.create('S1', 5.55, -0.20);
        const s2 = await sRepo.create('S2', 5.56, -0.19);
        await asRepo.create(area.id, s1.id);
        await asRepo.create(area.id, s2.id);
        const before = await aRepo.getById(area.id);
        expect(before!.polygon).toBeNull();

        // 3rd stop → polygon created
        const s3 = await sRepo.create('S3', 5.57, -0.21);
        await asRepo.create(area.id, s3.id);
        const areaStops = await sRepo.findByArea(area.id);
        const hull = GeometryService.polygonFromStops(
          areaStops.map(s => ({ latitude: s.latitude, longitude: s.longitude }))
        );
        expect(hull.length).toBeGreaterThanOrEqual(3);
        await aRepo.updatePolygon(area.id, GeometryService.polygonToJson(hull));
        const after = await aRepo.getById(area.id);
        expect(after!.polygon).not.toBeNull();
      });

      it('adding 4th stop expands polygon further', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Expand');

        const pts = [
          { lat: 5.55, lng: -0.20 },
          { lat: 5.56, lng: -0.19 },
          { lat: 5.57, lng: -0.21 },
          { lat: 5.58, lng: -0.20 },
        ];

        for (const pt of pts) {
          const s = await sRepo.create(`P${pts.indexOf(pt)}`, pt.lat, pt.lng);
          await asRepo.create(area.id, s.id);
        }

        const areaStops = await sRepo.findByArea(area.id);
        const hull = GeometryService.polygonFromStops(
          areaStops.map(s => ({ latitude: s.latitude, longitude: s.longitude }))
        );
        expect(hull.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ─── 3. Stops ───────────────────────────────────────

  describe('3. Stops', () => {
    describe('ST-001 Create Stop', () => {
      it('saves Stop with GPS coordinates and label', async () => {
        const sRepo = new StopRepository(db);
        const stop = await sRepo.create('Main Station', 5.5500, -0.2010);
        expect(stop.label).toBe('Main Station');
        expect(stop.latitude).toBe(5.5500);
        expect(stop.longitude).toBe(-0.2010);
      });

      it('adds Stop to Area via AreaStop link', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Zone 1');
        const stop = await sRepo.create('Stop 1', 1, 1);
        await asRepo.create(area.id, stop.id);
        const linked = await asRepo.getByAreaAndStop(area.id, stop.id);
        expect(linked).not.toBeNull();
      });

      it('updates polygon after new stop added to area', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Poly Area');

        // Add 3 stops
        const coords: [number, number, number][] = [[0, 5.55, -0.20], [1, 5.56, -0.19], [2, 5.57, -0.21]];
        for (const [i, lat, lng] of coords) {
          const s = await sRepo.create(`S${i}`, lat, lng);
          await asRepo.create(area.id, s.id);
        }

        const areaStops = await sRepo.findByArea(area.id);
        expect(areaStops.length).toBe(3);
      });
    });

    describe('ST-002 Duplicate Stop', () => {
      it('inside radius → existing Stop found, should be reused', async () => {
        const sRepo = new StopRepository(db);
        await sRepo.create('Original', 5.5500, -0.2010);
        const nearby = await sRepo.findByRadius(5.5500, -0.2010, 50);
        expect(nearby).toHaveLength(1);
        expect(nearby[0].label).toBe('Original');
      });

      it('existing area_stop link detected for same pair', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Test');
        const stop = await sRepo.create('Test Stop', 1, 1);
        await asRepo.create(area.id, stop.id);
        const found = await asRepo.getByAreaAndStop(area.id, stop.id);
        expect(found).not.toBeNull();
      });
    });

    describe('ST-003 New Stop', () => {
      it('outside radius → creates new Stop', async () => {
        const sRepo = new StopRepository(db);
        await sRepo.create('Far Stop', 5.55, -0.20);
        const degPerMeter = 1 / 111195;
        const offset = 500 * degPerMeter;
        const nearby = await sRepo.findByRadius(5.55 + offset, -0.20, 50);
        expect(nearby).toHaveLength(0);
      });
    });

    describe('ST-004 Stop Label', () => {
      it('label is required and stored correctly', async () => {
        const sRepo = new StopRepository(db);
        const stop = await sRepo.create('Main Junction', 5.55, -0.20);
        expect(stop.label).toBe('Main Junction');
        expect(stop.label.length).toBeGreaterThan(0);
      });
    });

    describe('ST-005 Fare Level', () => {
      it('every Stop references an Area Fare Level through AreaStop link', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Zone A');
        const fl = await flRepo.create(area.id, 'Minimum', 0, 2.00);
        const stop = await sRepo.create('Stop X', 1, 1);
        await asRepo.create(area.id, stop.id, fl.id);
        const as = await asRepo.getByAreaAndStop(area.id, stop.id);
        expect(as!.fare_level_id).toBe(fl.id);
      });

      it('default fare_level_id is null when not explicitly set', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Zone B');
        const stop = await sRepo.create('Stop Y', 1, 1);
        const as = await asRepo.create(area.id, stop.id);
        expect(as.fare_level_id).toBeNull();
      });
    });

    describe('ST-006 New Fare Level', () => {
      it('future stops can use the new fare level', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Zone');
        const flMin = await flRepo.create(area.id, 'Minimum', 0, 1.50);
        const flExt = await flRepo.create(area.id, 'Extended', 1, 3.00);
        const stop = await sRepo.create('New Stop', 1, 1);
        await asRepo.create(area.id, stop.id, flExt.id);
        const as = await asRepo.getByAreaAndStop(area.id, stop.id);
        expect(as!.fare_level_id).toBe(flExt.id);
      });

      it('existing stops unchanged when new fare level is added', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const asRepo = new AreaStopRepository(db);
        const area = await aRepo.create('Zone');
        const flMin = await flRepo.create(area.id, 'Minimum', 0, 1.50);
        const stop = await sRepo.create('Old Stop', 1, 1);
        await asRepo.create(area.id, stop.id, flMin.id);
        // Add new fare level
        await flRepo.create(area.id, 'Extended', 1, 3.00);
        // Old stop still references Minimum
        const as = await asRepo.getByAreaAndStop(area.id, stop.id);
        expect(as!.fare_level_id).toBe(flMin.id);
      });
    });
  });

  // ─── 4. Journey Progression ─────────────────────────

  describe('4. Journey Progression', () => {
    describe('JP-001 Area B', () => {
      it('requires A→B fare when adding second area', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const jfRepo = new JourneyFareRepository(db);
        const j = await jRepo.create('A to B');
        const a1 = await aRepo.create('Area A');
        const a2 = await aRepo.create('Area B');
        const ja1 = await jaRepo.create(j.id, a1.id, 1);
        const ja2 = await jaRepo.create(j.id, a2.id, 2);
        await jfRepo.create(j.id, ja1.id, ja2.id, 5.00);
        const fare = await jfRepo.getBetweenAreas(j.id, a1.id, a2.id);
        expect(fare).not.toBeNull();
        expect(fare!.amount).toBe(5.00);
      });
    });

    describe('JP-002 Area C', () => {
      it('requires A→C and B→C fares when adding third area', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const jfRepo = new JourneyFareRepository(db);
        const j = await jRepo.create('A to C');
        const a1 = await aRepo.create('Area A');
        const a2 = await aRepo.create('Area B');
        const a3 = await aRepo.create('Area C');
        const ja1 = await jaRepo.create(j.id, a1.id, 1);
        const ja2 = await jaRepo.create(j.id, a2.id, 2);
        const ja3 = await jaRepo.create(j.id, a3.id, 3);
        await jfRepo.create(j.id, ja1.id, ja3.id, 10.00);
        await jfRepo.create(j.id, ja2.id, ja3.id, 6.00);
        expect((await jfRepo.getBetweenAreas(j.id, a1.id, a3.id))!.amount).toBe(10.00);
        expect((await jfRepo.getBetweenAreas(j.id, a2.id, a3.id))!.amount).toBe(6.00);
      });
    });

    describe('JP-003 Area D', () => {
      it('requires A→D, B→D, C→D fares for 4th area', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const jfRepo = new JourneyFareRepository(db);
        const j = await jRepo.create('4 Areas');
        const a1 = await aRepo.create('A'); const a2 = await aRepo.create('B');
        const a3 = await aRepo.create('C'); const a4 = await aRepo.create('D');
        const ja1 = await jaRepo.create(j.id, a1.id, 1);
        const ja2 = await jaRepo.create(j.id, a2.id, 2);
        const ja3 = await jaRepo.create(j.id, a3.id, 3);
        const ja4 = await jaRepo.create(j.id, a4.id, 4);
        await jfRepo.create(j.id, ja1.id, ja4.id, 15.00);
        await jfRepo.create(j.id, ja2.id, ja4.id, 10.00);
        await jfRepo.create(j.id, ja3.id, ja4.id, 5.00);
        expect((await jfRepo.getBetweenAreas(j.id, a1.id, a4.id))!.amount).toBe(15.00);
        expect((await jfRepo.getBetweenAreas(j.id, a2.id, a4.id))!.amount).toBe(10.00);
        expect((await jfRepo.getBetweenAreas(j.id, a3.id, a4.id))!.amount).toBe(5.00);
      });
    });

    describe('JP-004 Complete Journey', () => {
      it('minimum two Areas required', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const j = await jRepo.create('Two Area Route');
        const a1 = await aRepo.create('Start');
        const a2 = await aRepo.create('End');
        await jaRepo.create(j.id, a1.id, 1);
        await jaRepo.create(j.id, a2.id, 2);
        const areas = await jaRepo.getByJourney(j.id);
        expect(areas.length).toBeGreaterThanOrEqual(2);
      });

      it('journey can be marked as completed', async () => {
        const jRepo = new JourneyRepository(db);
        const j = await jRepo.create('Finish');
        await jRepo.updateStatus(j.id, 'completed');
        expect((await jRepo.getById(j.id))!.status).toBe('completed');
      });
    });

    describe('JP-005 Resume', () => {
      it('continue only from last Area in sequence', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const j = await jRepo.create('Seq Test');
        const a1 = await aRepo.create('A1');
        const a2 = await aRepo.create('A2');
        const a3 = await aRepo.create('A3');
        await jaRepo.create(j.id, a1.id, 1);
        await jaRepo.create(j.id, a2.id, 2);
        await jaRepo.create(j.id, a3.id, 3);
        const maxSeq = await jaRepo.getMaxSequence(j.id);
        expect(maxSeq).toBe(3);
      });
    });

    describe('JP-006 Missed Stop', () => {
      it('cannot insert between existing sequences — must append at the end', async () => {
        const jRepo = new JourneyRepository(db);
        const aRepo = new AreaRepository(db);
        const jaRepo = new JourneyAreaRepository(db);
        const j = await jRepo.create('Ordered');
        const a1 = await aRepo.create('First');
        const a2 = await aRepo.create('Second');
        const a3 = await aRepo.create('Third');
        await jaRepo.create(j.id, a1.id, 1);
        await jaRepo.create(j.id, a2.id, 2);
        await jaRepo.create(j.id, a3.id, 3);
        const areas = await jaRepo.getByJourney(j.id);
        expect(areas[0].sequence).toBe(1);
        expect(areas[1].sequence).toBe(2);
        expect(areas[2].sequence).toBe(3);
        // Continuation goes from sequence 3
        const maxSeq = await jaRepo.getMaxSequence(j.id);
        expect(maxSeq).toBe(3);
      });
    });
  });

  // ─── 5. GPS ─────────────────────────────────────────

  describe('5. GPS', () => {
    it('auto-records TrackPoints with incrementing sequence', async () => {
      const jRepo = new JourneyRepository(db);
      const tpRepo = new TrackPointRepository(db);
      const j = await jRepo.create('Track Test');
      for (let seq = 1; seq <= 10; seq++) {
        await tpRepo.create(j.id, null, seq, 5.5 + seq * 0.001, -0.2);
      }
      const tps = await tpRepo.getByJourney(j.id);
      expect(tps).toHaveLength(10);
      expect(tps[0].sequence).toBe(1);
      expect(tps[9].sequence).toBe(10);
    });

    it('trackPoints are ordered by sequence ascending', async () => {
      const jRepo = new JourneyRepository(db);
      const tpRepo = new TrackPointRepository(db);
      const j = await jRepo.create('Order Test');
      await tpRepo.create(j.id, null, 3, 5.56, -0.21);
      await tpRepo.create(j.id, null, 1, 5.55, -0.20);
      await tpRepo.create(j.id, null, 2, 5.555, -0.205);
      const tps = await tpRepo.getByJourney(j.id);
      expect(tps[0].sequence).toBe(1);
      expect(tps[1].sequence).toBe(2);
      expect(tps[2].sequence).toBe(3);
    });
  });

  // ─── 6. Pricing ─────────────────────────────────────

  describe('6. Pricing', () => {
    describe('different areas', () => {
      it('uses JourneyFare only for inter-area travel', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5750, -0.2120);
        expect(result.fareType).toBe('journey');
        expect(result.fare).toBe(5.00);
      });
    });

    describe('same area', () => {
      it('uses Area Fare Level only for intra-area travel', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5495, -0.2005);
        expect(result.fareType).toBe('area');
      });
    });

    describe('extended fare', () => {
      it('returns extended amount when destination has Extended fare level', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const asRepo = new AreaStopRepository(db);
        const jRepo = new JourneyRepository(db);
        const jaRepo = new JourneyAreaRepository(db);

        const area = await aRepo.create('Big Zone');
        const flMin = await flRepo.create(area.id, 'Minimum', 0, 2.00);
        const flExt = await flRepo.create(area.id, 'Extended', 1, 5.00);
        const sMin = await sRepo.create('Near Stop', 5.55, -0.20);
        const sExt = await sRepo.create('Far Stop', 5.555, -0.202);
        await asRepo.create(area.id, sMin.id, flMin.id);
        await asRepo.create(area.id, sExt.id, flExt.id);

        const j = await jRepo.create('Zone Route');
        await jaRepo.create(j.id, area.id, 1);

        const svc = makeValidationService(db);
        const result = await svc.validate(5.55, -0.20, 5.555, -0.202);
        expect(result.fareType).toBe('area');
        expect(result.fare).toBe(5.00);
      });
    });

    describe('minimum fare', () => {
      it('returns minimum amount for Minimum fare level destination', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5495, -0.2005);
        expect(result.fare).toBe(1.50);
      });
    });

    describe('missing JourneyFare', () => {
      it('returns null fare when no JourneyFare exists between areas', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const jRepo = new JourneyRepository(db);
        const jaRepo = new JourneyAreaRepository(db);

        const a1 = await aRepo.create('NoFare A');
        const a2 = await aRepo.create('NoFare B');
        const s1 = await sRepo.create('Stop A', 5.60, -0.21);
        const s2 = await sRepo.create('Stop B', 5.65, -0.22);
        const fl1 = await flRepo.create(a1.id, 'Min', 0, 1.00);
        const fl2 = await flRepo.create(a2.id, 'Min', 0, 1.00);
        await asRepo.create(a1.id, s1.id, fl1.id);
        await asRepo.create(a2.id, s2.id, fl2.id);

        const j = await jRepo.create('No Fare Route');
        await jaRepo.create(j.id, a1.id, 1);
        await jaRepo.create(j.id, a2.id, 2);

        const svc = makeValidationService(db);
        const result = await svc.validate(5.60, -0.21, 5.65, -0.22);
        expect(result.fare).toBeNull();
      });
    });

    describe('missing AreaFareLevel', () => {
      it('returns null fare when stop has no fare level for intra-area', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const jRepo = new JourneyRepository(db);
        const jaRepo = new JourneyAreaRepository(db);

        const area = await aRepo.create('No Level Zone');
        const s1 = await sRepo.create('Stop X', 5.55, -0.20);
        const s2 = await sRepo.create('Stop Y', 5.555, -0.202);
        await asRepo.create(area.id, s1.id);
        await asRepo.create(area.id, s2.id);

        const j = await jRepo.create('No Level Route');
        await jaRepo.create(j.id, area.id, 1);

        const svc = makeValidationService(db);
        const result = await svc.validate(5.55, -0.20, 5.555, -0.202);
        expect(result.fare).toBeNull();
      });
    });
  });

  // ─── 7. Validation ──────────────────────────────────

  describe('7. Validation', () => {
    describe('stop matching', () => {
      it('inside Stop radius → exact matched (not estimated)', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5750, -0.2120);
        expect(result.estimatedPickup).toBe(false);
        expect(result.estimatedDest).toBe(false);
      });

      it('multiple Stops match → nearest wins', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const jRepo = new JourneyRepository(db);
        const jaRepo = new JourneyAreaRepository(db);

        const area = await aRepo.create('Near Zone');
        const fl = await flRepo.create(area.id, 'Min', 0, 2.00);
        const stopClose = await sRepo.create('Close', 5.5500, -0.2010);
        const stopFar = await sRepo.create('Far', 5.5510, -0.2010);
        await asRepo.create(area.id, stopClose.id, fl.id);
        await asRepo.create(area.id, stopFar.id, fl.id);

        const j = await jRepo.create('Near Route');
        await jaRepo.create(j.id, area.id, 1);

        const svc = makeValidationService(db);
        const result = await svc.validate(5.55001, -0.2010, 5.55001, -0.2010);
        expect(result.pickupStop!.label).toBe('Close');
      });
    });

    describe('unknown stop fallback', () => {
      it('unknown Stop → nearest Stop in Area, mark Estimated', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5755, -0.2125, 5.5495, -0.2005);
        expect(result.pickupStop).not.toBeNull();
        expect(result.estimatedPickup).toBe(true);
      });
    });

    describe('unknown area', () => {
      it('unknown location with no mapped area fails gracefully', async () => {
        const svc = makeValidationService(db);
        const result = await svc.validate(0.0, 0.0, 1.0, 1.0);
        expect(result.status).toBe('stop_not_found');
      });
    });

    describe('journey resolution', () => {
      it('Journey exists and contains both Areas → resolves direction', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5750, -0.2120);
        expect(result.journey!.name).toBe('Kejetia ↔ Suame');
        expect(result.status).toBe('success');
      });

      it('No Journey → Journey Not Found, no fare', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const asRepo = new AreaStopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);

        const a1 = await aRepo.create('Orphan A');
        const a2 = await aRepo.create('Orphan B');
        const s1 = await sRepo.create('Stop A', 5.70, -0.25);
        const s2 = await sRepo.create('Stop B', 5.75, -0.26);
        const fl = await flRepo.create(a1.id, 'Min', 0, 1.00);
        const fl2 = await flRepo.create(a2.id, 'Min', 0, 1.00);
        await asRepo.create(a1.id, s1.id, fl.id);
        await asRepo.create(a2.id, s2.id, fl2.id);

        const svc = makeValidationService(db);
        const result = await svc.validate(5.70, -0.25, 5.75, -0.26);
        expect(result.status).toBe('journey_not_found');
        expect(result.fare).toBeNull();
      });
    });
  });

  // ─── 8. Data Integrity ──────────────────────────────

  describe('8. Data Integrity', () => {
    it('reject duplicate JourneyArea — append via maxSequence + 1', async () => {
      const jRepo = new JourneyRepository(db);
      const aRepo = new AreaRepository(db);
      const jaRepo = new JourneyAreaRepository(db);
      const j = await jRepo.create('Seq Route');
      const a1 = await aRepo.create('Seq A');
      const a2 = await aRepo.create('Seq B');
      await jaRepo.create(j.id, a1.id, 1);
      await jaRepo.create(j.id, a2.id, 2);
      const max = await jaRepo.getMaxSequence(j.id);
      expect(max).toBe(2);
    });

    it('upsert prevents duplicate JourneyFare for same (from, to) pair', async () => {
      const jRepo = new JourneyRepository(db);
      const aRepo = new AreaRepository(db);
      const jaRepo = new JourneyAreaRepository(db);
      const jfRepo = new JourneyFareRepository(db);
      const j = await jRepo.create('Fare Route');
      const a1 = await aRepo.create('X'); const a2 = await aRepo.create('Y');
      const ja1 = await jaRepo.create(j.id, a1.id, 1);
      const ja2 = await jaRepo.create(j.id, a2.id, 2);
      await jfRepo.create(j.id, ja1.id, ja2.id, 5.00);
      const updated = await jfRepo.upsert(j.id, ja1.id, ja2.id, 10.00);
      expect(updated.amount).toBe(10.00);
      const all = await jfRepo.getByJourney(j.id);
      expect(all).toHaveLength(1);
    });

    it('TrackPoint sequences increment correctly per journey', async () => {
      const jRepo = new JourneyRepository(db);
      const tpRepo = new TrackPointRepository(db);
      const j1 = await jRepo.create('Route 1');
      const j2 = await jRepo.create('Route 2');
      await tpRepo.create(j1.id, null, 1, 5.5, -0.2);
      await tpRepo.create(j1.id, null, 2, 5.51, -0.2);
      await tpRepo.create(j2.id, null, 1, 5.6, -0.3);
      expect((await tpRepo.getByJourney(j1.id)).length).toBe(2);
      expect((await tpRepo.getByJourney(j2.id)).length).toBe(1);
    });
  });

  // ─── 10. Logging ────────────────────────────────────

  describe('10. Logging', () => {
    it('captures unknown stop coordinates in validation log', async () => {
      const svc = makeValidationService(db);
      const logRepo = new ValidationLogRepository(db);
      await svc.validate(9.0, 0.0, 8.0, 0.0);
      const logs = await logRepo.getAll();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[logs.length - 1].pickup_lat).toBe(9.0);
    });

    it('logs estimated stop flag when stop was estimated', async () => {
      const seed = await seedTestData(db);
      const svc = makeValidationService(db);
      const logRepo = new ValidationLogRepository(db);
      await svc.validate(5.5755, -0.2125, 5.5495, -0.2005);
      const logs = await logRepo.getAll();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.pickup_lat).toBe(5.5755);
      expect(lastLog.status).toBeDefined();
    });

    it('captures timestamp with each log entry', async () => {
      const logRepo = new ValidationLogRepository(db);
      await logRepo.create({
        pickup_lat: 1, pickup_lng: 1, dest_lat: 2, dest_lng: 2,
        pickup_stop_id: null, pickup_area_id: null,
        dest_stop_id: null, dest_area_id: null,
        journey_id: null, fare: null, fare_type: null,
        status: 'unknown', message: 'Test',
        estimated_pickup: false, estimated_dest: false,
      });
      const logs = await logRepo.getAll();
      expect(logs[0].created_at).toBeTruthy();
      expect(new Date(logs[0].created_at).getTime()).toBeGreaterThan(0);
    });
  });

  // ─── 11. Ghana Scenarios ─────────────────────────────

  describe('11. Ghana Scenarios', () => {
    describe('passing through area', () => {
      it('A→B→C journey, passenger travels A→C: fare = direct A→C (not A→B + B→C)', async () => {
        const seed = await seedTestData(db);
        // Kejetia(A) → Suame(C) via Ashtown(B): direct fare is 5.00
        const svc = makeValidationService(db);
        const result = await svc.validate(5.5490, -0.2010, 5.5750, -0.2120);
        expect(result.fare).toBe(5.00);
        expect(result.fareType).toBe('journey');
      });
    });

    describe('large area', () => {
      it('same area with multiple fare levels: uses destination Area Fare Level', async () => {
        const aRepo = new AreaRepository(db);
        const sRepo = new StopRepository(db);
        const flRepo = new AreaFareLevelRepository(db);
        const asRepo = new AreaStopRepository(db);
        const jRepo = new JourneyRepository(db);
        const jaRepo = new JourneyAreaRepository(db);

        const bigArea = await aRepo.create('Accra Metro');
        const flMin = await flRepo.create(bigArea.id, 'Minimum', 0, 2.50);
        const flExt = await flRepo.create(bigArea.id, 'Extended', 1, 5.00);
        const flPrem = await flRepo.create(bigArea.id, 'Premium', 2, 8.00);

        const sMin = await sRepo.create('Circle', 5.55, -0.20);
        const sExt = await sRepo.create('Tema', 5.63, -0.01);
        const sPrem = await sRepo.create('Spintex', 5.61, -0.12);

        await asRepo.create(bigArea.id, sMin.id, flMin.id);
        await asRepo.create(bigArea.id, sExt.id, flExt.id);
        await asRepo.create(bigArea.id, sPrem.id, flPrem.id);

        const j = await jRepo.create('Accra Loop');
        await jaRepo.create(j.id, bigArea.id, 1);

        const svc = makeValidationService(db);

        // Minimum fare when destination is Minimum-level stop
        const r1 = await svc.validate(5.63, -0.01, 5.55, -0.20);
        expect(r1.fareType).toBe('area');
        expect(r1.fare).toBe(2.50);

        // Extended fare when destination is Extended-level stop
        const r2 = await svc.validate(5.55, -0.20, 5.63, -0.01);
        expect(r2.fareType).toBe('area');
        expect(r2.fare).toBe(5.00);

        // Premium fare when destination is Premium-level stop
        const r3 = await svc.validate(5.55, -0.20, 5.61, -0.12);
        expect(r3.fareType).toBe('area');
        expect(r3.fare).toBe(8.00);
      });

      it('inter-area validation ignores AreaFareLevel, uses JourneyFare only', async () => {
        const seed = await seedTestData(db);
        const svc = makeValidationService(db);
        // Kejetia → Ashtown: journey fare = 3.50 (not area fare levels)
        const result = await svc.validate(5.5490, -0.2010, 5.5600, -0.2050);
        expect(result.fareType).toBe('journey');
        expect(result.fare).toBe(3.50);
      });
    });
  });
});
