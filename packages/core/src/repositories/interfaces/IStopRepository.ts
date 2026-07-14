import { Stop } from '../../types';

export interface IStopRepository {
  create(label: string, latitude: number, longitude: number, radius?: number, seq?: number): Promise<Stop>;
  getById(id: string): Promise<Stop | null>;
  getAll(): Promise<Stop[]>;
  findByArea(areaId: string): Promise<Stop[]>;
  findByRadius(latitude: number, longitude: number, radiusMeters: number): Promise<Stop[]>;
  findNearestStop(latitude: number, longitude: number): Promise<Stop | null>;
  delete(id: string): Promise<void>;
}
