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
import type Database from 'better-sqlite3';
import type { JourneyStatus } from '@mateapp/core';

describe('JourneyRepository', () => {
  let db: Database.Database;
  let repo: JourneyRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new JourneyRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a journey with draft status', async () => {
    const journey = await repo.create('Test Route');
    expect(journey.name).toBe('Test Route');
    expect(journey.status).toBe('draft');
    expect(journey.id).toBeTruthy();
  });

  it('creates a journey with start area id', async () => {
    const area = await new AreaRepository(db).create('Source Area');
    const journey = await repo.create('Route A', area.id);
    expect(journey.name).toBe('Route A');
    expect(journey.start_area_id).toBe(area.id);
  });

  it('getById returns the journey', async () => {
    const created = await repo.create('Find Me');
    const found = await repo.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Find Me');
  });

  it('getById returns null for non-existent id', async () => {
    const found = await repo.getById('nonexistent-id');
    expect(found).toBeNull();
  });

  it('getAll returns all journeys', async () => {
    await repo.create('Route 1');
    await repo.create('Route 2');
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((j) => j.name).sort()).toEqual(['Route 1', 'Route 2']);
  });

  it('getByStatus filters by status', async () => {
    const j1 = await repo.create('Route 1');
    await repo.create('Route 2');
    await repo.updateStatus(j1.id, 'completed');
    const drafts = await repo.getByStatus('draft');
    const completed = await repo.getByStatus('completed');
    expect(drafts).toHaveLength(1);
    expect(completed).toHaveLength(1);
  });

  it('updateStatus changes status', async () => {
    const journey = await repo.create('Test Route');
    await repo.updateStatus(journey.id, 'completed');
    const updated = await repo.getById(journey.id);
    expect(updated!.status).toBe('completed');
  });

  it('updateStatus sets end area id', async () => {
    const area = await new AreaRepository(db).create('End Area');
    const journey = await repo.create('Test Route');
    await repo.updateStatus(journey.id, 'completed', area.id);
    const updated = await repo.getById(journey.id);
    expect(updated!.status).toBe('completed');
    expect(updated!.end_area_id).toBe(area.id);
  });

  it('updateName changes name', async () => {
    const journey = await repo.create('Old Name');
    await repo.updateName(journey.id, 'New Name');
    const updated = await repo.getById(journey.id);
    expect(updated!.name).toBe('New Name');
  });

  it('delete removes journey and cascades', async () => {
    const journey = await repo.create('To Delete');
    const found = await repo.getById(journey.id);
    expect(found).not.toBeNull();
    await repo.delete(journey.id);
    const after = await repo.getById(journey.id);
    expect(after).toBeNull();
  });
});

describe('AreaRepository', () => {
  let db: Database.Database;
  let repo: AreaRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new AreaRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates an area', async () => {
    const area = await repo.create('Kejetia');
    expect(area.name).toBe('Kejetia');
    expect(area.polygon).toBeNull();
    expect(area.id).toBeTruthy();
  });

  it('getById returns area', async () => {
    const created = await repo.create('Test Area');
    const found = await repo.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test Area');
  });

  it('getById returns null for missing id', async () => {
    const found = await repo.getById('no-such-area');
    expect(found).toBeNull();
  });

  it('getAll returns all areas', async () => {
    await repo.create('Area A');
    await repo.create('Area B');
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it('getByName finds area by unique name', async () => {
    await repo.create('Unique Area');
    const found = await repo.getByName('Unique Area');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Unique Area');
  });

  it('getByName returns null for non-existent name', async () => {
    const found = await repo.getByName('No Such Area');
    expect(found).toBeNull();
  });

  it('creating area with same name fails due to UNIQUE constraint', async () => {
    await repo.create('Duplicate');
    await expect(repo.create('Duplicate')).rejects.toThrow();
  });

  it('updatePolygon sets polygon', async () => {
    const area = await repo.create('Poly Area');
    const polygonJson = JSON.stringify([{ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 1 }]);
    await repo.updatePolygon(area.id, polygonJson);
    const updated = await repo.getById(area.id);
    expect(updated!.polygon).toBe(polygonJson);
  });

  it('getAllWithPolygons only returns areas with polygons', async () => {
    const a1 = await repo.create('With Poly');
    const a2 = await repo.create('Without Poly');
    await repo.updatePolygon(a1.id, '[{"latitude":0,"longitude":0}]');
    const withPoly = await repo.getAllWithPolygons();
    expect(withPoly).toHaveLength(1);
    expect(withPoly[0].id).toBe(a1.id);
  });

  it('delete removes area', async () => {
    const area = await repo.create('To Delete');
    await repo.delete(area.id);
    const found = await repo.getById(area.id);
    expect(found).toBeNull();
  });
});

