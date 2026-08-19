import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { artifacts, DeviceLink, deviceLinks, InsertArtifact, InsertDeviceLink, InsertOAuthState, InsertStorageConnection, oauthStates, storageConnections, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] === undefined) continue;
    values[field] = user[field] ?? null;
    updateSet[field] = user[field] ?? null;
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createArtifact(input: InsertArtifact) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for artifact persistence.");
  const result = await db.insert(artifacts).values(input);
  const id = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  const rows = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  return rows[0];
}

export async function getArtifactById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  return rows[0]?.userId === userId ? rows[0] : undefined;
}

export async function listUserArtifacts(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(artifacts).where(eq(artifacts.userId, userId)).orderBy(desc(artifacts.createdAt)).limit(limit);
}

export async function updateArtifactStorage(id: number, userId: number, input: Partial<Pick<InsertArtifact, "storageProvider" | "storageStatus" | "externalObjectId" | "connectionId" | "storageKey" | "storageUrl">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for artifact updates.");
  await db.update(artifacts).set(input).where(eq(artifacts.id, id));
  const rows = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!rows[0] || rows[0].userId !== userId) throw new Error("Artifact not found for this user.");
  return rows[0];
}

export async function deleteArtifactReference(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for artifact deletion.");
  const rows = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  if (!rows[0] || rows[0].userId !== userId) throw new Error("Artifact not found for this user.");
  await db.delete(artifacts).where(eq(artifacts.id, id));
}

export async function createOAuthState(input: InsertOAuthState) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for OAuth state.");
  await db.insert(oauthStates).values(input);
}

export async function consumeOAuthState(stateHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(oauthStates).where(eq(oauthStates.stateHash, stateHash)).limit(1);
  if (!rows[0]) return undefined;
  await db.delete(oauthStates).where(eq(oauthStates.id, rows[0].id));
  return rows[0];
}

export async function getGoogleDriveConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(storageConnections).where(eq(storageConnections.userId, userId)).limit(1);
  return rows[0];
}

export async function saveGoogleDriveConnection(input: InsertStorageConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for storage connection.");
  const existing = await getGoogleDriveConnection(input.userId);
  if (existing) {
    await db.update(storageConnections).set(input).where(eq(storageConnections.id, existing.id));
    const rows = await db.select().from(storageConnections).where(eq(storageConnections.id, existing.id)).limit(1);
    return rows[0];
  }
  const result = await db.insert(storageConnections).values(input);
  const id = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  const rows = await db.select().from(storageConnections).where(eq(storageConnections.id, id)).limit(1);
  return rows[0];
}

export async function revokeGoogleDriveConnection(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for storage connection.");
  const existing = await getGoogleDriveConnection(userId);
  if (!existing) return undefined;
  await db.update(storageConnections).set({ status: "revoked" }).where(eq(storageConnections.id, existing.id));
  const rows = await db.select().from(storageConnections).where(eq(storageConnections.id, existing.id)).limit(1);
  return rows[0];
}

export async function createDeviceLink(input: InsertDeviceLink) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for device linking.");
  const result = await db.insert(deviceLinks).values(input);
  const id = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  const rows = await db.select().from(deviceLinks).where(eq(deviceLinks.id, id)).limit(1);
  return rows[0];
}

export async function listUserDeviceLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deviceLinks).where(eq(deviceLinks.userId, userId)).orderBy(desc(deviceLinks.updatedAt));
}

export async function getDeviceLinkByTokenHash(pairingTokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(deviceLinks).where(eq(deviceLinks.pairingTokenHash, pairingTokenHash)).limit(1);
  return rows[0];
}

export async function markDeviceLinked(id: number, lastSeenAt = new Date()): Promise<DeviceLink | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for device linking.");
  await db.update(deviceLinks).set({ status: "linked", lastSeenAt }).where(eq(deviceLinks.id, id));
  const rows = await db.select().from(deviceLinks).where(eq(deviceLinks.id, id)).limit(1);
  return rows[0];
}

export async function revokeDeviceLink(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available for device linking.");
  await db.update(deviceLinks).set({ status: "revoked" }).where(eq(deviceLinks.id, id));
  return listUserDeviceLinks(userId);
}
