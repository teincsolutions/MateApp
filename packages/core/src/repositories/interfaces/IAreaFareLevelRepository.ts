import { FareLevel, AreaFareLevel } from '../../types';

export interface IFareLevelRepository {
  create(journeyId: string, label: string, orderNo: number, amount: number): Promise<FareLevel>;
  getByJourney(journeyId: string): Promise<FareLevel[]>;
  getByArea(areaId: string): Promise<FareLevel[]>;
  getByAreaStop(areaStopId: string): Promise<FareLevel | null>;
  updateAmount(id: string, amount: number): Promise<void>;
  linkToArea(areaId: string, fareLevelId: string): Promise<AreaFareLevel>;
  unlinkFromArea(areaId: string, fareLevelId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
