import { getMemoryDatabase, closeDatabase } from '../database';
import { seedDatabase } from './seed';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ExportService } from '@mateapp/core';
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
  await seedDatabase(db);

  const deps = {
    journeyRepo: new JourneyRepository(db),
    areaRepo: new AreaRepository(db),
    stopRepo: new StopRepository(db),
    journeyAreaRepo: new JourneyAreaRepository(db),
    journeyFareRepo: new JourneyFareRepository(db),
    trackPointRepo: new TrackPointRepository(db),
    areaFareLevelRepo: new AreaFareLevelRepository(db),
    areaStopRepo: new AreaStopRepository(db),
    validationLogRepo: new ValidationLogRepository(db),
  };

  const exportService = new ExportService(deps);

  const journeys = await deps.journeyRepo.getAll();
  for (const j of journeys) {
    const result = await exportService.exportJourneyXlsx(j.id);
    if (result) {
      const outPath = path.join(process.cwd(), `${result.fileName}`);
      fs.writeFileSync(outPath, Buffer.from(result.base64, 'base64'));
      console.log(`Exported: ${outPath}`);
    }
  }

  const master = await exportService.exportMasterXlsx();
  if (master) {
    const outPath = path.join(process.cwd(), master.fileName);
    fs.writeFileSync(outPath, Buffer.from(master.base64, 'base64'));
    console.log(`Master export: ${outPath}`);
  }

  closeDatabase();
}

main().catch(console.error);
