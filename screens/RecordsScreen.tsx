import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { ArrowLeft, Bluetooth, Plus, LayoutGrid, Activity, UserRound } from "lucide-react-native";
import { Profile } from "../db/profiles";
import { Reading, initRecordsTable, getRecordsForProfile, addRecord } from "../db/records";
import { useBle } from "../context/BleContext";
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

export default function RecordsScreen({ profile, onBack, onConnect, onProfileUpdated }: Props) {
  const { connectedDevice, takeReading } = useBle();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft color="#000000" size={22} />
        </TouchableOpacity>
       <Text style={styles.title} numberOfLines={1}>
  {profile.firstName}'s {TAB_LABELS[activeTab]}
</Text>
        <TouchableOpacity
          style={[styles.connectPill, connectedDevice && styles.connectPillActive]}
          onPress={onConnect}
        >
          <Bluetooth color={connectedDevice ? "#ffffff" : "#000000"} size={14} />
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
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.takeReadingText}>Take reading</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.manualButton} onPress={openManualEntry}>
          <Plus color="#000000" size={16} />
          <Text style={styles.manualButtonText}>Add manually</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === "dashboard" && <DashboardTab records={records} loading={loading} />}
        {activeTab === "intake" && <IntakeTab records={records} connected={!!connectedDevice} />}
        {activeTab === "profile" && (
          <ProfileTab profile={profile} onProfileUpdated={onProfileUpdated} onProfileDeleted={onBack} />
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("dashboard")}>
          <LayoutGrid color={activeTab === "dashboard" ? "#000000" : "#9a9a9a"} size={22} />
          <Text style={[styles.tabLabel, activeTab === "dashboard" && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("intake")}>
          <Activity color={activeTab === "intake" ? "#000000" : "#9a9a9a"} size={22} />
          <Text style={[styles.tabLabel, activeTab === "intake" && styles.tabLabelActive]}>Intake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("profile")}>
          <UserRound color={activeTab === "profile" ? "#000000" : "#9a9a9a"} size={22} />
          <Text style={[styles.tabLabel, activeTab === "profile" && styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={manualVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add reading</Text>
            <TextInput
              style={styles.input}
              placeholder="Heart rate (bpm)"
              keyboardType="numeric"
              value={hr}
              onChangeText={setHr}
            />
            <TextInput
              style={styles.input}
              placeholder="Temperature (°C)"
              keyboardType="numeric"
              value={temp}
              onChangeText={setTemp}
            />
            <TextInput
              style={styles.input}
              placeholder="SpO2 (%)"
              keyboardType="numeric"
              value={spo2}
              onChangeText={setSpo2}
            />
            <TextInput
              style={styles.input}
              placeholder="Respiratory rate (rpm) — optional"
              keyboardType="numeric"
              value={rr}
              onChangeText={setRr}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setManualVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleManualSave} disabled={savingManual}>
                {savingManual ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", paddingTop: 60 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 14, gap: 10,
  },
  title: { flex: 1, fontSize: 18, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000" },
  connectPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: "#000000",
  },
  connectPillActive: { backgroundColor: "#000000" },
  connectPillText: { fontSize: 12, fontFamily: FONT_DEMI, color: "#000000" },
  connectPillTextActive: { color: "#ffffff" },
  actionsRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, marginBottom: 10,
  },
  takeReadingButton: {
    flex: 1, backgroundColor: "#000000", borderRadius: 12,
    paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  disabledButton: { backgroundColor: "#cfcfcf" },
  takeReadingText: { color: "#ffffff", fontSize: 14, fontFamily: FONT_DEMI },
  manualButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#f2f2f2",
  },
  manualButtonText: { fontSize: 13, fontFamily: FONT_DEMI, color: "#000000" },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e0e0e0",
    paddingTop: 8, paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { fontSize: 11, color: "#9a9a9a", fontFamily: FONT_MEDIUM },
  tabLabelActive: { color: "#000000", fontFamily: FONT_DEMI },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "85%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: "#000000" },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM,
  },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 10 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: "#f2f2f2" },
  cancelText: { fontFamily: FONT_DEMI, color: "#000000" },
  saveButton: { backgroundColor: "#000000" },
  saveText: { fontFamily: FONT_DEMI, color: "#ffffff" },
});