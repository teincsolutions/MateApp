import { AreaStop } from '../../types';

export interface IAreaStopRepository {
  create(areaId: string, stopId: string, fareLevelId?: string): Promise<AreaStop>;
  getByArea(areaId: string): Promise<AreaStop[]>;
  getByStop(stopId: string): Promise<AreaStop[]>;
  getByAreaAndStop(areaId: string, stopId: string): Promise<AreaStop | null>;
  updateFareLevel(id: string, fareLevelId: string | null): Promise<void>;
  delete(id: string): Promise<void>;
}