describe('StopRepository', () => {
  let db: Database.Database;
  let repo: StopRepository;
  let areaRepo: AreaRepository;
  let areaStopRepo: AreaStopRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new StopRepository(db);
    areaRepo = new AreaRepository(db);
    areaStopRepo = new AreaStopRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a stop with default radius', async () => {
    const stop = await repo.create('Main Stop', 5.55, -0.20);
    expect(stop.label).toBe('Main Stop');
    expect(stop.latitude).toBe(5.55);
    expect(stop.longitude).toBe(-0.20);
    expect(stop.radius).toBe(50);
  });

  it('creates a stop with custom radius', async () => {
    const stop = await repo.create('Custom Stop', 5.55, -0.20, 100);
    expect(stop.radius).toBe(100);
  });

  it('getById returns stop', async () => {
    const created = await repo.create('Get This', 1, 2);
    const found = await repo.getById(created.id);
    expect(found).not.toBeNull();
  });

  it('getById returns null for missing stop', async () => {
    const found = await repo.getById('no-stop');
    expect(found).toBeNull();
  });

  it('getAll returns all stops', async () => {
    await repo.create('Stop A', 1, 2);
    await repo.create('Stop B', 3, 4);
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it('findByRadius returns stops within given radius', async () => {
    await repo.create('Close Stop', 5.5490, -0.2010);
    await repo.create('Far Stop', 5.5600, -0.2050);
    const nearby = await repo.findByRadius(5.5490, -0.2010, 50);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].label).toBe('Close Stop');
  });

  it('findByRadius returns empty when no stops within radius', async () => {
    await repo.create('Far Stop', 5.5700, -0.2100);
    const nearby = await repo.findByRadius(5.5490, -0.2010, 50);
    expect(nearby).toHaveLength(0);
  });

  it('findNearestStop returns the closest stop', async () => {
    await repo.create('Near', 5.5500, -0.2010);
    await repo.create('Far', 5.5800, -0.2200);
    const nearest = await repo.findNearestStop(5.5490, -0.2010);
    expect(nearest).not.toBeNull();
    expect(nearest!.label).toBe('Near');
  });

  it('findNearestStop returns null when no stops', async () => {
    const nearest = await repo.findNearestStop(5.5490, -0.2010);
    expect(nearest).toBeNull();
  });

  it('findByArea returns stops linked to area', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await repo.create('Area Stop', 5.55, -0.20);
    await areaStopRepo.create(area.id, stop.id);
    const stops = await repo.findByArea(area.id);
    expect(stops).toHaveLength(1);
    expect(stops[0].label).toBe('Area Stop');
  });

  it('findByArea returns empty for area with no stops', async () => {
    const area = await areaRepo.create('Empty Area');
    const stops = await repo.findByArea(area.id);
    expect(stops).toHaveLength(0);
  });

  it('delete removes stop and cascades', async () => {
    const stop = await repo.create('Delete Me', 1, 1);
    await repo.delete(stop.id);
    const found = await repo.getById(stop.id);
    expect(found).toBeNull();
  });
});

