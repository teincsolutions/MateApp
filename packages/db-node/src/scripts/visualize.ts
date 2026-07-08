import { getMemoryDatabase, closeDatabase } from '../database';
import { seedDatabase } from './seed';
import { ValidationService } from '@mateapp/core';
import { GeometryService } from '@mateapp/core';
import { JourneyRepository } from '../repositories/JourneyRepository';
import { AreaRepository } from '../repositories/AreaRepository';
import { StopRepository } from '../repositories/StopRepository';
import { AreaFareLevelRepository } from '../repositories/AreaFareLevelRepository';
import { AreaStopRepository } from '../repositories/AreaStopRepository';
import { JourneyAreaRepository } from '../repositories/JourneyAreaRepository';
import { JourneyFareRepository } from '../repositories/JourneyFareRepository';
import { TrackPointRepository } from '../repositories/TrackPointRepository';
import { ValidationLogRepository } from '../repositories/ValidationLogRepository';

async function main() {
  const db = getMemoryDatabase();
  const data = await seedDatabase(db);

  const deps = {
    stopRepo: new StopRepository(db),
    areaRepo: new AreaRepository(db),
    journeyAreaRepo: new JourneyAreaRepository(db),
    journeyFareRepo: new JourneyFareRepository(db),
    areaStopRepo: new AreaStopRepository(db),
    areaFareLevelRepo: new AreaFareLevelRepository(db),
    journeyRepo: new JourneyRepository(db),
    validationLogRepo: new ValidationLogRepository(db),
  };

  console.log('╔══════════════════════════════════════╗');
  console.log('║      MATEAPP — DATA VISUALIZATION    ║');
  console.log('╚══════════════════════════════════════╝\n');

  console.log('── JOURNEY ──');
  console.log(`  Name: ${data.journey.name}`);
  console.log(`  Areas: ${data.areas.map(a => a.name).join(' → ')}\n`);

  console.log('── INTER-AREA FARES ──');
  console.log('  From          To            Amount');
  console.log('  ────────────  ────────────  ──────');
  const areaNames = new Map(data.areas.map(a => [a.id, a.name]));
  for (const f of data.journeyFares) {
    const fromJA = data.journeyAreas.find(ja => ja.id === f.fromJAId);
    const toJA = data.journeyAreas.find(ja => ja.id === f.toJAId);
    const fromName = areaNames.get(fromJA?.areaId || '') || '?';
    const toName = areaNames.get(toJA?.areaId || '') || '?';
    console.log(`  ${fromName.padEnd(12)}  ${toName.padEnd(12)}  GHS ${f.amount.toFixed(2)}`);
  }

  console.log('\n── INTRA-AREA FARE LEVELS ──');
  for (const fl of data.fareLevels) {
    const areaName = areaNames.get(fl.areaId) || '?';
    console.log(`  ${areaName} / ${fl.label.padEnd(10)}  GHS ${fl.amount.toFixed(2)}`);
  }

  console.log('\n── STOPS ──');
  for (const s of data.stops) {
    console.log(`  ${s.label.padEnd(20)}  (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`);
  }

  console.log(`\n── TRACK POINTS ──`);
  console.log(`  Total: ${data.trackPoints.length} points`);
  const tps = data.trackPoints;
  if (tps.length >= 2) {
    let totalDist = 0;
    for (let i = 1; i < tps.length; i++) {
      totalDist += GeometryService.haversineDistance(tps[i-1].lat, tps[i-1].lng, tps[i].lat, tps[i].lng);
    }
    console.log(`  Route length: ${(totalDist / 1000).toFixed(2)} km`);
  }

  console.log('\n── VALIDATION TESTS ──');
  const validationService = new ValidationService(deps);

  const result1 = await validationService.validate(5.5490, -0.2010, 5.5750, -0.2120);
  console.log(`  Kejetia → Suame: ${result1.status}`);
  console.log(`    Journey: ${result1.journey?.name || 'N/A'}`);
  console.log(`    Pickup:  ${result1.pickupStop?.label || 'N/A'} (${result1.pickupArea?.name || '?'})`);
  console.log(`    Dest:    ${result1.destStop?.label || 'N/A'} (${result1.destArea?.name || '?'})`);
  console.log(`    Fare:    ${result1.fare !== null ? `GHS ${result1.fare.toFixed(2)}` : 'N/A'} (${result1.fareType || '?'})`);

  const result2 = await validationService.validate(5.5490, -0.2010, 5.5495, -0.2005);
  console.log(`\n  Kejetia → Kejetia (intra-area): ${result2.status}`);
  console.log(`    Journey: ${result2.journey?.name || 'N/A'}`);
  console.log(`    Fare:    ${result2.fare !== null ? `GHS ${result2.fare.toFixed(2)}` : 'N/A'} (${result2.fareType || '?'})`);

  const result3 = await validationService.validate(5.7000, -0.3000, 5.7500, -0.3500);
  console.log(`\n  Unknown → Unknown: ${result3.status}`);
  console.log(`    Message: ${result3.message}`);

  closeDatabase();
}

main().catch(console.error);
