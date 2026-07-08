import type Database from 'better-sqlite3';
import {
  JourneyRepository,
  AreaRepository,
  StopRepository,
  AreaFareLevelRepository,
  AreaStopRepository,
  JourneyAreaRepository,
  JourneyFareRepository,
  TrackPointRepository,
} from '@mateapp/db-node';

export interface TestSeedData {
  journey: { id: string; name: string };
  areas: Array<{ id: string; name: string }>;
  stops: Array<{ id: string; label: string; lat: number; lng: number }>;
  journeyAreas: Array<{ id: string; areaId: string; sequence: number }>;
  fareLevels: Array<{ id: string; areaId: string; label: string; amount: number }>;
  areaStops: Array<{ areaId: string; stopId: string }>;
  journeyFares: Array<{ fromJAId: string; toJAId: string; amount: number }>;
  trackPoints: Array<{ lat: number; lng: number }>;
}

export async function seedTestData(db: Database.Database): Promise<TestSeedData> {
  const journeyRepo = new JourneyRepository(db);
  const areaRepo = new AreaRepository(db);
  const stopRepo = new StopRepository(db);
  const fareLevelRepo = new AreaFareLevelRepository(db);
  const areaStopRepo = new AreaStopRepository(db);
  const journeyAreaRepo = new JourneyAreaRepository(db);
  const journeyFareRepo = new JourneyFareRepository(db);
  const trackPointRepo = new TrackPointRepository(db);

  const area1 = await areaRepo.create('Kejetia');
  const area2 = await areaRepo.create('Ashtown');
  const area3 = await areaRepo.create('Suame');

  const stop1a = await stopRepo.create('Kejetia Market', 5.5490, -0.2010);
  const stop1b = await stopRepo.create('Kejetia Station', 5.5495, -0.2005);
  const stop1c = await stopRepo.create('Kejetia Central', 5.5500, -0.2015);
  const stop1d = await stopRepo.create('Kejetia Trotro', 5.5485, -0.2020);

  const stop2a = await stopRepo.create('Ashtown Junction', 5.5600, -0.2050);
  const stop2b = await stopRepo.create('Ashtown Market', 5.5610, -0.2045);
  const stop2c = await stopRepo.create('Ashtown School', 5.5595, -0.2060);

  const stop3a = await stopRepo.create('Suame Roundabout', 5.5750, -0.2120);
  const stop3b = await stopRepo.create('Suame Magazine', 5.5760, -0.2115);
  const stop3c = await stopRepo.create('Suame Station', 5.5745, -0.2125);

  const fl1a = await fareLevelRepo.create(area1.id, 'Minimum', 0, 1.50);
  const fl1b = await fareLevelRepo.create(area1.id, 'Extended', 1, 2.50);
  const fl2a = await fareLevelRepo.create(area2.id, 'Minimum', 0, 2.00);
  const fl2b = await fareLevelRepo.create(area2.id, 'Extended', 1, 3.00);
  const fl3a = await fareLevelRepo.create(area3.id, 'Minimum', 0, 2.50);
  const fl3b = await fareLevelRepo.create(area3.id, 'Extended', 1, 3.50);

  await areaStopRepo.create(area1.id, stop1a.id, fl1a.id);
  await areaStopRepo.create(area1.id, stop1b.id, fl1a.id);
  await areaStopRepo.create(area1.id, stop1c.id, fl1b.id);
  await areaStopRepo.create(area1.id, stop1d.id, fl1b.id);
  await areaStopRepo.create(area2.id, stop2a.id, fl2a.id);
  await areaStopRepo.create(area2.id, stop2b.id, fl2b.id);
  await areaStopRepo.create(area2.id, stop2c.id, fl2a.id);
  await areaStopRepo.create(area3.id, stop3a.id, fl3a.id);
  await areaStopRepo.create(area3.id, stop3b.id, fl3b.id);
  await areaStopRepo.create(area3.id, stop3c.id, fl3a.id);

  const journey = await journeyRepo.create('Kejetia ↔ Suame');
  const ja1 = await journeyAreaRepo.create(journey.id, area1.id, 1);
  const ja2 = await journeyAreaRepo.create(journey.id, area2.id, 2);
  const ja3 = await journeyAreaRepo.create(journey.id, area3.id, 3);

  await journeyFareRepo.create(journey.id, ja1.id, ja2.id, 3.50);
  await journeyFareRepo.create(journey.id, ja1.id, ja3.id, 5.00);
  await journeyFareRepo.create(journey.id, ja2.id, ja3.id, 3.00);

  const trackCoords = [
    { lat: 5.5490, lng: -0.2010 },
    { lat: 5.5510, lng: -0.2015 },
    { lat: 5.5530, lng: -0.2025 },
    { lat: 5.5550, lng: -0.2035 },
    { lat: 5.5570, lng: -0.2040 },
    { lat: 5.5600, lng: -0.2050 },
    { lat: 5.5630, lng: -0.2060 },
    { lat: 5.5660, lng: -0.2070 },
    { lat: 5.5690, lng: -0.2080 },
    { lat: 5.5720, lng: -0.2100 },
    { lat: 5.5750, lng: -0.2120 },
  ];

  for (let i = 0; i < trackCoords.length; i++) {
    const ja = i < 3 ? ja1 : i < 6 ? ja2 : ja3;
    await trackPointRepo.create(journey.id, ja.id, i + 1, trackCoords[i].lat, trackCoords[i].lng);
  }

  return {
    journey: { id: journey.id, name: journey.name },
    areas: [
      { id: area1.id, name: area1.name },
      { id: area2.id, name: area2.name },
      { id: area3.id, name: area3.name },
    ],
    stops: [
      { id: stop1a.id, label: stop1a.label, lat: stop1a.latitude, lng: stop1a.longitude },
      { id: stop1b.id, label: stop1b.label, lat: stop1b.latitude, lng: stop1b.longitude },
      { id: stop1c.id, label: stop1c.label, lat: stop1c.latitude, lng: stop1c.longitude },
      { id: stop1d.id, label: stop1d.label, lat: stop1d.latitude, lng: stop1d.longitude },
      { id: stop2a.id, label: stop2a.label, lat: stop2a.latitude, lng: stop2a.longitude },
      { id: stop2b.id, label: stop2b.label, lat: stop2b.latitude, lng: stop2b.longitude },
      { id: stop2c.id, label: stop2c.label, lat: stop2c.latitude, lng: stop2c.longitude },
      { id: stop3a.id, label: stop3a.label, lat: stop3a.latitude, lng: stop3a.longitude },
      { id: stop3b.id, label: stop3b.label, lat: stop3b.latitude, lng: stop3b.longitude },
      { id: stop3c.id, label: stop3c.label, lat: stop3c.latitude, lng: stop3c.longitude },
    ],
    journeyAreas: [
      { id: ja1.id, areaId: area1.id, sequence: 1 },
      { id: ja2.id, areaId: area2.id, sequence: 2 },
      { id: ja3.id, areaId: area3.id, sequence: 3 },
    ],
    fareLevels: [
      { id: fl1a.id, areaId: area1.id, label: 'Minimum', amount: 1.50 },
      { id: fl1b.id, areaId: area1.id, label: 'Extended', amount: 2.50 },
      { id: fl2a.id, areaId: area2.id, label: 'Minimum', amount: 2.00 },
      { id: fl2b.id, areaId: area2.id, label: 'Extended', amount: 3.00 },
      { id: fl3a.id, areaId: area3.id, label: 'Minimum', amount: 2.50 },
      { id: fl3b.id, areaId: area3.id, label: 'Extended', amount: 3.50 },
    ],
    areaStops: [
      { areaId: area1.id, stopId: stop1a.id },
      { areaId: area1.id, stopId: stop1b.id },
      { areaId: area1.id, stopId: stop1c.id },
      { areaId: area1.id, stopId: stop1d.id },
      { areaId: area2.id, stopId: stop2a.id },
      { areaId: area2.id, stopId: stop2b.id },
      { areaId: area2.id, stopId: stop2c.id },
      { areaId: area3.id, stopId: stop3a.id },
      { areaId: area3.id, stopId: stop3b.id },
      { areaId: area3.id, stopId: stop3c.id },
    ],
    journeyFares: [
      { fromJAId: ja1.id, toJAId: ja2.id, amount: 3.50 },
      { fromJAId: ja1.id, toJAId: ja3.id, amount: 5.00 },
      { fromJAId: ja2.id, toJAId: ja3.id, amount: 3.00 },
    ],
    trackPoints: trackCoords,
  };
}