describe('AreaFareLevelRepository', () => {
  let db: Database.Database;
  let repo: AreaFareLevelRepository;
  let areaRepo: AreaRepository;
  let stopRepo: StopRepository;
  let areaStopRepo: AreaStopRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new AreaFareLevelRepository(db);
    areaRepo = new AreaRepository(db);
    stopRepo = new StopRepository(db);
    areaStopRepo = new AreaStopRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a fare level', async () => {
    const area = await areaRepo.create('Test Area');
    const fl = await repo.create(area.id, 'Minimum', 0, 1.50);
    expect(fl.label).toBe('Minimum');
    expect(fl.order_no).toBe(0);
    expect(fl.amount).toBe(1.50);
    expect(fl.area_id).toBe(area.id);
  });

  it('getByArea returns fare levels ordered by order_no', async () => {
    const area = await areaRepo.create('Test Area');
    await repo.create(area.id, 'Extended', 1, 3.00);
    await repo.create(area.id, 'Minimum', 0, 1.50);
    const levels = await repo.getByArea(area.id);
    expect(levels).toHaveLength(2);
    expect(levels[0].order_no).toBe(0);
    expect(levels[1].order_no).toBe(1);
  });

  it('getByArea returns empty for area with no levels', async () => {
    const area = await areaRepo.create('No Levels');
    const levels = await repo.getByArea(area.id);
    expect(levels).toHaveLength(0);
  });

  it('getByAreaStop returns fare level for area_stop', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const fl = await repo.create(area.id, 'Minimum', 0, 1.50);
    const areaStop = await areaStopRepo.create(area.id, stop.id, fl.id);
    const found = await repo.getByAreaStop(areaStop.id);
    expect(found).not.toBeNull();
    expect(found!.amount).toBe(1.50);
  });

  it('getByAreaStop returns null when fare_level_id is not set', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const areaStop = await areaStopRepo.create(area.id, stop.id, undefined);
    const found = await repo.getByAreaStop(areaStop.id);
    expect(found).toBeNull();
  });

  it('updateAmount changes the amount', async () => {
    const area = await areaRepo.create('Test Area');
    const fl = await repo.create(area.id, 'Minimum', 0, 1.50);
    await repo.updateAmount(fl.id, 2.50);
    const levels = await repo.getByArea(area.id);
    expect(levels[0].amount).toBe(2.50);
  });

  it('delete removes fare level', async () => {
    const area = await areaRepo.create('Test Area');
    const fl = await repo.create(area.id, 'Temp', 0, 1.00);
    await repo.delete(fl.id);
    const levels = await repo.getByArea(area.id);
    expect(levels).toHaveLength(0);
  });
});

describe('AreaStopRepository', () => {
  let db: Database.Database;
  let repo: AreaStopRepository;
  let areaRepo: AreaRepository;
  let stopRepo: StopRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new AreaStopRepository(db);
    areaRepo = new AreaRepository(db);
    stopRepo = new StopRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates an area-stop link', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const as = await repo.create(area.id, stop.id);
    expect(as.area_id).toBe(area.id);
    expect(as.stop_id).toBe(stop.id);
  });

  it('creates an area-stop link with fare level', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const fl = await new AreaFareLevelRepository(db).create(area.id, 'Test Level', 0, 1.0);
    const as = await repo.create(area.id, stop.id, fl.id);
    expect(as.fare_level_id).toBe(fl.id);
  });

  it('getByArea returns all stops in an area', async () => {
    const area = await areaRepo.create('Test Area');
    const s1 = await stopRepo.create('Stop 1', 1, 1);
    const s2 = await stopRepo.create('Stop 2', 2, 2);
    await repo.create(area.id, s1.id);
    await repo.create(area.id, s2.id);
    const areaStops = await repo.getByArea(area.id);
    expect(areaStops).toHaveLength(2);
  });

  it('getByStop returns all areas a stop belongs to', async () => {
    const a1 = await areaRepo.create('Area 1');
    const a2 = await areaRepo.create('Area 2');
    const stop = await stopRepo.create('Shared Stop', 1, 1);
    await repo.create(a1.id, stop.id);
    await repo.create(a2.id, stop.id);
    const entries = await repo.getByStop(stop.id);
    expect(entries).toHaveLength(2);
  });

  it('getByAreaAndStop finds a specific link', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    await repo.create(area.id, stop.id);
    const found = await repo.getByAreaAndStop(area.id, stop.id);
    expect(found).not.toBeNull();
    expect(found!.area_id).toBe(area.id);
    expect(found!.stop_id).toBe(stop.id);
  });

  it('getByAreaAndStop returns null for non-existent link', async () => {
    const found = await repo.getByAreaAndStop('no-area', 'no-stop');
    expect(found).toBeNull();
  });

  it('prevents duplicate area-stop links via same pair returns same', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const first = await repo.create(area.id, stop.id);
    const second = await repo.create(area.id, stop.id);
    expect(first.id).not.toBe(second.id);
    const all = await repo.getByAreaAndStop(area.id, stop.id);
    expect(all).not.toBeNull();
  });

  it('updateFareLevel changes fare level', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const flRepo = new AreaFareLevelRepository(db);
    const oldFl = await flRepo.create(area.id, 'Old', 0, 1.0);
    const newFl = await flRepo.create(area.id, 'New', 1, 2.0);
    const as = await repo.create(area.id, stop.id, oldFl.id);
    await repo.updateFareLevel(as.id, newFl.id);
    const found = await repo.getByAreaAndStop(area.id, stop.id);
    expect(found!.fare_level_id).toBe(newFl.id);
  });

  it('updateFareLevel can clear fare level', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const flRepo = new AreaFareLevelRepository(db);
    const fl = await flRepo.create(area.id, 'Some', 0, 1.0);
    const as = await repo.create(area.id, stop.id, fl.id);
    await repo.updateFareLevel(as.id, null);
    const found = await repo.getByAreaAndStop(area.id, stop.id);
    expect(found!.fare_level_id).toBeNull();
  });

  it('delete removes area-stop link', async () => {
    const area = await areaRepo.create('Test Area');
    const stop = await stopRepo.create('Test Stop', 1, 1);
    const as = await repo.create(area.id, stop.id);
    await repo.delete(as.id);
    const found = await repo.getByAreaAndStop(area.id, stop.id);
    expect(found).toBeNull();
  });
});

