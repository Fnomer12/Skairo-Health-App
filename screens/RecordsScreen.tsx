import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { ChevronLeft, Bluetooth, Plus, LayoutGrid, Activity, UserRound } from "lucide-react-native";
import { Profile } from "../db/profiles";
import { Reading, initRecordsTable, getRecordsForProfile, addRecord, deleteRecord } from "../db/records";
import { useBle } from "../context/BleContext";
import { useTheme, ThemeColors } from "../context/ThemeContext";
import DashboardTab from "./records/DashboardTab";
import IntakeTab from "./records/IntakeTab";
import ProfileTab from "./records/ProfileTab";

type Props = {
  profile: Profile;
  onBack: () => void;
  onConnect: () => void;
  onProfileUpdated: (updated: Profile) => void;
};

type TabKey = "dashboard" | "intake" | "profile";

const TAB_LABELS: Record<TabKey, string> = {
  dashboard: "Dashboard",
  intake: "Intake",
  profile: "Profile",
};

const TAB_ITEMS: Array<{ key: TabKey; Icon: typeof LayoutGrid }> = [
  { key: "dashboard", Icon: LayoutGrid },
  { key: "intake", Icon: Activity },
  { key: "profile", Icon: UserRound },
];

export default function RecordsScreen({ profile, onBack, onConnect, onProfileUpdated }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const styles = createStyles(colors);

  const { connectedDevice, takeReading } = useBle();
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleContentScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const headerBlurOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [records, setRecords] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualVisible, setManualVisible] = useState(false);
  const [hr, setHr] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [takingReading, setTakingReading] = useState(false);

  const activeIndex = TAB_ITEMS.findIndex((t) => t.key === activeTab);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(activeIndex)).current;
  const squishAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start();

    squishAnim.setValue(0.82);
    Animated.spring(squishAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 140,
    }).start();
  }, [activeIndex]);

  useEffect(() => {
    scrollY.setValue(0);
  }, [activeTab]);

  const indicatorWidth = barWidth > 0 ? barWidth / TAB_ITEMS.length : 0;
  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: TAB_ITEMS.map((_, i) => i),
    outputRange: TAB_ITEMS.map((_, i) => i * indicatorWidth),
  });

  const loadRecords = useCallback(async () => {
    try {
      await initRecordsTable();
      const rows = await getRecordsForProfile(profile.id);
      setRecords(rows);
    } catch (e) {
      Alert.alert("Couldn't load records", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    setLoading(true);
    loadRecords();
  }, [loadRecords]);

  function openManualEntry() {
    setHr("");
    setTemp("");
    setSpo2("");
    setRr("");
    setManualVisible(true);
  }

  async function handleManualSave() {
    if (!hr.trim() || !temp.trim() || !spo2.trim()) {
      Alert.alert("Missing values", "Heart rate, temperature, and SpO2 are required.");
      return;
    }
    setSavingManual(true);
    try {
      await addRecord(
        profile.id,
        parseFloat(hr),
        parseFloat(temp),
        parseFloat(spo2),
        null,
        rr.trim() ? parseFloat(rr) : null
      );
      await loadRecords();
      setManualVisible(false);
    } catch (e) {
      Alert.alert("Couldn't save reading", (e as Error).message);
    } finally {
      setSavingManual(false);
    }
  }

  async function handleTakeReading() {
    setTakingReading(true);
    try {
      const reading = await takeReading();
      await addRecord(profile.id, reading.heartRate, reading.temperature, reading.spo2, reading.status, null);
      await loadRecords();
    } catch (e) {
      Alert.alert("Couldn't take reading", (e as Error).message);
    } finally {
      setTakingReading(false);
    }
  }

  async function handleDeleteRecord(id: number) {
    try {
      await deleteRecord(id);
      await loadRecords();
    } catch (e) {
      Alert.alert("Couldn't delete reading", (e as Error).message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: headerBlurOpacity }]}
        >
          <BlurView
            intensity={40}
            tint={resolvedScheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft color={colors.text} size={26} strokeWidth={3} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {profile.firstName}'s {TAB_LABELS[activeTab]}
          </Text>
          <TouchableOpacity
            style={[styles.connectPill, connectedDevice && styles.connectPillActive]}
            onPress={onConnect}
          >
            <Bluetooth color={connectedDevice ? colors.accentText : colors.text} size={14} />
            <Text style={[styles.connectPillText, connectedDevice && styles.connectPillTextActive]}>
              {connectedDevice ? "Connected" : "Connect"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.takeReadingButton, !connectedDevice && styles.disabledButton]}
            onPress={handleTakeReading}
            disabled={!connectedDevice || takingReading}
          >
            {takingReading ? (
              <ActivityIndicator color={colors.accentText} size="small" />
            ) : (
              <Text style={styles.takeReadingText}>Take reading</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualButton} onPress={openManualEntry}>
            <Plus color={colors.text} size={16} />
            <Text style={styles.manualButtonText}>Add manually</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === "dashboard" && (
          <DashboardTab records={records} loading={loading} onScroll={handleContentScroll} />
        )}
        {activeTab === "intake" && (
          <IntakeTab
            records={records}
            connected={!!connectedDevice}
            onDeleteRecord={handleDeleteRecord}
            onScroll={handleContentScroll}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            profile={profile}
            onProfileUpdated={onProfileUpdated}
            onProfileDeleted={onBack}
            onScroll={handleContentScroll}
          />
        )}
      </View>

      <View style={styles.tabBarWrapper} pointerEvents="box-none">
        <BlurView intensity={55} tint="dark" style={styles.tabBar}>
          <View style={styles.tabBarInner} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
            {barWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.liquidIndicator,
                  {
                    width: indicatorWidth,
                    transform: [
                      { translateX: indicatorTranslateX },
                      { scaleX: squishAnim },
                      { scaleY: squishAnim },
                    ],
                  },
                ]}
              >
                <View style={styles.liquidSheen} />
              </Animated.View>
            )}

            {TAB_ITEMS.map(({ key, Icon }) => {
              const active = activeTab === key;
              return (
                <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setActiveTab(key)}>
                  <Icon color={active ? "#ffffff" : "rgba(255,255,255,0.5)"} size={20} />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {TAB_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>

      <Modal visible={manualVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add reading</Text>
            <TextInput
              style={styles.input}
              placeholder="Heart rate (bpm)"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              value={hr}
              onChangeText={setHr}
            />
            <TextInput
              style={styles.input}
              placeholder="Temperature (°C)"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              value={temp}
              onChangeText={setTemp}
            />
            <TextInput
              style={styles.input}
              placeholder="SpO2 (%)"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              value={spo2}
              onChangeText={setSpo2}
            />
            <TextInput
              style={styles.input}
              placeholder="Respiratory rate (rpm) — optional"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              value={rr}
              onChangeText={setRr}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setManualVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleManualSave} disabled={savingManual}>
                {savingManual ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
    headerSection: { position: "relative" },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, marginBottom: 14, gap: 10,
    },
    title: { flex: 1, fontSize: 18, fontFamily: FONT_BOLD, fontWeight: "700", color: colors.text },
    connectPill: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1, borderColor: colors.accent,
    },
    connectPillActive: { backgroundColor: colors.accent },
    connectPillText: { fontSize: 12, fontFamily: FONT_DEMI, color: colors.text },
    connectPillTextActive: { color: colors.accentText },
    actionsRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 20, marginBottom: 10,
    },
    takeReadingButton: {
      flex: 1, backgroundColor: colors.accent, borderRadius: 12,
      paddingVertical: 12, alignItems: "center", justifyContent: "center",
    },
    disabledButton: { backgroundColor: colors.border },
    takeReadingText: { color: colors.accentText, fontSize: 14, fontFamily: FONT_DEMI },
    manualButton: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    },
    manualButtonText: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.text },
    content: { flex: 1 },

    tabBarWrapper: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: Platform.OS === "ios" ? 32 : 20,
    },
    tabBar: {
      borderRadius: 30,
      overflow: "hidden",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      backgroundColor: "rgba(20,20,20,0.35)",
      ...Platform.select({
        ios: {
          shadowColor: "#000000",
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 12 },
      }),
    },
    tabBarInner: {
      flexDirection: "row",
      position: "relative",
    },
    liquidIndicator: {
      position: "absolute",
      top: 0,
      bottom: 0,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.20)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.40)",
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#ffffff",
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        },
        android: {},
      }),
    },
    liquidSheen: {
      position: "absolute",
      top: 2,
      left: 4,
      right: 4,
      height: "45%",
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 8 },
    tabLabel: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: FONT_MEDIUM },
    tabLabelActive: { color: "#ffffff", fontFamily: FONT_DEMI },

    modalBackdrop: { flex: 1, backgroundColor: colors.modalBackdrop, justifyContent: "center", alignItems: "center" },
    modalBox: { width: "85%", backgroundColor: colors.background, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.text,
    },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 10 },
    modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    cancelButton: { backgroundColor: colors.surfaceAlt },
    cancelText: { fontFamily: FONT_DEMI, color: colors.text },
    saveButton: { backgroundColor: colors.accent },
    saveText: { fontFamily: FONT_DEMI, color: colors.accentText },
  });
}