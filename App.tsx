import React, { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LockScreen from "./screens/LockScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RecordsScreen from "./screens/RecordsScreen";
import ConnectScreen from "./screens/ConnectScreen";
import AnimatedSplashScreen from "./screens/AnimatedSplashScreen";

import { Profile } from "./db/profiles";
import { BleProvider } from "./context/BleContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

type Screen = "profiles" | "records" | "connect";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { colors } = useTheme();
  const [unlocked, setUnlocked] = useState(true);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("profiles");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const barStyle = colors.statusBarStyle === "light" ? "light-content" : "dark-content";

  if (showSplash) {
    return (
      <>
        <StatusBar barStyle={barStyle} />
        <BleProvider>
          <AnimatedSplashScreen onFinish={() => setShowSplash(false)} />
        </BleProvider>
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle={barStyle} />
      <BleProvider>
        {!unlocked ? (
          <LockScreen onUnlock={() => setUnlocked(true)} />
        ) : !activeProfile || screen === "profiles" ? (
          <ProfileScreen
            onSelectProfile={(p) => {
              setActiveProfile(p);
              setScreen("records");
            }}
          />
        ) : screen === "connect" ? (
          <ConnectScreen onBack={() => setScreen("records")} />
        ) : (
          <RecordsScreen
            profile={activeProfile}
            onBack={() => {
              setActiveProfile(null);
              setScreen("profiles");
            }}
            onConnect={() => setScreen("connect")}
            onProfileUpdated={(p) => setActiveProfile(p)}
          />
        )}
      </BleProvider>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}