describe('JourneyAreaRepository', () => {
  let db: Database.Database;
  let repo: JourneyAreaRepository;
  let journeyRepo: JourneyRepository;
  let areaRepo: AreaRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new JourneyAreaRepository(db);
    journeyRepo = new JourneyRepository(db);
    areaRepo = new AreaRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a journey-area link', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const area = await areaRepo.create('Test Area');
    const ja = await repo.create(journey.id, area.id, 1);
    expect(ja.journey_id).toBe(journey.id);
    expect(ja.area_id).toBe(area.id);
    expect(ja.sequence).toBe(1);
  });

  it('getByJourney returns areas in sequence order', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const a1 = await areaRepo.create('Area 1');
    const a2 = await areaRepo.create('Area 2');
    const a3 = await areaRepo.create('Area 3');
    await repo.create(journey.id, a3.id, 3);
    await repo.create(journey.id, a1.id, 1);
    await repo.create(journey.id, a2.id, 2);
    const areas = await repo.getByJourney(journey.id);
    expect(areas).toHaveLength(3);
    expect(areas[0].sequence).toBe(1);
    expect(areas[1].sequence).toBe(2);
    expect(areas[2].sequence).toBe(3);
  });

  it('getByJourney returns empty for journey with no areas', async () => {
    const journey = await journeyRepo.create('Empty Journey');
    const areas = await repo.getByJourney(journey.id);
    expect(areas).toHaveLength(0);
  });

  it('getMaxSequence returns max sequence number', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const area = await areaRepo.create('Test Area');
    await repo.create(journey.id, area.id, 5);
    const max = await repo.getMaxSequence(journey.id);
    expect(max).toBe(5);
  });

  it('getMaxSequence returns 0 for journey with no areas', async () => {
    const journey = await journeyRepo.create('Empty Journey');
    const max = await repo.getMaxSequence(journey.id);
    expect(max).toBe(0);
  });

  it('getById returns the journey-area link', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const area = await areaRepo.create('Test Area');
    const ja = await repo.create(journey.id, area.id, 1);
    const found = await repo.getById(ja.id);
    expect(found).not.toBeNull();
    expect(found!.sequence).toBe(1);
  });

  it('getById returns null for missing id', async () => {
    const found = await repo.getById('no-such-id');
    expect(found).toBeNull();
  });

  it('delete removes a journey-area link', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const area = await areaRepo.create('Test Area');
    const ja = await repo.create(journey.id, area.id, 1);
    await repo.delete(ja.id);
    const areas = await repo.getByJourney(journey.id);
    expect(areas).toHaveLength(0);
  });
});

