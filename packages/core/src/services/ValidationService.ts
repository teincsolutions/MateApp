import {
  IStopRepository,
  IAreaRepository,
  IJourneyAreaRepository,
  IJourneyFareRepository,
  IAreaStopRepository,
  IFareLevelRepository,
  IJourneyRepository,
  IValidationLogRepository,
} from '../repositories/interfaces';
import { GeometryService } from './GeometryService';
import { Stop, Area, Journey } from '../types';

export interface ValidationResult {
  journey: Journey | null;
  pickupArea: Area | null;
  pickupStop: Stop | null;
  destArea: Area | null;
  destStop: Stop | null;
  fare: number | null;
  fareType: 'journey' | 'area' | null;
  estimatedPickup: boolean;
  estimatedDest: boolean;
  status: 'success' | 'journey_not_found' | 'stop_not_found' | 'unknown';
  message: string;
}

export interface ValidationDependencies {
  stopRepo: IStopRepository;
  areaRepo: IAreaRepository;
  journeyAreaRepo: IJourneyAreaRepository;
  journeyFareRepo: IJourneyFareRepository;
  areaStopRepo: IAreaStopRepository;
  areaFareLevelRepo: IFareLevelRepository;
  journeyRepo: IJourneyRepository;
  validationLogRepo: IValidationLogRepository;
}

export class ValidationService {
  constructor(private deps: ValidationDependencies) {}

  async validate(pickupLat: number, pickupLng: number, destLat: number, destLng: number): Promise<ValidationResult> {
    const result: ValidationResult = {
      journey: null,
      pickupArea: null,
      pickupStop: null,
      destArea: null,
      destStop: null,
      fare: null,
      fareType: null,
      estimatedPickup: false,
      estimatedDest: false,
      status: 'unknown',
      message: '',
    };

    // Step 1: Match pickup stop
    const pickupStops = await this.deps.stopRepo.findByRadius(pickupLat, pickupLng, 50);
    if (pickupStops.length > 0) {
      result.pickupStop = pickupStops[0];
    } else {
      result.pickupStop = await this.deps.stopRepo.findNearestStop(pickupLat, pickupLng);
      result.estimatedPickup = true;
    }

    // Step 2: Resolve pickup area
    if (result.pickupStop) {
      result.pickupArea = await this.findAreaContainingStop(result.pickupStop.id);
    }
    if (!result.pickupArea) {
      result.pickupArea = await this.findAreaContainingPoint(pickupLat, pickupLng);
    }

    // Step 3: Match destination stop
    const destStops = await this.deps.stopRepo.findByRadius(destLat, destLng, 50);
    if (destStops.length > 0) {
      result.destStop = destStops[0];
    } else {
      result.destStop = await this.deps.stopRepo.findNearestStop(destLat, destLng);
      result.estimatedDest = true;
    }

    // Step 4: Resolve destination area
    if (result.destStop) {
      result.destArea = await this.findAreaContainingStop(result.destStop.id);
    }
    if (!result.destArea) {
      result.destArea = await this.findAreaContainingPoint(destLat, destLng);
    }

    if (!result.pickupStop && !result.destStop) {
      result.status = 'stop_not_found';
      result.message = 'No stops found near pickup or destination';
      await this.logResult(result, pickupLat, pickupLng, destLat, destLng);
      return result;
    }

    if (!result.pickupArea || !result.destArea) {
      result.status = 'stop_not_found';
      result.message = 'Could not determine pickup or destination area';
      await this.logResult(result, pickupLat, pickupLng, destLat, destLng);
      return result;
    }

    // Step 5: Resolve journey
    result.journey = await this.findJourney(result.pickupArea.id, result.destArea.id);
    if (!result.journey) {
      result.status = 'journey_not_found';
      result.message = 'Journey not found';
      await this.logResult(result, pickupLat, pickupLng, destLat, destLng);
      return result;
    }

    // Step 6: Calculate fare
    if (result.pickupArea.id === result.destArea.id) {
      result.fareType = 'area';
      result.fare = await this.getIntraAreaFare(result.pickupArea.id, result.pickupStop!, result.destStop!);
    } else {
      result.fareType = 'journey';
      result.fare = await this.getInterAreaFare(result.journey.id, result.pickupArea.id, result.destArea.id);
    }

    result.status = 'success';
    result.message = result.fare !== null
      ? `Fare: GHS ${result.fare.toFixed(2)}`
      : 'Fare not configured';
    await this.logResult(result, pickupLat, pickupLng, destLat, destLng);
    return result;
  }

  async findAreaContainingStop(stopId: string): Promise<Area | null> {
    const areaStops = await this.deps.areaStopRepo.getByStop(stopId);
    if (areaStops.length > 0) {
      return await this.deps.areaRepo.getById(areaStops[0].area_id);
    }
    return null;
  }

