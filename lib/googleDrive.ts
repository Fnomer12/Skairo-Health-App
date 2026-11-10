import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";
import { getProfiles, restoreProfileRecord, Profile } from "../db/profiles";
import { getRecordsForProfile, restoreRecord, Reading } from "../db/records";
import appConfig from "../app.json";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILE_NAME = "skairo-health-backup.json";
const PASSPHRASE_KEY = "skairo_backup_passphrase";
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 16;

// Paste in the client IDs from Google Cloud Console (step 1).
const WEB_CLIENT_ID = "836365103129-see017plsr7l9s0c9od8jtrj5sbi139f.apps.googleusercontent.com";
const IOS_CLIENT_ID = "836365103129-4g6i0pqm2g23k8pe0s7qu20rfivbpgl3.apps.googleusercontent.com";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    scopes: [DRIVE_SCOPE],
  });
  configured = true;
}

export type BackupPayload = {
  exportedAt: string;
  appVersion: string;
  profiles: Array<Profile & { records: Reading[] }>;
};

type EncryptedBackup = {
  version: 1;
  salt: string; // hex
  iv: string; // hex
  hmac: string; // hex
  ciphertext: string; // base64
};

// --- Encryption helpers -----------------------------------------------
// The backup passphrase never leaves the device and is never uploaded.
// Without it, the file on Drive is unreadable noise — including to Google
// itself, since AES-256 encryption happens entirely client-side here.

function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

async function randomWordArray(byteLength: number): Promise<CryptoJS.lib.WordArray> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return bytesToWordArray(bytes);
}

// Derives a 512-bit key from the passphrase + salt, split into a 256-bit
// AES key and a separate 256-bit HMAC key — never reuse one key for both
// encryption and integrity checking.
function deriveKeys(passphrase: string, salt: CryptoJS.lib.WordArray) {
  const derived = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 512 / 32,
    iterations: PBKDF2_ITERATIONS,
  });
  const derivedHex = derived.toString(CryptoJS.enc.Hex);
  return {
    encKey: CryptoJS.enc.Hex.parse(derivedHex.slice(0, 64)),
    macKey: CryptoJS.enc.Hex.parse(derivedHex.slice(64, 128)),
  };
}

async function encryptJson(plainJson: string, passphrase: string): Promise<EncryptedBackup> {
  const salt = await randomWordArray(SALT_BYTES);
  const iv = await randomWordArray(IV_BYTES);
  const { encKey, macKey } = deriveKeys(passphrase, salt);

  const encrypted = CryptoJS.AES.encrypt(plainJson, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const ciphertext = encrypted.ciphertext;

  // HMAC over iv || ciphertext so a wrong passphrase or a tampered file is
  // caught before we ever try to parse the result as JSON.
  const hmac = CryptoJS.HmacSHA256(iv.clone().concat(ciphertext), macKey);

  return {
    version: 1,
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    hmac: hmac.toString(CryptoJS.enc.Hex),
    ciphertext: ciphertext.toString(CryptoJS.enc.Base64),
  };
}

function decryptJson(file: EncryptedBackup, passphrase: string): string {
  const salt = CryptoJS.enc.Hex.parse(file.salt);
  const iv = CryptoJS.enc.Hex.parse(file.iv);
  const ciphertext = CryptoJS.enc.Base64.parse(file.ciphertext);
  const { encKey, macKey } = deriveKeys(passphrase, salt);

  const expectedHmac = CryptoJS.HmacSHA256(iv.clone().concat(ciphertext), macKey).toString(CryptoJS.enc.Hex);
  if (expectedHmac !== file.hmac) {
    throw new Error("Wrong passphrase, or the backup file is corrupted.");
  }

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext } as CryptoJS.lib.CipherParams,
    encKey,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  const plainJson = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plainJson) {
    throw new Error("Wrong passphrase, or the backup file is corrupted.");
  }
  return plainJson;
}

// --- Passphrase storage (this device only, via Keychain/Keystore) ------

export async function getSavedPassphrase(): Promise<string | null> {
  return SecureStore.getItemAsync(PASSPHRASE_KEY);
}

export async function savePassphrase(passphrase: string): Promise<void> {
  await SecureStore.setItemAsync(PASSPHRASE_KEY, passphrase);
}

// --- Existing Drive plumbing, unchanged ---------------------------------

