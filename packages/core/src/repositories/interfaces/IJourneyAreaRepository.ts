import { JourneyArea } from '../../types';

export interface IJourneyAreaRepository {
  create(journeyId: string, areaId: string, sequence: number): Promise<JourneyArea>;
  getByJourney(journeyId: string): Promise<JourneyArea[]>;
  getById(id: string): Promise<JourneyArea | null>;
  getMaxSequence(journeyId: string): Promise<number>;
  delete(id: string): Promise<void>;
}
