import {
  ValidationService, ValidationResult, ValidationDependencies,
  ExportService as CoreExportService, ExportDependencies, CsvPart,
} from '@mateapp/core';

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
  JourneyExportService,
  getDatabase,
} from '@mateapp/db-sqlite';

const journeyRepo = new JourneyRepository();
const areaRepo = new AreaRepository();
const stopRepo = new StopRepository();
const areaFareLevelRepo = new AreaFareLevelRepository();
const areaStopRepo = new AreaStopRepository();
const journeyAreaRepo = new JourneyAreaRepository();
const journeyFareRepo = new JourneyFareRepository();
const trackPointRepo = new TrackPointRepository();
const validationLogRepo = new ValidationLogRepository();

export {
  journeyRepo as JourneyRepository,
  areaRepo as AreaRepository,
  stopRepo as StopRepository,
  areaFareLevelRepo as AreaFareLevelRepository,
  areaStopRepo as AreaStopRepository,
  journeyAreaRepo as JourneyAreaRepository,
  journeyFareRepo as JourneyFareRepository,
  trackPointRepo as TrackPointRepository,
  validationLogRepo as ValidationLogRepository,
};

const validationDeps: ValidationDependencies = {
  stopRepo, areaRepo, journeyAreaRepo, journeyFareRepo,
  areaStopRepo, areaFareLevelRepo, journeyRepo, validationLogRepo,
};

const validationService = new ValidationService(validationDeps);

export async function validateFare(pickupLat: number, pickupLng: number, destLat: number, destLng: number): Promise<ValidationResult> {
  return validationService.validate(pickupLat, pickupLng, destLat, destLng);
}

const exportDeps: ExportDependencies = {
  journeyRepo, areaRepo, stopRepo, journeyAreaRepo, journeyFareRepo,
  trackPointRepo, areaFareLevelRepo, areaStopRepo, validationLogRepo,
};

const exportService = new CoreExportService(exportDeps);

export async function exportJourneyXlsx(journeyId: string): Promise<{ base64: string; fileName: string } | null> {
  return exportService.exportJourneyXlsx(journeyId);
}

export async function exportMasterXlsx(): Promise<{ base64: string; fileName: string } | null> {
  return exportService.exportMasterXlsx();
}

export async function exportJourneyCsv(journeyId: string): Promise<{ content: string; fileName: string } | null> {
  return exportService.exportJourneyCsv(journeyId);
}

export async function exportJourneyCsvParts(journeyId: string): Promise<CsvPart[]> {
  return exportService.exportJourneyCsvParts(journeyId);
}

export async function exportMasterCsv(): Promise<{ content: string; fileName: string } | null> {
  return exportService.exportMasterCsv();
}

export async function exportMasterCsvParts(): Promise<CsvPart[]> {
  return exportService.masterCsvParts();
}

const journeyExportService = new JourneyExportService();

export async function exportJourneyDb(journeyIds: string[]): Promise<string> {
  const db = await getDatabase();
  return journeyExportService.exportJourneyDb(db, journeyIds);
}
