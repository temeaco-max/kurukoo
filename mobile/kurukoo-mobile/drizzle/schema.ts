import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: text("storageUrl").notNull(),
  storageProvider: mysqlEnum("storageProvider", ["google-drive", "kurukoo-managed"]).default("kurukoo-managed").notNull(),
  storageStatus: mysqlEnum("storageStatus", ["pending_upload", "uploaded", "verified", "pending_external_storage", "retrying", "failed", "expired"]).default("verified").notNull(),
  externalObjectId: varchar("externalObjectId", { length: 512 }),
  connectionId: int("connectionId"),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  durationMs: int("durationMs"),
  transcript: text("transcript"),
  transcriptState: mysqlEnum("transcriptState", ["saved", "needs-review"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const oauthStates = mysqlTable("oauth_states", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["google-drive"]).notNull(),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const storageConnections = mysqlTable("storage_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["google-drive"]).notNull(),
  externalAccountId: varchar("externalAccountId", { length: 255 }).notNull(),
  accountEmail: varchar("accountEmail", { length: 320 }),
  refreshTokenCiphertext: text("refreshTokenCiphertext").notNull(),
  folderId: varchar("folderId", { length: 255 }),
  status: mysqlEnum("status", ["connected", "revoked", "expired"]).notNull(),
  scope: varchar("scope", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
});

export const deviceLinks = mysqlTable("device_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceKey: varchar("deviceKey", { length: 128 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["pending", "linked", "revoked"]).notNull(),
  pairingTokenHash: varchar("pairingTokenHash", { length: 128 }).notNull().unique(),
  pairingExpiresAt: timestamp("pairingExpiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;
export type OAuthState = typeof oauthStates.$inferSelect;
export type InsertOAuthState = typeof oauthStates.$inferInsert;
export type StorageConnection = typeof storageConnections.$inferSelect;
export type InsertStorageConnection = typeof storageConnections.$inferInsert;
export type DeviceLink = typeof deviceLinks.$inferSelect;
export type InsertDeviceLink = typeof deviceLinks.$inferInsert;
