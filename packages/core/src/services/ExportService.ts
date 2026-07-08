import * as XLSX from 'xlsx';
import {
  IJourneyRepository,
  IAreaRepository,
  IStopRepository,
  IJourneyAreaRepository,
  IJourneyFareRepository,
  ITrackPointRepository,
  IAreaFareLevelRepository,
  IAreaStopRepository,
  IValidationLogRepository,
} from '../repositories/interfaces';

export interface ExportDependencies {
  journeyRepo: IJourneyRepository;
  areaRepo: IAreaRepository;
  stopRepo: IStopRepository;
  journeyAreaRepo: IJourneyAreaRepository;
  journeyFareRepo: IJourneyFareRepository;
  trackPointRepo: ITrackPointRepository;
  areaFareLevelRepo: IAreaFareLevelRepository;
  areaStopRepo: IAreaStopRepository;
  validationLogRepo: IValidationLogRepository;
}

export class ExportService {
  constructor(private deps: ExportDependencies) {}

  async exportJourneyXlsx(journeyId: string): Promise<{ base64: string; fileName: string } | null> {
    const journey = await this.deps.journeyRepo.getById(journeyId);
    if (!journey) return null;

    const wb = XLSX.utils.book_new();

    // Journey sheet
    const journeyRows = [['ID', 'Name', 'Status', 'Created', 'Updated'], [journey.id, journey.name, journey.status, journey.created_at, journey.updated_at]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journeyRows), 'Journey');

