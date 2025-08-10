import { pgTable, serial, varchar, text, decimal, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull().unique(),
  store: varchar('store', { length: 100 }).notNull(),
  selector: text('selector'), // CSS selector for price element
  currentPrice: decimal('current_price', { precision: 10, scale: 2 }),
  targetPrice: decimal('target_price', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  lastChecked: timestamp('last_checked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Price history table
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('AUD').notNull(),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
})

// Notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'price_drop', 'target_reached', 'back_in_stock'
  message: text('message').notNull(),
  sent: boolean('sent').default(false).notNull(),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Stores configuration table
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }).notNull(),
  defaultSelector: text('default_selector'), // Default CSS selector for this store
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Zod schemas for validation
export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(1).max(255),
  url: z.string().url(),
  store: z.string().min(1).max(100),
  currentPrice: z.string().optional(),
  targetPrice: z.string().optional(),
})

export const selectProductSchema = createSelectSchema(products)

export const insertPriceHistorySchema = createInsertSchema(priceHistory, {
  price: z.string(),
  currency: z.string().length(3),
})

export const selectPriceHistorySchema = createSelectSchema(priceHistory)

export const insertNotificationSchema = createInsertSchema(notifications, {
  type: z.enum(['price_drop', 'target_reached', 'back_in_stock']),
  message: z.string().min(1),
})

export const selectNotificationSchema = createSelectSchema(notifications)

export const insertStoreSchema = createInsertSchema(stores, {
  name: z.string().min(1).max(100),
  domain: z.string().min(1).max(255),
})

export const selectStoreSchema = createSelectSchema(stores)

// Types
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type PriceHistory = typeof priceHistory.$inferSelect
export type NewPriceHistory = typeof priceHistory.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Store = typeof stores.$inferSelect
export type NewStore = typeof stores.$inferInsert