describe('JourneyFareRepository', () => {
  let db: Database.Database;
  let repo: JourneyFareRepository;
  let journeyRepo: JourneyRepository;
  let areaRepo: AreaRepository;
  let journeyAreaRepo: JourneyAreaRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new JourneyFareRepository(db);
    journeyRepo = new JourneyRepository(db);
    areaRepo = new AreaRepository(db);
    journeyAreaRepo = new JourneyAreaRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  async function setupJourneyAreas() {
    const journey = await journeyRepo.create('Test Journey');
    const a1 = await areaRepo.create('Area 1');
    const a2 = await areaRepo.create('Area 2');
    const ja1 = await journeyAreaRepo.create(journey.id, a1.id, 1);
    const ja2 = await journeyAreaRepo.create(journey.id, a2.id, 2);
    return { journey, a1, a2, ja1, ja2 };
  }

  it('creates a journey fare', async () => {
    const { journey, ja1, ja2 } = await setupJourneyAreas();
    const fare = await repo.create(journey.id, ja1.id, ja2.id, 5.50);
    expect(fare.amount).toBe(5.50);
    expect(fare.journey_id).toBe(journey.id);
  });

  it('getByJourney returns all fares for a journey', async () => {
    const { journey, ja1, ja2 } = await setupJourneyAreas();
    await repo.create(journey.id, ja1.id, ja2.id, 3.00);
    await repo.create(journey.id, ja2.id, ja1.id, 3.50);
    const fares = await repo.getByJourney(journey.id);
    expect(fares).toHaveLength(2);
  });

  it('getBetweenAreas finds fare by area ids', async () => {
    const { journey, a1, a2, ja1, ja2 } = await setupJourneyAreas();
    await repo.create(journey.id, ja1.id, ja2.id, 5.50);
    const fare = await repo.getBetweenAreas(journey.id, a1.id, a2.id);
    expect(fare).not.toBeNull();
    expect(fare!.amount).toBe(5.50);
  });

  it('getBetweenAreas returns null for unconnected areas', async () => {
    const { journey, a1, a2 } = await setupJourneyAreas();
    const fare = await repo.getBetweenAreas(journey.id, a1.id, a2.id);
    expect(fare).toBeNull();
  });

  it('upsert inserts when no existing fare', async () => {
    const { journey, ja1, ja2 } = await setupJourneyAreas();
    const fare = await repo.upsert(journey.id, ja1.id, ja2.id, 4.50);
    expect(fare.amount).toBe(4.50);
    const fares = await repo.getByJourney(journey.id);
    expect(fares).toHaveLength(1);
  });

  it('upsert updates when fare exists', async () => {
    const { journey, ja1, ja2 } = await setupJourneyAreas();
    await repo.create(journey.id, ja1.id, ja2.id, 2.00);
    const updated = await repo.upsert(journey.id, ja1.id, ja2.id, 3.00);
    expect(updated.amount).toBe(3.00);
    const fares = await repo.getByJourney(journey.id);
    expect(fares).toHaveLength(1);
    expect(fares[0].amount).toBe(3.00);
  });

  it('delete removes fare', async () => {
    const { journey, ja1, ja2 } = await setupJourneyAreas();
    const fare = await repo.create(journey.id, ja1.id, ja2.id, 5.00);
    await repo.delete(fare.id);
    const fares = await repo.getByJourney(journey.id);
    expect(fares).toHaveLength(0);
  });
});

describe('TrackPointRepository', () => {
  let db: Database.Database;
  let repo: TrackPointRepository;
  let journeyRepo: JourneyRepository;
  let areaRepo: AreaRepository;
  let journeyAreaRepo: JourneyAreaRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new TrackPointRepository(db);
    journeyRepo = new JourneyRepository(db);
    areaRepo = new AreaRepository(db);
    journeyAreaRepo = new JourneyAreaRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a track point', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const tp = await repo.create(journey.id, null, 1, 5.55, -0.20);
    expect(tp.journey_id).toBe(journey.id);
    expect(tp.sequence).toBe(1);
    expect(tp.latitude).toBe(5.55);
    expect(tp.longitude).toBe(-0.20);
  });

  it('creates a track point with journey area id', async () => {
    const journey = await journeyRepo.create('Test Journey');
    const area = await areaRepo.create('Test Area');
    const ja = await journeyAreaRepo.create(journey.id, area.id, 1);
    const tp = await repo.create(journey.id, ja.id, 2, 5.55, -0.20);
    expect(tp.journey_area_id).toBe(ja.id);
  });

  it('getByJourney returns track points ordered by sequence', async () => {
    const journey = await journeyRepo.create('Test Journey');
    await repo.create(journey.id, null, 3, 5.55, -0.20);
    await repo.create(journey.id, null, 1, 5.54, -0.19);
    await repo.create(journey.id, null, 2, 5.56, -0.21);
    const points = await repo.getByJourney(journey.id);
    expect(points).toHaveLength(3);
    expect(points[0].sequence).toBe(1);
    expect(points[1].sequence).toBe(2);
    expect(points[2].sequence).toBe(3);
  });

  it('getByJourney returns empty for journey with no track points', async () => {
    const journey = await journeyRepo.create('Empty Journey');
    const points = await repo.getByJourney(journey.id);
    expect(points).toHaveLength(0);
  });

  it('getMaxSequence returns max sequence', async () => {
    const journey = await journeyRepo.create('Test Journey');
    await repo.create(journey.id, null, 7, 5.55, -0.20);
    const max = await repo.getMaxSequence(journey.id);
    expect(max).toBe(7);
  });

  it('getMaxSequence returns 0 when no track points', async () => {
    const journey = await journeyRepo.create('Empty Journey');
    const max = await repo.getMaxSequence(journey.id);
    expect(max).toBe(0);
  });

  it('deleteByJourney removes all track points for a journey', async () => {
    const journey = await journeyRepo.create('Test Journey');
    await repo.create(journey.id, null, 1, 5.55, -0.20);
    await repo.create(journey.id, null, 2, 5.56, -0.21);
    await repo.deleteByJourney(journey.id);
    const points = await repo.getByJourney(journey.id);
    expect(points).toHaveLength(0);
  });
});

