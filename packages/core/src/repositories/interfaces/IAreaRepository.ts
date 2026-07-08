import { Area } from '../../types';

export interface IAreaRepository {
  create(name: string): Promise<Area>;
  getById(id: string): Promise<Area | null>;
  getAll(): Promise<Area[]>;
  getByName(name: string): Promise<Area | null>;
  updatePolygon(id: string, polygon: string): Promise<void>;
  getAllWithPolygons(): Promise<Area[]>;
  delete(id: string): Promise<void>;
}