  async findAreaContainingPoint(lat: number, lng: number): Promise<Area | null> {
    const areas = await this.deps.areaRepo.getAllWithPolygons();
    const point = { latitude: lat, longitude: lng };
    for (const area of areas) {
      if (area.polygon) {
        const polygon = GeometryService.polygonFromJson(area.polygon);
        if (GeometryService.pointInPolygon(point, polygon)) {
          return area;
        }
      }
    }
    return null;
  }

  async findJourney(pickupAreaId: string, destAreaId: string): Promise<Journey | null> {
    const journeys = await this.deps.journeyRepo.getAll();
    for (const journey of journeys) {
      const journeyAreas = await this.deps.journeyAreaRepo.getByJourney(journey.id);
      const areaIds = journeyAreas.map((ja) => ja.area_id);
      const pickupIdx = areaIds.indexOf(pickupAreaId);
      const destIdx = areaIds.indexOf(destAreaId);
      if (pickupIdx !== -1 && destIdx !== -1) {
        return journey;
      }
    }
    return null;
  }

  async getInterAreaFare(journeyId: string, pickupAreaId: string, destAreaId: string): Promise<number | null> {
    const fare = await this.deps.journeyFareRepo.getBetweenAreas(journeyId, pickupAreaId, destAreaId);
    if (fare) {
      const levels = await this.deps.areaFareLevelRepo.getByJourney(journeyId);
      const matched = levels.find(l => l.id === fare.fare_level_id);
      if (matched) return matched.amount;
    }
    const oppositeFare = await this.deps.journeyFareRepo.getBetweenAreas(journeyId, destAreaId, pickupAreaId);
    if (oppositeFare) {
      const levels = await this.deps.areaFareLevelRepo.getByJourney(journeyId);
      const matched = levels.find(l => l.id === oppositeFare.fare_level_id);
      if (matched) return matched.amount;
    }
    return null;
  }

  async getIntraAreaFare(areaId: string, pickupStop: Stop, destStop: Stop): Promise<number | null> {
    // Get all area_stops with their stops and fare levels
    const areaStops = await this.deps.areaStopRepo.getByArea(areaId);
    if (areaStops.length === 0) return null;

    // Fetch all stops in the area
    const stopIds = areaStops.map(as => as.stop_id);
    const stops = await Promise.all(stopIds.map(id => this.deps.stopRepo.getById(id)));
    const stopMap = new Map(stops.filter(Boolean).map(s => [s!.id, s!]));

    // Find A1: reference point — geographically northernmost stop (smallest latitude)
    const stopsArray = [...stopMap.values()];
    if (stopsArray.length === 0) return null;
    stopsArray.sort((a, b) => a.latitude - b.latitude);
    const a1 = stopsArray[0];

    // Compute trip distance: pickup → destination
    const tripDist = GeometryService.haversineDistance(
      pickupStop.latitude, pickupStop.longitude,
      destStop.latitude, destStop.longitude,
    );

    // Build: fare_level_id → closest stop to A1 that uses it
    const flStopDist = new Map<string, number>(); // fare_level_id → distance from A1
    for (const as of areaStops) {
      if (!as.fare_level_id) continue;
      const stop = stopMap.get(as.stop_id);
      if (!stop) continue;
      const dist = GeometryService.haversineDistance(a1.latitude, a1.longitude, stop.latitude, stop.longitude);
      if (!flStopDist.has(as.fare_level_id) || dist < flStopDist.get(as.fare_level_id)!) {
        flStopDist.set(as.fare_level_id, dist);
      }
    }

    // Find the fare level with reference distance closest to tripDist
    let bestFlId: string | null = null;
    let bestDiff = Infinity;

    for (const [flId, refDist] of flStopDist) {
      const diff = Math.abs(tripDist - refDist);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestFlId = flId;
      }
    }

    if (!bestFlId) return null;

    // Resolve fare level amount
    const journeyLevels = await this.deps.areaFareLevelRepo.getByArea(areaId);
    const matched = journeyLevels.find(l => l.id === bestFlId);
    return matched ? matched.amount : null;
  }

  async logResult(result: ValidationResult, pickupLat: number, pickupLng: number, destLat: number, destLng: number): Promise<void> {
    await this.deps.validationLogRepo.create({
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dest_lat: destLat,
      dest_lng: destLng,
      pickup_stop_id: result.pickupStop?.id || null,
      pickup_area_id: result.pickupArea?.id || null,
      dest_stop_id: result.destStop?.id || null,
      dest_area_id: result.destArea?.id || null,
      journey_id: result.journey?.id || null,
      fare: result.fare,
      fare_type: result.fareType,
      status: result.status,
      message: result.message,
      estimated_pickup: result.estimatedPickup,
      estimated_dest: result.estimatedDest,
    });
  }
}