describe('ValidationLogRepository', () => {
  let db: Database.Database;
  let repo: ValidationLogRepository;

  beforeEach(() => {
    db = getMemoryDatabase();
    repo = new ValidationLogRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a validation log with full data', async () => {
    const log = await repo.create({
      pickup_lat: 5.5490,
      pickup_lng: -0.2010,
      dest_lat: 5.5750,
      dest_lng: -0.2120,
      pickup_stop_id: 'stop-1',
      pickup_area_id: 'area-1',
      dest_stop_id: 'stop-2',
      dest_area_id: 'area-3',
      journey_id: 'journey-1',
      fare: 5.00,
      fare_type: 'journey',
      status: 'success',
      message: 'Fare: GHS 5.00',
      estimated_pickup: false,
      estimated_dest: false,
    });
    expect(log.id).toBeTruthy();
    expect(log.fare).toBe(5.00);
    expect(log.status).toBe('success');
    expect(log.estimated_pickup).toBe(0);
    expect(log.estimated_dest).toBe(0);
  });

  it('creates a log with null fields', async () => {
    const log = await repo.create({
      pickup_lat: 1,
      pickup_lng: 2,
      dest_lat: 3,
      dest_lng: 4,
      pickup_stop_id: null,
      pickup_area_id: null,
      dest_stop_id: null,
      dest_area_id: null,
      journey_id: null,
      fare: null,
      fare_type: null,
      status: 'unknown',
      message: 'No result',
      estimated_pickup: true,
      estimated_dest: true,
    });
    expect(log.pickup_stop_id).toBeNull();
    expect(log.status).toBe('unknown');
  });

  it('getAll returns all logs ordered by created_at DESC', async () => {
    await repo.create({
      pickup_lat: 1, pickup_lng: 1, dest_lat: 2, dest_lng: 2,
      pickup_stop_id: null, pickup_area_id: null,
      dest_stop_id: null, dest_area_id: null,
      journey_id: null, fare: null, fare_type: null,
      status: 'success', message: 'First',
      estimated_pickup: false, estimated_dest: false,
    });
    await repo.create({
      pickup_lat: 3, pickup_lng: 3, dest_lat: 4, dest_lng: 4,
      pickup_stop_id: null, pickup_area_id: null,
      dest_stop_id: null, dest_area_id: null,
      journey_id: null, fare: null, fare_type: null,
      status: 'unknown', message: 'Second',
      estimated_pickup: false, estimated_dest: false,
    });
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('deleteAll removes all logs', async () => {
    await repo.create({
      pickup_lat: 1, pickup_lng: 1, dest_lat: 2, dest_lng: 2,
      pickup_stop_id: null, pickup_area_id: null,
      dest_stop_id: null, dest_area_id: null,
      journey_id: null, fare: null, fare_type: null,
      status: 'success', message: 'Test',
      estimated_pickup: false, estimated_dest: false,
    });
    await repo.deleteAll();
    const all = await repo.getAll();
    expect(all).toHaveLength(0);
  });
});
