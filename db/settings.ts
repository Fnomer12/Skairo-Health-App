import * as FileSystem from "expo-file-system/legacy";

export type ThemeMode = "light" | "dark" | "system";

type Settings = {
  themeMode: ThemeMode;
};

const SETTINGS_PATH = `${FileSystem.documentDirectory}settings.json`;

const DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
};

export async function loadSettings(): Promise<Settings> {
  try {
    const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
    if (!info.exists) return DEFAULT_SETTINGS;
    const raw = await FileSystem.readAsStringAsync(SETTINGS_PATH);
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveThemeMode(themeMode: ThemeMode): Promise<void> {
  const current = await loadSettings();
  const updated: Settings = { ...current, themeMode };
  await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify(updated));
}