import Dexie, { type EntityTable } from 'dexie';
import { syncRecordToServer, syncOrderToServer, syncInventoryToServer } from './sync';

export interface ProductionOrder {
  id?: number;
  date: string;
  productSize: 'bom_330ml' | 'bom_750ml' | 'bom_1500ml';
  targetQuantity: number;
  status: 'active' | 'completed';
  notes?: string;
  createdAt: number;
}

export interface ProductionRecord {
  id?: number;
  orderId?: number;
  date: string;
  shift: string;
  section: string;
  data: any;
  action_by?: string;
  action_type?: string;
  action_note?: string;
  action_timestamp?: string; 
  status?: 'pending_supervisor' | 'returned_to_operator' | 'closed' | 'pending_wh2' | 'wh2_rejected' | 'pending_wh3' | 'wh3_rejected' | 'pending' | 'accepted' | 'rejected' | 'audited' | 'audit_rejected';
  createdAt: number;
  updatedAt: number;
}

export interface InventoryRecord {
  id?: number;
  location: string;
  material: string;
  quantity: number;
  unit: string;
  updatedAt: number;
}

const db = new Dexie('ProductionReportDB') as Dexie & {
  records: EntityTable<ProductionRecord, 'id'>;
  orders: EntityTable<ProductionOrder, 'id'>;
  inventory: EntityTable<InventoryRecord, 'id'>;
};

db.version(5).stores({
  records: '++id, date, shift, section, orderId, status, createdAt',
  orders: '++id, status, createdAt',
  inventory: '++id, location, material, updatedAt'
}).upgrade(tx => {
});

export async function addRecordWithSync(record: Omit<ProductionRecord, 'id'>): Promise<number> {
  const id = await db.records.add(record as ProductionRecord);
  const saved = await db.records.get(id);
  if (saved) syncRecordToServer(saved);
  return id;
}

export async function updateRecordWithSync(id: number, changes: Partial<ProductionRecord>): Promise<void> {
  await db.records.update(id, changes);
  const updated = await db.records.get(id);
  if (updated) syncRecordToServer(updated);
}

export async function addOrderWithSync(order: Omit<ProductionOrder, 'id'>): Promise<number> {
  const id = await db.orders.add(order as ProductionOrder);
  const saved = await db.orders.get(id);
  if (saved) syncOrderToServer(saved);
  return id;
}

export async function updateOrderWithSync(id: number, changes: Partial<ProductionOrder>): Promise<void> {
  await db.orders.update(id, changes);
  const updated = await db.orders.get(id);
  if (updated) syncOrderToServer(updated);
}

export async function updateInventoryWithSync(id: number, changes: Partial<InventoryRecord>): Promise<void> {
  await db.inventory.update(id, changes);
  const updated = await db.inventory.get(id);
  if (updated) syncInventoryToServer(updated);
}

export { db };