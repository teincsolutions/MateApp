import * as XLSX from 'xlsx';
import {
  IJourneyRepository,
  IAreaRepository,
  IStopRepository,
  IJourneyAreaRepository,
  IJourneyFareRepository,
  ITrackPointRepository,
  IFareLevelRepository,
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
  areaFareLevelRepo: IFareLevelRepository;
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
    const areaIds = journeyAreas.map(ja => ja.area_id);
    const areas = [];
    const areaNameMap = new Map<string, string>();
    for (const areaId of areaIds) {
      const area = await this.deps.areaRepo.getById(areaId);
      if (area) {
        areas.push(area);
        areaNameMap.set(area.id, area.name);
      }
    }
    const jaRows = [['ID', 'Area', 'Area ID', 'Sequence', 'Created'], ...journeyAreas.map(ja => [ja.id, areaNameMap.get(ja.area_id) || '', ja.area_id, String(ja.sequence), ja.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(jaRows), 'JourneyAreas');

    // Areas sheet
    const areaRows = [['ID', 'Name', 'Created'], ...areas.map(a => [a.id, a.name, a.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), 'Areas');

    // Stops sheet
    const allStops: string[][] = [];
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of stops) {
        allStops.push([area.name, stop.id, stop.label, String(stop.latitude), String(stop.longitude), String(stop.radius)]);
      }
    }
    const stopRows = [['Area', 'ID', 'Stops', 'Latitude', 'Longitude', 'Radius'], ...allStops];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopRows), 'Stops');

    // JourneyFares sheet
    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
    const fareRows = [['ID', 'From JA', 'To JA', 'Fare Level ID'], ...fares.map(f => [f.id, f.from_journey_area_id, f.to_journey_area_id, f.fare_level_id] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fareRows), 'Fares');

    // FareLevels sheet (journey-scoped)
    const fareLevels = await this.deps.areaFareLevelRepo.getByJourney(journeyId);
    const lvlRows = [['ID', 'Journey ID', 'Label', 'Order', 'Amount'], ...fareLevels.map(lvl => [lvl.id, lvl.journey_id, lvl.label, String(lvl.order_no), String(lvl.amount)] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lvlRows), 'FareLevels');

    // Fare Summary sheet — human-readable unified view
    const summaryRows: string[][] = [['Area', 'Stops / Destination', 'Latitude', 'Longitude', 'Fare (GHS)']];
    for (const area of areas) {
      const areaStops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of areaStops) {
        const areaStopLink = await this.deps.areaStopRepo.getByAreaAndStop(area.id, stop.id);
        const fl = areaStopLink?.fare_level_id
          ? await this.deps.areaFareLevelRepo.getByAreaStop(areaStopLink.id)
          : null;
        summaryRows.push([area.name, stop.label, String(stop.latitude), String(stop.longitude), fl ? fl.amount.toFixed(2) : '-']);
      }
      // Add inter-area fares from this area to later areas
      for (const jaTo of journeyAreas) {
        if (jaTo.sequence <= journeyAreas.find(ja => ja.area_id === area.id)!.sequence) continue;
        const fare = await this.deps.journeyFareRepo.getBetweenAreas(journeyId, area.id, jaTo.area_id);
        if (fare) {
          const fl = fareLevels.find(l => l.id === fare.fare_level_id);
          const toName = areaNameMap.get(jaTo.area_id) || '';
          summaryRows.push([area.name, toName, '-', '-', fl ? fl.amount.toFixed(2) : '-']);
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Fare Summary');

    // Stop Fares sheet — per-stop fare levels within areas
    const stopFareRows: string[][] = [['Area', 'Stop', 'Latitude', 'Longitude', 'Fare Level', 'Amount (GHS)']];
    for (const area of areas) {
      const areaStops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of areaStops) {
        const areaStopLink = await this.deps.areaStopRepo.getByAreaAndStop(area.id, stop.id);
        const fl = areaStopLink?.fare_level_id
          ? await this.deps.areaFareLevelRepo.getByAreaStop(areaStopLink.id)
          : null;
        stopFareRows.push([area.name, stop.label, String(stop.latitude), String(stop.longitude), fl?.label || '-', fl ? fl.amount.toFixed(2) : '-']);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopFareRows), 'Stop Fares');

    // Journey Fares sheet — inter-area fares only
    const journeyFareRows: string[][] = [['From Area', 'To Area', 'Fare Level', 'Amount (GHS)']];
    for (const f of fares) {
      const fromJA = journeyAreas.find(ja => ja.id === f.from_journey_area_id);
      const toJA = journeyAreas.find(ja => ja.id === f.to_journey_area_id);
      const fl = fareLevels.find(l => l.id === f.fare_level_id);
      const fromName = fromJA ? areaNameMap.get(fromJA.area_id) || '' : '';
      const toName = toJA ? areaNameMap.get(toJA.area_id) || '' : '';
      journeyFareRows.push([fromName, toName, fl?.label || '', fl ? fl.amount.toFixed(2) : '-']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journeyFareRows), 'Journey Fares');

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
        allStops.push(`Stop,${escapeCsv(area.name)},${escapeCsv(stop.id)},${escapeCsv(stop.label)},${stop.latitude},${stop.longitude},${stop.radius}`);
      }
    }
    if (allStops.length > 0) {
      lines.push('\nType,Area,Stop ID,Stops,Latitude,Longitude,Radius');
      lines.push(...allStops);
    }

    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
    if (fares.length > 0) {
      lines.push('\nType,From JA ID,To JA ID,Fare Level ID');
      for (const f of fares) {
        lines.push(`Fare,${escapeCsv(f.from_journey_area_id)},${escapeCsv(f.to_journey_area_id)},${escapeCsv(f.fare_level_id)}`);
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
    lines.push('ID,Stops,Latitude,Longitude,Radius,Created');
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
