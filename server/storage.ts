import {
  type User, type InsertUser,
  type ProductionRecord, type InsertProductionRecord,
  type ProductionOrder, type InsertProductionOrder,
  type Inventory, type InsertInventory,
  users, productionRecords, productionOrders, inventory
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  getAllRecords(): Promise<ProductionRecord[]>;
  getRecord(id: number): Promise<ProductionRecord | undefined>;
  createRecord(record: InsertProductionRecord): Promise<ProductionRecord>;
  updateRecord(id: number, updates: Partial<InsertProductionRecord>): Promise<ProductionRecord | undefined>;
  deleteRecord(id: number): Promise<boolean>;

  getAllOrders(): Promise<ProductionOrder[]>;
  getOrder(id: number): Promise<ProductionOrder | undefined>;
  createOrder(order: InsertProductionOrder): Promise<ProductionOrder>;
  updateOrder(id: number, updates: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined>;

  getAllInventory(): Promise<Inventory[]>;
  getInventoryByLocation(location: string): Promise<Inventory[]>;
  upsertInventory(item: InsertInventory): Promise<Inventory>;

  bulkSync(data: {
    records: InsertProductionRecord[];
    orders: InsertProductionOrder[];
    inventory: InsertInventory[];
  }): Promise<{ records: ProductionRecord[]; orders: ProductionOrder[]; inventory: Inventory[] }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: Date.now() } as any)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllRecords(): Promise<ProductionRecord[]> {
    return db.select().from(productionRecords);
  }

  async getRecord(id: number): Promise<ProductionRecord | undefined> {
    const [record] = await db.select().from(productionRecords).where(eq(productionRecords.id, id));
    return record;
  }

  async createRecord(record: InsertProductionRecord): Promise<ProductionRecord> {
    const [created] = await db.insert(productionRecords).values(record).returning();
    return created;
  }

  async updateRecord(id: number, updates: Partial<InsertProductionRecord>): Promise<ProductionRecord | undefined> {
    const [updated] = await db.update(productionRecords)
      .set(updates)
      .where(eq(productionRecords.id, id))
      .returning();
    return updated;
  }

  async deleteRecord(id: number): Promise<boolean> {
    const result = await db.delete(productionRecords).where(eq(productionRecords.id, id)).returning();
    return result.length > 0;
  }

  async getAllOrders(): Promise<ProductionOrder[]> {
    return db.select().from(productionOrders);
  }

  async getOrder(id: number): Promise<ProductionOrder | undefined> {
    const [order] = await db.select().from(productionOrders).where(eq(productionOrders.id, id));
    return order;
  }

  async createOrder(order: InsertProductionOrder): Promise<ProductionOrder> {
    const [created] = await db.insert(productionOrders).values(order).returning();
    return created;
  }

  async updateOrder(id: number, updates: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined> {
    const [updated] = await db.update(productionOrders)
      .set(updates)
      .where(eq(productionOrders.id, id))
      .returning();
    return updated;
  }

  async getAllInventory(): Promise<Inventory[]> {
    return db.select().from(inventory);
  }

  async getInventoryByLocation(location: string): Promise<Inventory[]> {
    return db.select().from(inventory).where(eq(inventory.location, location));
  }

  async upsertInventory(item: InsertInventory): Promise<Inventory> {
    const existing = await db.select().from(inventory)
      .where(and(eq(inventory.location, item.location), eq(inventory.material, item.material)));

    if (existing.length > 0) {
      const [updated] = await db.update(inventory)
        .set({ quantity: item.quantity, unit: item.unit, updatedAt: item.updatedAt })
        .where(eq(inventory.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(inventory).values(item).returning();
      return created;
    }
  }

  async bulkSync(data: {
    records: (InsertProductionRecord & { clientId?: number })[];
    orders: (InsertProductionOrder & { clientId?: number })[];
    inventory: InsertInventory[];
  }): Promise<{ records: ProductionRecord[]; orders: ProductionOrder[]; inventory: Inventory[] }> {
    const syncedRecords: ProductionRecord[] = [];
    const syncedOrders: ProductionOrder[] = [];
    const syncedInventory: Inventory[] = [];

    for (const rec of data.records) {
      if (rec.clientId) {
        const existing = await db.select().from(productionRecords)
          .where(eq(productionRecords.clientId, rec.clientId));

        if (existing.length > 0) {
          if (rec.updatedAt > existing[0].updatedAt) {
            const [updated] = await db.update(productionRecords)
              .set(rec)
              .where(eq(productionRecords.id, existing[0].id))
              .returning();
            syncedRecords.push(updated);
          } else {
            syncedRecords.push(existing[0]);
          }
        } else {
          const [created] = await db.insert(productionRecords).values(rec).returning();
          syncedRecords.push(created);
        }
      } else {
        const [created] = await db.insert(productionRecords).values(rec).returning();
        syncedRecords.push(created);
      }
    }

    for (const ord of data.orders) {
      if (ord.clientId) {
        const existing = await db.select().from(productionOrders)
          .where(eq(productionOrders.clientId, ord.clientId));

        if (existing.length > 0) {
          syncedOrders.push(existing[0]);
        } else {
          const [created] = await db.insert(productionOrders).values(ord).returning();
          syncedOrders.push(created);
        }
      } else {
        const [created] = await db.insert(productionOrders).values(ord).returning();
        syncedOrders.push(created);
      }
    }

    for (const inv of data.inventory) {
      const result = await this.upsertInventory(inv);
      syncedInventory.push(result);
    }

    return { records: syncedRecords, orders: syncedOrders, inventory: syncedInventory };
  }
}

export const storage = new DatabaseStorage();
