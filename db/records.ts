import * as SQLite from "expo-sqlite";

export type Reading = {
  id: number;
  profileId: number;
  heartRate: number;
  temperature: number;
  spo2: number;
  respiratoryRate: number | null;
  status: string | null;
  recordedAt: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("health_monitor.db");
  }
  return dbPromise;
}

export async function initRecordsTable() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL,
      heartRate REAL NOT NULL,
      temperature REAL NOT NULL,
      spo2 REAL NOT NULL,
      status TEXT,
      recordedAt TEXT NOT NULL
    );
  `);
  await ensureColumn(db, "respiratoryRate", "REAL");
}

async function ensureColumn(db: SQLite.SQLiteDatabase, name: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(records);");
  const exists = columns.some((c) => c.name === name);
  if (!exists) {
    await db.execAsync(`ALTER TABLE records ADD COLUMN ${name} ${definition};`);
  }
}

export async function getRecordsForProfile(profileId: number): Promise<Reading[]> {
  const db = await getDb();
  return db.getAllAsync<Reading>(
    "SELECT * FROM records WHERE profileId = ? ORDER BY recordedAt DESC",
    [profileId]
  );
}

export async function addRecord(
  profileId: number,
  heartRate: number,
  temperature: number,
  spo2: number,
  status: string | null = null,
  respiratoryRate: number | null = null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO records (profileId, heartRate, temperature, spo2, status, recordedAt, respiratoryRate) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [profileId, heartRate, temperature, spo2, status, new Date().toISOString(), respiratoryRate]
  );
}

export async function deleteRecord(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM records WHERE id = ?", [id]);
}

// Used only by Drive restore — reinserts a reading with its original
// recordedAt timestamp, instead of stamping "now" like addRecord does.
export async function restoreRecord(
  profileId: number,
  r: Pick<Reading, "heartRate" | "temperature" | "spo2" | "status" | "recordedAt" | "respiratoryRate">
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO records (profileId, heartRate, temperature, spo2, status, recordedAt, respiratoryRate) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [profileId, r.heartRate, r.temperature, r.spo2, r.status, r.recordedAt, r.respiratoryRate]
  );
}