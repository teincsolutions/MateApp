import { TrackPoint } from '../../types';

export interface ITrackPointRepository {
  create(journeyId: string, journeyAreaId: string | null, sequence: number, latitude: number, longitude: number): Promise<TrackPoint>;
  getByJourney(journeyId: string): Promise<TrackPoint[]>;
  getMaxSequence(journeyId: string): Promise<number>;
  deleteByJourney(journeyId: string): Promise<void>;
}
