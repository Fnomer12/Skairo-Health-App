import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { loadSettings, saveThemeMode, ThemeMode } from "../db/settings";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  onAccentOverlay: string;
  onAccentOverlayBorder: string;
  onAccentMuted: string;
  onAccentFaint: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  success: string;
  warning: string;
  modalBackdrop: string;
  statusBarStyle: "light" | "dark";
};

const lightColors: ThemeColors = {
  background: "#ffffff",
  surface: "#f8f8f8",
  surfaceAlt: "#f2f2f2",
  border: "#e0e0e0",
  text: "#000000",
  textMuted: "#6b6b6b",
  textFaint: "#9a9a9a",
  accent: "#000000",
  accentText: "#ffffff",
  onAccentOverlay: "rgba(255,255,255,0.14)",
  onAccentOverlayBorder: "rgba(255,255,255,0.22)",
  onAccentMuted: "rgba(255,255,255,0.6)",
  onAccentFaint: "rgba(255,255,255,0.14)",
  danger: "#c62828",
  dangerBg: "#fdecea",
  dangerBorder: "#f3c6c2",
  success: "#2e7d32",
  warning: "#e08a00",
  modalBackdrop: "rgba(0,0,0,0.4)",
  statusBarStyle: "dark",
};

const darkColors: ThemeColors = {
  background: "#000000",
  surface: "#1c1c1e",
  surfaceAlt: "#242426",
  border: "#303032",
  text: "#ffffff",
  textMuted: "#a7a7aa",
  textFaint: "#7d7d80",
  accent: "#ffffff",
  accentText: "#000000",
  onAccentOverlay: "rgba(0,0,0,0.08)",
  onAccentOverlayBorder: "rgba(0,0,0,0.15)",
  onAccentMuted: "rgba(0,0,0,0.55)",
  onAccentFaint: "rgba(0,0,0,0.12)",
  danger: "#ff6b6b",
  dangerBg: "#3a1f1f",
  dangerBorder: "#5c2b2b",
  success: "#4caf50",
  warning: "#f0a830",
  modalBackdrop: "rgba(0,0,0,0.6)",
  statusBarStyle: "light",
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedScheme: "light" | "dark";
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((s) => {
      if (!cancelled) setModeState(s.themeMode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    saveThemeMode(next).catch(() => {});
  }

  const resolvedScheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const colors = resolvedScheme === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, resolvedScheme, colors, setMode }),
    [mode, resolvedScheme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}