    // JourneyAreas sheet
    const journeyAreas = await this.deps.journeyAreaRepo.getByJourney(journeyId);
    const jaRows = [['ID', 'Area ID', 'Sequence', 'Created'], ...journeyAreas.map(ja => [ja.id, ja.area_id, ja.sequence, ja.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(jaRows), 'JourneyAreas');

    // Areas sheet
    const areaIds = journeyAreas.map(ja => ja.area_id);
    const areas = [];
    for (const areaId of areaIds) {
      const area = await this.deps.areaRepo.getById(areaId);
      if (area) areas.push(area);
    }
    const areaRows = [['ID', 'Name', 'Created'], ...areas.map(a => [a.id, a.name, a.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), 'Areas');

    // Stops sheet
    const allStops: string[][] = [];
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of stops) {
        allStops.push([stop.id, stop.label, String(stop.latitude), String(stop.longitude), String(stop.radius), area.name]);
      }
    }
    const stopRows = [['ID', 'Label', 'Latitude', 'Longitude', 'Radius', 'Area'], ...allStops];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopRows), 'Stops');

    // JourneyFares sheet
    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
    const fareRows = [['ID', 'From JA', 'To JA', 'Amount'], ...fares.map(f => [f.id, f.from_journey_area_id, f.to_journey_area_id, String(f.amount)] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fareRows), 'Fares');

    // AreaFareLevels sheet
    const allFareLevels: string[][] = [];
    for (const area of areas) {
      const levels = await this.deps.areaFareLevelRepo.getByArea(area.id);
      for (const lvl of levels) {
        allFareLevels.push([lvl.id, area.name, lvl.label, String(lvl.order_no), String(lvl.amount)]);
      }
    }
    const lvlRows = [['ID', 'Area', 'Label', 'Order', 'Amount'], ...allFareLevels];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lvlRows), 'FareLevels');

    // TrackPoints sheet
    const trackPoints = await this.deps.trackPointRepo.getByJourney(journeyId);
    const tpRows = [['ID', 'Sequence', 'Latitude', 'Longitude', 'Created'], ...trackPoints.map(tp => [tp.id, String(tp.sequence), String(tp.latitude), String(tp.longitude), tp.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tpRows), 'TrackPoints');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `journey_${journey.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    return { base64, fileName };
  }

  async exportMasterXlsx(): Promise<{ base64: string; fileName: string } | null> {
    const wb = XLSX.utils.book_new();

    const journeys = await this.deps.journeyRepo.getAll();
    const journeyRows = [['ID', 'Name', 'Status', 'Start Area', 'End Area', 'Created'], ...journeys.map(j => [j.id, j.name, j.status, j.start_area_id || '', j.end_area_id || '', j.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journeyRows), 'Journeys');

    const areas = await this.deps.areaRepo.getAll();
    const areaRows = [['ID', 'Name', 'Polygon', 'Created'], ...areas.map(a => [a.id, a.name, a.polygon || '', a.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), 'Areas');

    const stops = await this.deps.stopRepo.getAll();
    const stopRows = [['ID', 'Label', 'Latitude', 'Longitude', 'Radius', 'Created'], ...stops.map(s => [s.id, s.label, String(s.latitude), String(s.longitude), String(s.radius), s.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopRows), 'Stops');

    const logs = await this.deps.validationLogRepo.getAll();
    const logRows = [['ID', 'Pickup Lat', 'Pickup Lng', 'Dest Lat', 'Dest Lng', 'Status', 'Message', 'Created'], ...logs.map(l => [l.id, String(l.pickup_lat), String(l.pickup_lng), String(l.dest_lat), String(l.dest_lng), l.status, l.message, l.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), 'ValidationLogs');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = 'mateapp_master_export.xlsx';
    return { base64, fileName };
  }

  async exportJourneyCsv(journeyId: string): Promise<{ content: string; fileName: string } | null> {
    const journey = await this.deps.journeyRepo.getById(journeyId);
    if (!journey) return null;

    const journeyAreas = await this.deps.journeyAreaRepo.getByJourney(journeyId);
    const areaIds = journeyAreas.map(ja => ja.area_id);
    const areas = [];
    for (const areaId of areaIds) {
      const area = await this.deps.areaRepo.getById(areaId);
      if (area) areas.push(area);
    }

    const lines: string[] = [];

    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    lines.push('Type,ID,Name,Status,Created');
    lines.push(`Journey,${escapeCsv(journey.id)},${escapeCsv(journey.name)},${escapeCsv(journey.status)},${escapeCsv(journey.created_at)}`);

    lines.push('\nType,Area ID,Area Name');
    for (const area of areas) {
      lines.push(`Area,${escapeCsv(area.id)},${escapeCsv(area.name)}`);
    }

    const allStops: string[] = [];
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of stops) {
        allStops.push(`Stop,${escapeCsv(stop.id)},${escapeCsv(stop.label)},${stop.latitude},${stop.longitude},${stop.radius},${escapeCsv(area.name)}`);
      }
    }
    if (allStops.length > 0) {
      lines.push('\nType,Stop ID,Label,Latitude,Longitude,Radius,Area');
      lines.push(...allStops);
    }

    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
    if (fares.length > 0) {
      lines.push('\nType,From JA ID,To JA ID,Amount');
      for (const f of fares) {
        lines.push(`Fare,${escapeCsv(f.from_journey_area_id)},${escapeCsv(f.to_journey_area_id)},${f.amount}`);
      }
    }

    const tps = await this.deps.trackPointRepo.getByJourney(journeyId);
    if (tps.length > 0) {
      lines.push('\nType,Sequence,Latitude,Longitude,Created');
      for (const tp of tps) {
        lines.push(`TrackPoint,${tp.sequence},${tp.latitude},${tp.longitude},${escapeCsv(tp.created_at)}`);
      }
    }

    const fileName = `journey_${journey.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    return { content: lines.join('\n'), fileName };
  }

  async exportMasterCsv(): Promise<{ content: string; fileName: string } | null> {
    const lines: string[] = [];
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const journeys = await this.deps.journeyRepo.getAll();
    lines.push('ID,Name,Status,Start Area,End Area,Created');
    for (const j of journeys) {
      lines.push(`${escapeCsv(j.id)},${escapeCsv(j.name)},${escapeCsv(j.status)},${escapeCsv(j.start_area_id)},${escapeCsv(j.end_area_id)},${escapeCsv(j.created_at)}`);
    }

    const areas = await this.deps.areaRepo.getAll();
    lines.push('\n--- Areas ---');
    lines.push('ID,Name,Created');
    for (const a of areas) {
      lines.push(`${escapeCsv(a.id)},${escapeCsv(a.name)},${escapeCsv(a.created_at)}`);
    }

    const stops = await this.deps.stopRepo.getAll();
    lines.push('\n--- Stops ---');
    lines.push('ID,Label,Latitude,Longitude,Radius,Created');
    for (const s of stops) {
      lines.push(`${escapeCsv(s.id)},${escapeCsv(s.label)},${s.latitude},${s.longitude},${s.radius},${escapeCsv(s.created_at)}`);
    }

    const logs = await this.deps.validationLogRepo.getAll();
    lines.push('\n--- Validation Logs ---');
    lines.push('ID,Pickup Lat,Pickup Lng,Dest Lat,Dest Lng,Status,Message,Created');
    for (const l of logs) {
      lines.push(`${escapeCsv(l.id)},${l.pickup_lat},${l.pickup_lng},${l.dest_lat},${l.dest_lng},${escapeCsv(l.status)},${escapeCsv(l.message)},${escapeCsv(l.created_at)}`);
    }

    return { content: lines.join('\n'), fileName: 'mateapp_master_export.csv' };
  }
}
