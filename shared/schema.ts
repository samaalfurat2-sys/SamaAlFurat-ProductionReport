import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, real, jsonb, bigint, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("operator"),
  enabled: boolean("enabled").notNull().default(true),
  permissions: jsonb("permissions").default({}),
  createdAt: bigint("created_at", { mode: "number" }),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  displayName: z.string().optional(),
  role: z.string().optional(),
  enabled: z.boolean().optional(),
  permissions: z.any().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const productionRecords = pgTable("production_records", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  orderId: integer("order_id"),
  date: text("date").notNull(),
  shift: text("shift").notNull().default(""),
  section: text("section").notNull(),
  data: jsonb("data").notNull().default({}),
  actionBy: text("action_by"),
  actionType: text("action_type"),
  actionNote: text("action_note"),
  actionTimestamp: text("action_timestamp"),
  status: text("status").default("pending_supervisor"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const insertProductionRecordSchema = createInsertSchema(productionRecords).omit({ id: true });
export type InsertProductionRecord = z.infer<typeof insertProductionRecordSchema>;
export type ProductionRecord = typeof productionRecords.$inferSelect;

export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  date: text("date").notNull(),
  productSize: text("product_size").notNull(),
  targetQuantity: integer("target_quantity").notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const insertProductionOrderSchema = createInsertSchema(productionOrders).omit({ id: true });
export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;
export type ProductionOrder = typeof productionOrders.$inferSelect;

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  material: text("material").notNull(),
  quantity: real("quantity").notNull().default(0),
  unit: text("unit").notNull().default(""),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;
