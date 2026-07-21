import * as XLSX from 'xlsx';
import { Stop } from '../types';
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

export interface CsvPart {
  name: string;
  content: string;
}

export class ExportService {
  constructor(private deps: ExportDependencies) {}

  async exportJourneyXlsx(journeyId: string): Promise<{ base64: string; fileName: string } | null> {
    const journey = await this.deps.journeyRepo.getById(journeyId);
    if (!journey) return null;

    const wb = XLSX.utils.book_new();

    // Journey sheet
    const journeyRows = [['Name', 'Status', 'Created', 'Updated'], [journey.name, journey.status, journey.created_at, journey.updated_at]];
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
    const jaRows = [['Area', 'Sequence', 'Created'], ...journeyAreas.map(ja => [areaNameMap.get(ja.area_id) || '', String(ja.sequence), ja.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(jaRows), 'JourneyAreas');

    // Areas sheet
    const areaRows = [['Name', 'Created'], ...areas.map(a => [a.name, a.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), 'Areas');

    // Stops sheet
    const allStops: string[][] = [];
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of stops) {
        allStops.push([area.name, stop.label, String(stop.latitude), String(stop.longitude), String(stop.radius)]);
      }
    }
    const stopRows = [['Area', 'Stop', 'Latitude', 'Longitude', 'Radius'], ...allStops];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopRows), 'Stops');

    // Fare Levels sheet (journey-scoped)
    const fareLevels = await this.deps.areaFareLevelRepo.getByJourney(journeyId);
    const lvlRows = [['Label', 'Order', 'Amount (GHS)'], ...fareLevels.map(lvl => [lvl.label, String(lvl.order_no), String(lvl.amount)] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lvlRows), 'Fare Levels');

