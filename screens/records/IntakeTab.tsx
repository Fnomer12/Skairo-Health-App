import React from "react";
import { View, Text, FlatList, StyleSheet, Platform } from "react-native";
import { Reading } from "../../db/records";

type IntakeReading = Reading & { respiratoryRate?: number };

type Props = { records: Reading[]; connected: boolean };

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function IntakeTab({ records, connected }: Props) {
  if (records.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No analyzed intake yet.</Text>
        <Text style={styles.emptySub}>
          {connected ? "Take a reading from the device to see it here." : "Connect the device and take a reading to see analyzed vitals."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.sectionLabel}>Analyzed intakes</Text>}
      renderItem={({ item }) => {
        const rr = (item as IntakeReading).respiratoryRate;
        return (
          <View style={styles.intakeCard}>
            <View style={styles.intakeHeader}>
              <Text style={styles.intakeDate}>{formatDateTime(item.recordedAt)}</Text>
              {item.status && (
                <View style={styles.classificationPill}>
                  <Text style={styles.classificationPillText}>{item.status}</Text>
                </View>
              )}
            </View>

            <View style={styles.grid}>
              <View style={[styles.gridItem, styles.gridItemRightBorder, styles.gridItemBottomBorder]}>
                <Text style={styles.gridLabel}>Heart rate</Text>
                <Text style={styles.gridValue}>{item.heartRate}<Text style={styles.unit}> bpm</Text></Text>
              </View>
              <View style={[styles.gridItem, styles.gridItemBottomBorder]}>
                <Text style={styles.gridLabel}>Temperature</Text>
                <Text style={styles.gridValue}>{item.temperature}<Text style={styles.unit}> °C</Text></Text>
              </View>
              <View style={[styles.gridItem, styles.gridItemRightBorder]}>
                <Text style={styles.gridLabel}>SpO2</Text>
                <Text style={styles.gridValue}>{item.spo2}<Text style={styles.unit}> %</Text></Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Resp. rate</Text>
                <Text style={styles.gridValue}>
                  {rr != null ? rr : "–"}<Text style={styles.unit}> rpm</Text>
                </Text>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 30 },
  emptyText: { fontSize: 15, fontFamily: FONT_DEMI, color: "#000000", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#9a9a9a", textAlign: "center" },
  sectionLabel: { fontSize: 13, fontFamily: FONT_DEMI, color: "#6b6b6b", marginBottom: 10 },
  intakeCard: {
    backgroundColor: "#f8f8f8", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0",
    marginBottom: 12, overflow: "hidden",
  },
  intakeHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  intakeDate: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#6b6b6b" },
  classificationPill: { backgroundColor: "#000000", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  classificationPillText: { fontSize: 10, fontFamily: FONT_DEMI, color: "#ffffff" },
  grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#e0e0e0" },
  gridItem: { width: "50%", paddingHorizontal: 14, paddingVertical: 14 },
  gridItemRightBorder: { borderRightWidth: 1, borderRightColor: "#e0e0e0" },
  gridItemBottomBorder: { borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  gridLabel: { fontSize: 11, fontFamily: FONT_MEDIUM, color: "#9a9a9a", marginBottom: 4 },
  gridValue: { fontSize: 17, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000" },
  unit: { fontSize: 11, fontFamily: FONT_MEDIUM, color: "#9a9a9a" },
});