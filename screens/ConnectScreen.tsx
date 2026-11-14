import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bluetooth, Check } from "lucide-react-native";
import { useBle } from "../context/BleContext";
import { useTheme } from "../context/ThemeContext";

type Props = {
  onBack: () => void;
  onTakeReading?: () => void; // goes back to the dashboard and starts a reading
};

type Phase = "searching" | "found" | "notFound" | "connected";

const MASCOT: Record<Phase, any> = {
  searching: require("../assets/mascot/pulse-searching.png"),
  found: require("../assets/mascot/pulse-found.png"),
  notFound: require("../assets/mascot/pulse-notfound.png"),
  connected: require("../assets/mascot/pulse-connected.png"),
};

const BUBBLE: Record<Phase, { title: string; sub: string }> = {
  searching: { title: "Looking for your Skairo…", sub: "This only takes a moment." },
  found: { title: "Found it!", sub: "Tap Connect to pair your device." },
  notFound: { title: "Hmm, I can’t find it", sub: "Is the device switched on and charged?" },
  connected: { title: "You’re connected! 🎉", sub: "Your Skairo device is ready." },
};

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;

export default function ConnectScreen({ onBack, onTakeReading }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const insets = useSafeAreaInsets();
  const {
    connectedDevice,
    isScanning,
    isConnecting,
    discoveredDevices,
    startScan,
    stopScanning,
    connect,
    disconnect,
  } = useBle();

  const pal = {
    blue: isDark ? "#0A84FF" : "#007AFF",
    green: isDark ? "#30D158" : "#34C759",
    greenText: isDark ? "#30D158" : "#248A3D",
    red: isDark ? "#FF453A" : "#FF3B30",
    sheet: isDark ? "#1C1C1E" : "#FFFFFF",
    row: isDark ? "#2C2C2E" : "#F2F2F7",
    stepBg: isDark ? "rgba(10,132,255,0.2)" : "rgba(0,122,255,0.12)",
  };

  // start scanning when the screen opens (only if not already connected)
  useEffect(() => {
    if (!connectedDevice) startScan().catch((e) => console.warn(e.message));
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase: Phase = connectedDevice
    ? "connected"
    : discoveredDevices.length > 0
    ? "found"
    : isScanning
    ? "searching"
    : "notFound";

  // which device the user picked (defaults to the first one found)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => discoveredDevices.find((d) => d.id === selectedId) ?? discoveredDevices[0] ?? null,
    [discoveredDevices, selectedId]
  );

  // Pulse pops in whenever the step changes, then gently bobs
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [phase, pop]);
 

  const bubble = BUBBLE[phase];

  function handleConnect() {
    if (!selected) return;
    stopScanning();
    connect(selected).catch((e) => console.warn(e.message));
  }

  function handleScanAgain() {
    setSelectedId(null);
    startScan().catch((e) => console.warn(e.message));
  }

  const Step = ({ n, text }: { n: number; text: string }) => (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: pal.stepBg }]}>
        <Text style={[styles.stepNumText, { color: pal.blue }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
    </View>
  );

  const PrimaryButton = ({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, { backgroundColor: pal.blue, opacity: pressed || busy ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* header */}
      <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Connect Device</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Pulse + speech bubble */}
      <View style={styles.hero}>
        <Animated.View
          style={{
            alignItems: "center",
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          }}
        >
          <View style={[styles.bubble, { backgroundColor: pal.sheet, shadowOpacity: isDark ? 0 : 0.08 }]}>
            <Text style={[styles.bubbleTitle, { color: colors.text }]}>{bubble.title}</Text>
            <Text style={[styles.bubbleSub, { color: colors.textMuted }]}>{bubble.sub}</Text>
            <View style={[styles.tail, { backgroundColor: pal.sheet }]} />
          </View>

                  <View style={[styles.mascotWrap, isDark && styles.mascotWrapDark]}>
            <Image source={MASCOT[phase]} style={styles.mascot} resizeMode="contain" />
          </View>
        </Animated.View>
      </View>

      {/* bottom sheet */}
      <View style={[styles.sheet, { backgroundColor: pal.sheet, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: isDark ? "#48484A" : "#D1D1D6" }]} />

        {phase === "searching" && (
          <>
            <Step n={1} text="Switch on your Skairo device" />
            <Step n={2} text="Keep it close to your phone" />
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.searchingText, { color: colors.textMuted }]}>Searching nearby…</Text>
            </View>
          </>
        )}

        {phase === "found" && (
          <>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 8 }}>
              {discoveredDevices.map((d) => {
                const isSel = selected?.id === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setSelectedId(d.id)}
                    style={[
                      styles.deviceRow,
                      { backgroundColor: pal.row, borderColor: isSel ? pal.blue : "transparent" },
                    ]}
                    accessibilityLabel={`Select ${d.name ?? "device"}`}
                  >
                    <Bluetooth color={pal.blue} size={20} strokeWidth={2.2} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deviceName, { color: colors.text }]}>{d.name ?? "Unknown device"}</Text>
                      <Text style={[styles.deviceSub, { color: colors.textMuted }]}>
                        {d.rssi != null ? (d.rssi > -70 ? "Strong signal" : "Weak signal, move closer") : "Nearby"}
                      </Text>
                    </View>
                    {isSel && discoveredDevices.length > 1 && <Check color={pal.blue} size={20} strokeWidth={2.6} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <PrimaryButton label={isConnecting ? "Connecting…" : "Connect"} onPress={handleConnect} busy={isConnecting} />
          </>
        )}

        {phase === "notFound" && (
          <>
            <Step n={1} text="Check the device is on and charged" />
            <Step n={2} text="Move closer to your phone" />
            <PrimaryButton label="Scan again" onPress={handleScanAgain} />
          </>
        )}

        {phase === "connected" && connectedDevice && (
          <>
            <View style={[styles.deviceRow, { backgroundColor: pal.row, borderColor: "transparent" }]}>
              <View style={[styles.liveDot, { backgroundColor: pal.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceName, { color: colors.text }]}>{connectedDevice.name ?? "Skairo device"}</Text>
                <Text style={[styles.deviceSub, { color: pal.greenText }]}>Connected</Text>
              </View>
              <Pressable onPress={() => disconnect().catch((e) => console.warn(e.message))} hitSlop={10}>
                <Text style={[styles.disconnect, { color: pal.red }]}>Disconnect</Text>
              </Pressable>
            </View>
            <PrimaryButton label={onTakeReading ? "Take a reading" : "Done"} onPress={onTakeReading ?? onBack} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 19, fontFamily: FONT_BOLD, fontWeight: "700" },

  hero: { flex: 1, alignItems: "center", paddingTop: 16 },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 18,
    maxWidth: 320,
    shadowColor: "#000",
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  bubbleTitle: { fontSize: 20, fontFamily: FONT_BOLD, fontWeight: "700", textAlign: "center" },
  bubbleSub: { fontSize: 14, fontFamily: FONT_MEDIUM, marginTop: 3, textAlign: "center" },
  tail: {
    position: "absolute",
    bottom: -7,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 3,
    transform: [{ rotate: "45deg" }],
  },
  mascotWrap: { width: 220, height: 220, borderRadius: 110, alignItems: "center", justifyContent: "center" },
  // light circle so the charcoal arms and legs stay visible in dark mode
  mascotWrapDark: { backgroundColor: "rgba(255,255,255,0.9)" },
  mascot: { width: 210, height: 210 },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 4 },

  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontFamily: FONT_BOLD, fontWeight: "700" },
  stepText: { fontSize: 15, fontFamily: FONT_MEDIUM },

  searchingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 4, paddingVertical: 6 },
  searchingText: { fontSize: 15, fontFamily: FONT_MEDIUM },

  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  deviceName: { fontSize: 16, fontFamily: FONT_DEMI, fontWeight: "600" },
  deviceSub: { fontSize: 12.5, fontFamily: FONT_MEDIUM, marginTop: 1 },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 5 },
  disconnect: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600" },

  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 17, fontFamily: FONT_DEMI, fontWeight: "600" },
});