async function buildBackupPayload(): Promise<BackupPayload> {
  const profiles = await getProfiles();
  const withRecords = await Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      records: await getRecordsForProfile(profile.id),
    }))
  );
  return {
    exportedAt: new Date().toISOString(),
    appVersion: appConfig?.expo?.version ?? "1.0.0",
    profiles: withRecords,
  };
}

async function getAccessToken(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const current = await GoogleSignin.getCurrentUser();
  if (!current) {
    await GoogleSignin.signIn();
  } else {
    try {
      await GoogleSignin.signInSilently();
    } catch {
      await GoogleSignin.signIn();
    }
  }
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

export async function getConnectedAccountEmail(): Promise<string | null> {
  ensureConfigured();
  try {
    const current = await GoogleSignin.getCurrentUser();
    return current?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function signOutOfDrive(): Promise<void> {
  ensureConfigured();
  await GoogleSignin.signOut();
}

async function findBackupFileId(accessToken: string): Promise<string | null> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const match = (data.files ?? []).find((f: any) => f.name === BACKUP_FILE_NAME);
  return match?.id ?? null;
}

async function uploadBackup(accessToken: string, payload: EncryptedBackup, existingFileId: string | null): Promise<void> {
  const boundary = "skairo_backup_boundary";
  const metadata = existingFileId ? { name: BACKUP_FILE_NAME } : { name: BACKUP_FILE_NAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
}

export async function backupToDrive(passphrase: string): Promise<{ profileCount: number; recordCount: number }> {
  const accessToken = await getAccessToken();
  const payload = await buildBackupPayload();
  const encrypted = await encryptJson(JSON.stringify(payload), passphrase);
  const existingFileId = await findBackupFileId(accessToken);
  await uploadBackup(accessToken, encrypted, existingFileId);
  return {
    profileCount: payload.profiles.length,
    recordCount: payload.profiles.reduce((sum, p) => sum + p.records.length, 0),
  };
}

export type RestoreResult =
  | { status: "restored"; restoredProfiles: number; restoredRecords: number }
  | { status: "no-backup" }
  | { status: "already-has-data" };

export async function restoreFromDrive(passphrase: string): Promise<RestoreResult> {
  const existing = await getProfiles();
  if (existing.length > 0) return { status: "already-has-data" };

  const accessToken = await getAccessToken();
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) return { status: "no-backup" };

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status} ${await res.text()}`);
  const encrypted: EncryptedBackup = await res.json();
  const plainJson = decryptJson(encrypted, passphrase);
  const payload: BackupPayload = JSON.parse(plainJson);

  let restoredRecords = 0;
  for (const p of payload.profiles) {
    const newId = await restoreProfileRecord(p);
    for (const r of p.records) {
      await restoreRecord(newId, r);
      restoredRecords++;
    }
  }
  return { status: "restored", restoredProfiles: payload.profiles.length, restoredRecords };
}

export async function debugListDriveAppData(): Promise<string> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const files = data.files ?? [];
  if (files.length === 0) return "No backup file found in appDataFolder.";
  return files
    .map(
      (f: any) =>
        `${f.name}\nid: ${f.id}\nsize: ${f.size ? `${Math.round(f.size / 1024)} KB` : "unknown"}\nlast modified: ${new Date(f.modifiedTime).toLocaleString()}`
    )
    .join("\n\n");
}

// Pass a passphrase to see the decrypted contents; omit it to see the raw
// encrypted file as it actually sits on Drive (proof it's unreadable
// without the key).
export async function debugFetchDriveBackupContent(passphrase?: string): Promise<string> {
  const accessToken = await getAccessToken();
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) return "No backup file found in appDataFolder.";

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status} ${await res.text()}`);
  const encrypted: EncryptedBackup = await res.json();

  if (!passphrase) {
    const raw = JSON.stringify(encrypted, null, 2);
    return `This file is encrypted — here's exactly what's stored on Drive:\n\n${raw.length > 1500 ? raw.slice(0, 1500) + "\n…(truncated)" : raw}`;
  }

  const plainJson = decryptJson(encrypted, passphrase);
  const pretty = JSON.stringify(JSON.parse(plainJson), null, 2);
  return pretty.length > 3000 ? `${pretty.slice(0, 3000)}\n…(truncated)` : pretty;
}

export { isErrorWithCode, statusCodes };