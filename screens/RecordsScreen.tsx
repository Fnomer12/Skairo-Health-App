import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity, Pressable,
  Modal, TextInput, Alert, ActivityIndicator, Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { ChevronLeft, Bluetooth, Plus, HeartPulse } from "lucide-react-native";
import { Profile } from "../db/profiles";
import { Reading, initRecordsTable, getRecordsForProfile, addRecord, deleteRecord } from "../db/records";
import { useBle } from "../context/BleContext";
import { useTheme, ThemeColors } from "../context/ThemeContext";
import DashboardTab from "./records/DashboardTab";
import IntakeTab from "./records/IntakeTab";
import ProfileTab from "./records/ProfileTab";
import Avatar from "./components/Avatar";
import LiquidTabBar, { LiquidTabItem } from "./components/LiquidTabBar";
import { DashboardIcon, IntakeIcon, ProfileIcon } from "./components/TabIcons";

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

const TAB_ITEMS: Array<LiquidTabItem & { key: TabKey }> = [
  { key: "dashboard", label: "Dashboard", Icon: DashboardIcon, fx: "pop" },
  { key: "intake", label: "Intake", Icon: IntakeIcon, fx: "heartbeat" },
  { key: "profile", label: "Profile", Icon: ProfileIcon, fx: "wave" },
];

