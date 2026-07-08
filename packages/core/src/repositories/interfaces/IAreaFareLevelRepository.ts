import { AreaFareLevel } from '../../types';

export interface IAreaFareLevelRepository {
  create(areaId: string, label: string, orderNo: number, amount: number): Promise<AreaFareLevel>;
  getByArea(areaId: string): Promise<AreaFareLevel[]>;
  getByAreaStop(areaStopId: string): Promise<AreaFareLevel | null>;
  updateAmount(id: string, amount: number): Promise<void>;
  delete(id: string): Promise<void>;
}
