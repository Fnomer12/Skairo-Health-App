import * as SQLite from "expo-sqlite";

export type Gender = "Male" | "Female";

export type Profile = {
  id: number;
  publicId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  allergies: string;
  photoUri: string | null;
  dateOfBirth: string | null; // stored as "YYYY-MM-DD"
  gender: Gender | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("health_monitor.db");
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  await ensureColumn(db, "allergies", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "photoUri", "TEXT");
  await ensureColumn(db, "publicId", "TEXT");
  await ensureColumn(db, "dateOfBirth", "TEXT");
  await ensureColumn(db, "gender", "TEXT");
  await backfillPublicIds(db);
}

async function ensureColumn(db: SQLite.SQLiteDatabase, name: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(profiles);");
  const exists = columns.some((c) => c.name === name);
  if (!exists) {
    await db.execAsync(`ALTER TABLE profiles ADD COLUMN ${name} ${definition};`);
  }
}

// Any profile created before the publicId column existed gets one generated now.
async function backfillPublicIds(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM profiles WHERE publicId IS NULL OR publicId = ''"
  );
  for (const row of rows) {
    const publicId = await generateUniquePublicId(db);
    await db.runAsync("UPDATE profiles SET publicId = ? WHERE id = ?", [publicId, row.id]);
  }
}

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomPublicId(length = 6): string {
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

async function generateUniquePublicId(db: SQLite.SQLiteDatabase): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomPublicId();
    const existing = await db.getFirstAsync("SELECT id FROM profiles WHERE publicId = ?", [candidate]);
    if (!existing) return candidate;
  }
  return randomPublicId(8); // astronomically unlikely fallback
}

export async function getProfiles(): Promise<Profile[]> {
  const db = await getDb();
  return db.getAllAsync<Profile>("SELECT * FROM profiles ORDER BY createdAt ASC");
}

export async function addProfile(
  firstName: string,
  lastName: string,
  allergies: string = "",
  dateOfBirth: string | null = null,
  gender: Gender | null = null
): Promise<void> {
  const db = await getDb();
  const publicId = await generateUniquePublicId(db);
  await db.runAsync(
    "INSERT INTO profiles (firstName, lastName, createdAt, allergies, photoUri, publicId, dateOfBirth, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [firstName.trim(), lastName.trim(), new Date().toISOString(), allergies.trim(), null, publicId, dateOfBirth, gender]
  );
}

export async function updateProfile(
  id: number,
  updates: Partial<Pick<Profile, "firstName" | "lastName" | "allergies" | "photoUri" | "dateOfBirth" | "gender">>
): Promise<Profile> {
  const db = await getDb();
  const current = await db.getFirstAsync<Profile>("SELECT * FROM profiles WHERE id = ?", [id]);
  if (!current) {
    throw new Error("Profile not found");
  }
  const merged: Profile = {
    ...current,
    firstName: (updates.firstName ?? current.firstName).trim(),
    lastName: (updates.lastName ?? current.lastName).trim(),
    allergies: (updates.allergies ?? current.allergies ?? "").trim(),
    photoUri: updates.photoUri !== undefined ? updates.photoUri : current.photoUri,
    dateOfBirth: updates.dateOfBirth !== undefined ? updates.dateOfBirth : current.dateOfBirth,
    gender: updates.gender !== undefined ? updates.gender : current.gender,
  };
  await db.runAsync(
    "UPDATE profiles SET firstName = ?, lastName = ?, allergies = ?, photoUri = ?, dateOfBirth = ?, gender = ? WHERE id = ?",
    [merged.firstName, merged.lastName, merged.allergies, merged.photoUri, merged.dateOfBirth, merged.gender, id]
  );
  return merged;
}

export async function deleteProfile(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM profiles WHERE id = ?", [id]);
}

export function fullName(profile: Profile): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

export function calculateAge(dateOfBirth: string): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassedThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassedThisYear) age -= 1;
  return age;
}