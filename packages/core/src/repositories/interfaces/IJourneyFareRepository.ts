import { JourneyFare } from '../../types';

export interface IJourneyFareRepository {
  create(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare>;
  getByJourney(journeyId: string): Promise<JourneyFare[]>;
  getBetweenAreas(journeyId: string, fromAreaId: string, toAreaId: string): Promise<JourneyFare | null>;
  upsert(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare>;
  delete(id: string): Promise<void>;
}
