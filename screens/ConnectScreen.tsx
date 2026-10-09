import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { ArrowLeft, Bluetooth } from "lucide-react-native";
import { useBle } from "../context/BleContext";
import { useTheme, ThemeColors } from "../context/ThemeContext";

type Props = {
  onBack: () => void;
};

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;

export default function ConnectScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

  useEffect(() => {
    startScan().catch((e) => console.warn(e.message));
    return () => stopScanning();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Connect Device</Text>
        <View style={{ width: 22 }} />
      </View>

      {connectedDevice ? (
        <View style={styles.connectedBox}>
          <Bluetooth color={colors.text} size={32} />
          <Text style={styles.connectedName}>{connectedDevice.name}</Text>
          <Text style={styles.connectedSub}>Connected</Text>
          <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.scanRow}>
            {isScanning && <ActivityIndicator size="small" color={colors.textMuted} />}
            <Text style={styles.scanText}>
              {isScanning ? "Scanning for your device…" : "Scan stopped"}
            </Text>
          </View>

          <FlatList
            data={discoveredDevices}
            keyExtractor={(d) => d.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No devices found yet. Make sure your ESP32 is powered on and nearby.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceRow}
                onPress={() => connect(item).catch((e) => console.warn(e.message))}
                disabled={isConnecting}
              >
                <Bluetooth color={colors.text} size={20} />
                <Text style={styles.deviceName}>{item.name ?? "Unknown device"}</Text>
                {isConnecting && <ActivityIndicator size="small" color={colors.textMuted} />}
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    title: { fontSize: 19, fontWeight: "700", color: colors.text, fontFamily: FONT_BOLD },
    scanRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginBottom: 20,
    },
    scanText: { color: colors.textMuted, fontSize: 14, fontFamily: FONT_MEDIUM },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    emptyText: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 40,
      paddingHorizontal: 20,
      fontFamily: FONT_MEDIUM,
    },
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deviceName: { flex: 1, fontSize: 16, color: colors.text, fontFamily: FONT_MEDIUM },
    connectedBox: { alignItems: "center", marginTop: 60 },
    connectedName: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 12, fontFamily: FONT_BOLD },
    connectedSub: { fontSize: 14, color: colors.success, marginTop: 4, fontFamily: FONT_MEDIUM },
    disconnectButton: {
      marginTop: 24,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    disconnectText: { color: colors.accent, fontWeight: "600", fontFamily: FONT_MEDIUM },
  });
}