    // Fare Summary sheet — human-readable unified view
    const areaStopsMap = new Map<string, Stop[]>();
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      stops.sort((a, b) => a.seq - b.seq);
      areaStopsMap.set(area.id, stops);
    }
    const summaryRows: string[][] = [['Area', 'Stop / Destination', 'Latitude', 'Longitude', 'Fare (GHS)']];
    for (const area of areas) {
      const areaStops = areaStopsMap.get(area.id) ?? [];
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
          const destAreaStops = areaStopsMap.get(jaTo.area_id) ?? [];
          const destLat = destAreaStops.length > 0 ? String(destAreaStops[0].latitude) : '-';
          const destLng = destAreaStops.length > 0 ? String(destAreaStops[0].longitude) : '-';
          summaryRows.push([area.name, toName, destLat, destLng, fl ? fl.amount.toFixed(2) : '-']);
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
    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
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
    const tpRows = [['Sequence', 'Latitude', 'Longitude', 'Created'], ...trackPoints.map(tp => [String(tp.sequence), String(tp.latitude), String(tp.longitude), tp.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tpRows), 'Track Points');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `journey_${journey.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    return { base64, fileName };
  }

  async exportMasterXlsx(): Promise<{ base64: string; fileName: string } | null> {
    const wb = XLSX.utils.book_new();

    const journeys = await this.deps.journeyRepo.getAll();
    const journeyRows = [['Name', 'Status', 'Start Area', 'End Area', 'Created'], ...journeys.map(j => [j.name, j.status, j.start_area_id || '', j.end_area_id || '', j.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journeyRows), 'Journeys');

    const areas = await this.deps.areaRepo.getAll();
    const areaRows = [['Name', 'Polygon', 'Created'], ...areas.map(a => [a.name, a.polygon || '', a.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), 'Areas');

    const stops = await this.deps.stopRepo.getAll();
    const stopRows = [['Label', 'Latitude', 'Longitude', 'Radius', 'Created'], ...stops.map(s => [s.label, String(s.latitude), String(s.longitude), String(s.radius), s.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stopRows), 'Stops');

    const logs = await this.deps.validationLogRepo.getAll();
    const logRows = [['Pickup Lat', 'Pickup Lng', 'Dest Lat', 'Dest Lng', 'Status', 'Message', 'Created'], ...logs.map(l => [String(l.pickup_lat), String(l.pickup_lng), String(l.dest_lat), String(l.dest_lng), l.status, l.message, l.created_at] as string[])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), 'Validation Logs');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = 'mateapp_master_export.xlsx';
    return { base64, fileName };
  }

  async exportJourneyCsvParts(journeyId: string): Promise<CsvPart[]> {
    const journey = await this.deps.journeyRepo.getById(journeyId);
    if (!journey) return [];

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

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const parts: CsvPart[] = [];

    // Journey
    const jLines = ['Name,Status,Created,Updated'];
    jLines.push(`${esc(journey.name)},${esc(journey.status)},${esc(journey.created_at)},${esc(journey.updated_at)}`);
    parts.push({ name: 'journey.csv', content: jLines.join('\n') });

    // Journey Areas
    const jaLines = ['Area,Sequence,Created'];
    for (const ja of journeyAreas) {
      jaLines.push(`${esc(areaNameMap.get(ja.area_id) || '')},${ja.sequence},${esc(ja.created_at)}`);
    }
    parts.push({ name: 'journey-areas.csv', content: jaLines.join('\n') });

    // Areas
    const aLines = ['Name,Created'];
    for (const a of areas) {
      aLines.push(`${esc(a.name)},${esc(a.created_at)}`);
    }
    parts.push({ name: 'areas.csv', content: aLines.join('\n') });

    // Stops
    const stopLines = ['Area,Stop,Latitude,Longitude,Radius'];
    for (const area of areas) {
      const stops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of stops) {
        stopLines.push(`${esc(area.name)},${esc(stop.label)},${stop.latitude},${stop.longitude},${stop.radius}`);
      }
    }
    parts.push({ name: 'stops.csv', content: stopLines.join('\n') });

    // Fare Levels
    const fl = await this.deps.areaFareLevelRepo.getByJourney(journeyId);
    if (fl.length > 0) {
      const flLines = ['Label,Order,Amount (GHS)'];
      for (const lvl of fl) {
        flLines.push(`${esc(lvl.label)},${lvl.order_no},${lvl.amount.toFixed(2)}`);
      }
      parts.push({ name: 'fare-levels.csv', content: flLines.join('\n') });
    }

    // Stop Fares
    const sfLines = ['Area,Stop,Latitude,Longitude,Fare Level,Amount (GHS)'];
    for (const area of areas) {
      const areaStops = await this.deps.stopRepo.findByArea(area.id);
      for (const stop of areaStops) {
        const link = await this.deps.areaStopRepo.getByAreaAndStop(area.id, stop.id);
        const fl2 = link?.fare_level_id ? await this.deps.areaFareLevelRepo.getByAreaStop(link.id) : null;
        sfLines.push(`${esc(area.name)},${esc(stop.label)},${stop.latitude},${stop.longitude},${esc(fl2?.label || '-')},${fl2 ? fl2.amount.toFixed(2) : '-'}`);
      }
    }
    parts.push({ name: 'stop-fares.csv', content: sfLines.join('\n') });

    // Fare Summary
    const areaStopsMap = new Map<string, Stop[]>();
    for (const area of areas) {
      const s = await this.deps.stopRepo.findByArea(area.id);
      s.sort((a, b) => a.seq - b.seq);
      areaStopsMap.set(area.id, s);
    }
    const sumLines = ['Area,Stop / Destination,Latitude,Longitude,Fare (GHS)'];
    for (const area of areas) {
      const st = areaStopsMap.get(area.id) ?? [];
      for (const stop of st) {
        const link = await this.deps.areaStopRepo.getByAreaAndStop(area.id, stop.id);
        const fl3 = link?.fare_level_id ? await this.deps.areaFareLevelRepo.getByAreaStop(link.id) : null;
        sumLines.push(`${esc(area.name)},${esc(stop.label)},${stop.latitude},${stop.longitude},${fl3 ? fl3.amount.toFixed(2) : '-'}`);
      }
      for (const jaTo of journeyAreas) {
        const thisSeq = journeyAreas.find(ja => ja.area_id === area.id)?.sequence ?? -1;
        if (jaTo.sequence <= thisSeq) continue;
        const fare = await this.deps.journeyFareRepo.getBetweenAreas(journeyId, area.id, jaTo.area_id);
        if (fare) {
          const fl3 = fl.find(l => l.id === fare.fare_level_id);
          const toName = areaNameMap.get(jaTo.area_id) || '';
          const destStops = areaStopsMap.get(jaTo.area_id) ?? [];
          sumLines.push(`${esc(area.name)},${esc(toName)},${destStops.length > 0 ? destStops[0].latitude : '-'},${destStops.length > 0 ? destStops[0].longitude : '-'},${fl3 ? fl3.amount.toFixed(2) : '-'}`);
        }
      }
    }
    parts.push({ name: 'fare-summary.csv', content: sumLines.join('\n') });

    // Journey Fares
    const fares = await this.deps.journeyFareRepo.getByJourney(journeyId);
    if (fares.length > 0) {
      const jfLines = ['From Area,To Area,Fare Level,Amount (GHS)'];
      for (const f of fares) {
        const fromJA = journeyAreas.find(ja => ja.id === f.from_journey_area_id);
        const toJA = journeyAreas.find(ja => ja.id === f.to_journey_area_id);
        const fl3 = fl.find(l => l.id === f.fare_level_id);
        jfLines.push(`${esc(fromJA ? areaNameMap.get(fromJA.area_id) || '' : '')},${esc(toJA ? areaNameMap.get(toJA.area_id) || '' : '')},${esc(fl3?.label || '')},${fl3 ? fl3.amount.toFixed(2) : '-'}`);
      }
      parts.push({ name: 'journey-fares.csv', content: jfLines.join('\n') });
    }

    // Track Points
    const tps = await this.deps.trackPointRepo.getByJourney(journeyId);
    if (tps.length > 0) {
      const tpLines = ['Sequence,Latitude,Longitude,Created'];
      for (const tp of tps) {
        tpLines.push(`${tp.sequence},${tp.latitude},${tp.longitude},${esc(tp.created_at)}`);
      }
      parts.push({ name: 'track-points.csv', content: tpLines.join('\n') });
    }

    return parts;
  }

  async exportJourneyCsv(journeyId: string): Promise<{ content: string; fileName: string } | null> {
    const journey = await this.deps.journeyRepo.getById(journeyId);
    if (!journey) return null;

    const parts = await this.exportJourneyCsvParts(journeyId);
    if (parts.length === 0) return null;

    const content = parts.map(p => `--- ${p.name} ---\n${p.content}`).join('\n\n');
    const fileName = `journey_${journey.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    return { content, fileName };
  }

  async exportMasterCsv(): Promise<{ content: string; fileName: string } | null> {
    const parts = await this.masterCsvParts();
    if (parts.length === 0) return null;
    const content = parts.map(p => `--- ${p.name} ---\n${p.content}`).join('\n\n');
    return { content, fileName: 'mateapp_master_export.csv' };
  }

  async masterCsvParts(): Promise<CsvPart[]> {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const parts: CsvPart[] = [];

    const journeys = await this.deps.journeyRepo.getAll();
    const jLines = ['Name,Status,Start Area,End Area,Created'];
    for (const j of journeys) {
      jLines.push(`${esc(j.name)},${esc(j.status)},${esc(j.start_area_id || '')},${esc(j.end_area_id || '')},${esc(j.created_at)}`);
    }
    parts.push({ name: 'journeys.csv', content: jLines.join('\n') });

    const areas = await this.deps.areaRepo.getAll();
    const aLines = ['Name,Created'];
    for (const a of areas) {
      aLines.push(`${esc(a.name)},${esc(a.created_at)}`);
    }
    parts.push({ name: 'areas.csv', content: aLines.join('\n') });

    const stops = await this.deps.stopRepo.getAll();
    const sLines = ['Stop,Latitude,Longitude,Radius,Created'];
    for (const s of stops) {
      sLines.push(`${esc(s.label)},${s.latitude},${s.longitude},${s.radius},${esc(s.created_at)}`);
    }
    parts.push({ name: 'stops.csv', content: sLines.join('\n') });

    const logs = await this.deps.validationLogRepo.getAll();
    const lLines = ['Pickup Lat,Pickup Lng,Dest Lat,Dest Lng,Status,Message,Created'];
    for (const l of logs) {
      lLines.push(`${l.pickup_lat},${l.pickup_lng},${l.dest_lat},${l.dest_lng},${esc(l.status)},${esc(l.message)},${esc(l.created_at)}`);
    }
    parts.push({ name: 'validation-logs.csv', content: lLines.join('\n') });

    return parts;
  }
}
