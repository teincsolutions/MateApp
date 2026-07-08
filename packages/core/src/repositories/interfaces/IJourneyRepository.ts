import { Journey } from '../../types';

export interface IJourneyRepository {
  create(name: string, startAreaId?: string): Promise<Journey>;
  getById(id: string): Promise<Journey | null>;
  getAll(): Promise<Journey[]>;
  getByStatus(status: string): Promise<Journey[]>;
  updateStatus(id: string, status: string, endAreaId?: string): Promise<void>;
  updateName(id: string, name: string): Promise<void>;
  delete(id: string): Promise<void>;
}