export default function RecordsScreen({ profile, onBack, onConnect, onProfileUpdated }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const styles = createStyles(colors);

  const isDark = resolvedScheme === "dark";
  const blue = isDark ? "#0A84FF" : "#007AFF";

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

  // large title collapses into a small glass pill as you scroll (iOS / ChatGPT style)
  // the header floats over the tabs, so collapsing it never changes their layout (no jumping)
  const titleShift = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, -60], extrapolate: "clamp" });
  const titleOpacity = scrollY.interpolate({ inputRange: [0, 35], outputRange: [1, 0], extrapolate: "clamp" });
  const pillOpacity = scrollY.interpolate({ inputRange: [35, 70], outputRange: [0, 1], extrapolate: "clamp" });
  const pillShift = scrollY.interpolate({ inputRange: [35, 70], outputRange: [6, 0], extrapolate: "clamp" });

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [headerH, setHeaderH] = useState(214);
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  // only the visible state is tappable: large title when expanded, small pill when collapsed
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const next = value > 40;
      if (next !== collapsedRef.current) {
        collapsedRef.current = next;
        setCollapsed(next);
      }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

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

  useEffect(() => {
    scrollY.setValue(0);
  }, [activeTab]);

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
      <View style={styles.content}>
        {activeTab === "dashboard" && (
          <DashboardTab records={records} loading={loading} onScroll={handleContentScroll} topInset={headerH} />
        )}
        {activeTab === "intake" && (
          <IntakeTab
            records={records}
            connected={!!connectedDevice}
            onDeleteRecord={handleDeleteRecord}
            onScroll={handleContentScroll}
            topInset={headerH}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            profile={profile}
            onProfileUpdated={onProfileUpdated}
            onProfileDeleted={onBack}
            onScroll={handleContentScroll}
            topInset={headerH}
          />
        )}
      </View>

      {/* floating header — sits on top of the tab content */}
      <View
        style={styles.headerSection}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}
      >
        {/* glass strip behind the toolbar, appears once content scrolls under it */}
        <Animated.View pointerEvents="none" style={[styles.toolbarBg, { opacity: headerBlurOpacity }]}>
          <BlurView intensity={40} tint={resolvedScheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* large title + primary action — collapses on scroll */}
        <Animated.View
          pointerEvents={collapsed ? "none" : "box-none"}
          style={[styles.titleRow, { opacity: titleOpacity, transform: [{ translateY: titleShift }] }]}
        >
          <View style={styles.titleBlock}>
            <Text style={[styles.largeTitle, { color: blue }]} numberOfLines={1}>
              {TAB_LABELS[activeTab]}
            </Text>
            {/* person chip — small avatar + first name, opens the Profile tab */}
            <Pressable
              onPress={() => setActiveTab("profile")}
              style={({ pressed }) => [
                styles.personChip,
                { borderColor: isDark ? "#38383A" : "#E5E5EA" },
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${profile.firstName}'s profile`}
            >
              <Avatar uri={profile.photoUri} name={`${profile.firstName} ${profile.lastName}`} size={24} />
              <Text style={styles.personName} numberOfLines={1}>
                {profile.firstName}
              </Text>
            </Pressable>
          </View>

        </Animated.View>

        {/* toolbar — floating glass buttons, like iOS 26 */}
        <View style={styles.toolbar} pointerEvents="box-none">
          <View style={styles.toolbarLeft}>
            <GlassButton onPress={onBack} isDark={isDark} accessibilityLabel="Back">
              <ChevronLeft color={colors.text} size={22} strokeWidth={2.6} />
            </GlassButton>

            {/* compact title — fades in once the large title has scrolled away */}
            <Animated.View
              pointerEvents={collapsed ? "auto" : "none"}
              style={{ opacity: pillOpacity, transform: [{ translateY: pillShift }] }}
            >
              <GlassGroup isDark={isDark}>
                <View style={styles.pillInner}>
                  <Avatar uri={profile.photoUri} name={`${profile.firstName} ${profile.lastName}`} size={24} />
                  <Text style={styles.pillTitle} numberOfLines={1}>
                    {TAB_LABELS[activeTab]}
                  </Text>
                  <Text style={styles.pillSub} numberOfLines={1}>
                    {profile.firstName}
                  </Text>
                </View>
              </GlassGroup>
            </Animated.View>
          </View>

          {/* right-hand actions grouped in one glass capsule */}
          <GlassGroup isDark={isDark}>
            <Pressable
              onPress={onConnect}
              style={styles.groupItem}
              accessibilityRole="button"
              accessibilityLabel={connectedDevice ? "Device connected" : "Connect device"}
            >
              <Bluetooth color={connectedDevice ? blue : colors.text} size={19} strokeWidth={2.3} />
              {connectedDevice && <View style={[styles.liveDot, { borderColor: isDark ? "#2C2C2E" : "#FFFFFF" }]} />}
            </Pressable>
            <Pressable
              onPress={openManualEntry}
              style={styles.groupItem}
              accessibilityRole="button"
              accessibilityLabel="Add reading manually"
            >
              <Plus color={colors.text} size={21} strokeWidth={2.4} />
            </Pressable>
          </GlassGroup>
        </View>
      </View>

           <LiquidTabBar
        items={TAB_ITEMS}
        activeIndex={activeIndex}
        onChange={(_, item) => setActiveTab(item.key as TabKey)}
        tone={isDark ? "dark" : "light"}
        accent={blue}
        action={{
          // Measure — or Connect first if the device isn't linked yet
          onPress: connectedDevice ? handleTakeReading : onConnect,
          accessibilityLabel: connectedDevice ? "Take reading" : "Connect device to take a reading",
          icon: takingReading ? (
            <ActivityIndicator color={blue} />
          ) : (
            <HeartPulse color={connectedDevice ? blue : colors.textMuted} size={24} strokeWidth={2.2} />
          ),
        }}
      />

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

// Round frosted-glass button (iOS 26 toolbar style)
function GlassButton({
  onPress,
  isDark,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  isDark: boolean;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [glass.shadow, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <View
        style={[
          glass.circle,
          {
            backgroundColor: isDark ? "rgba(44,44,46,0.72)" : "rgba(255,255,255,0.78)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </Pressable>
  );
}

// Glass capsule that holds several icons (or a title) — like the grouped buttons in iOS 26 / ChatGPT
function GlassGroup({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <View style={glass.shadow}>
      <View
        style={[
          glass.group,
          {
            backgroundColor: isDark ? "rgba(44,44,46,0.72)" : "rgba(255,255,255,0.78)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </View>
  );
}

const glass = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  group: {
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});

const TOP = 60; // status-bar space (same as before)
const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerSection: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: TOP + 54, paddingBottom: 10 },
    toolbarBg: { position: "absolute", top: 0, left: 0, right: 0, height: TOP + 54 },
    toolbar: {
      position: "absolute", top: TOP, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    groupItem: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    pillInner: { flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 10, paddingRight: 14 },
    pillTitle: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600", color: colors.text },
    pillSub: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.textMuted },
    liveDot: {
      position: "absolute", top: 9, right: 9, width: 9, height: 9, borderRadius: 5,
      backgroundColor: "#34C759", borderWidth: 1.5,
    },
    titleRow: {
      flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
      paddingHorizontal: 20, gap: 12,
    },
    titleBlock: { flex: 1 },
    largeTitle: { fontSize: 34, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: -0.6 },
    personChip: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7,
      paddingLeft: 3, paddingRight: 12, paddingVertical: 3, borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth, marginTop: 4,
    },
    personName: { fontSize: 14, fontFamily: FONT_DEMI, fontWeight: "600", color: colors.text },
    measureBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 16, height: 38, borderRadius: 19, marginBottom: 4,
    },
    measureText: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600" },
    content: { flex: 1 },

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