import React, { useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Platform } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Reading } from "../../db/records";

type DashboardReading = Reading & { respiratoryRate?: number };

type Props = { records: Reading[]; loading: boolean };

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const CHART_HEIGHT = 70;
const CHART_WIDTH = 260;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function classify(records: Reading[]): { label: string; color: string } {
  if (records.length === 0) return { label: "No data yet", color: "#9a9a9a" };
  const latest = records[0];
  const status = (latest.status || "").toLowerCase();
  if (status.includes("critical") || status.includes("danger")) return { label: "Needs attention", color: "#c62828" };
  if (status.includes("warn") || status.includes("elevated")) return { label: "Slightly elevated", color: "#e08a00" };
  return { label: "Normal range", color: "#2e7d32" };
}

export default function DashboardTab({ records, loading }: Props) {
  const monthlyCounts = useMemo(() => {
    const counts = new Array(12).fill(0);
    const thisYear = new Date().getFullYear();
    records.forEach((r) => {
      const d = new Date(r.recordedAt);
      if (d.getFullYear() === thisYear) counts[d.getMonth()] += 1;
    });
    return counts;
  }, [records]);

  const maxCount = Math.max(1, ...monthlyCounts);
  const barWidth = CHART_WIDTH / 12 - 4;
  const classification = classify(records);

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryTitle}>This year</Text>
            <View style={[styles.classBadge, { backgroundColor: classification.color }]}>
              <Text style={styles.classBadgeText}>{classification.label}</Text>
            </View>
          </View>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 14 }}>
            {monthlyCounts.map((count, i) => {
              const h = (count / maxCount) * (CHART_HEIGHT - 16);
              return (
                <Rect
                  key={i}
                  x={i * (CHART_WIDTH / 12) + 2}
                  y={CHART_HEIGHT - 16 - h}
                  width={barWidth}
                  height={Math.max(h, 2)}
                  rx={3}
                  fill={count > 0 ? "#000000" : "#e5e5e5"}
                />
              );
            })}
          </Svg>
          <View style={styles.monthLabels}>
            {MONTH_LABELS.map((m, i) => (
              <Text key={i} style={styles.monthLabel}>{m}</Text>
            ))}
          </View>
          <Text style={styles.recentHeading}>Recent takes</Text>
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No readings yet.</Text>
            <Text style={styles.emptySub}>Connect a device or add one manually with the + button.</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const rr = (item as DashboardReading).respiratoryRate;
        return (
          <View style={styles.recordCard}>
            <Text style={styles.recordDate}>{formatDate(item.recordedAt)}</Text>
            <View style={styles.vitalsRow}>
              <View style={styles.vital}>
                <Text style={styles.vitalValue}>{item.heartRate}</Text>
                <Text style={styles.vitalLabel}>BPM</Text>
              </View>
              <View style={styles.vital}>
                <Text style={styles.vitalValue}>{item.temperature}°</Text>
                <Text style={styles.vitalLabel}>TEMP</Text>
              </View>
              <View style={styles.vital}>
                <Text style={styles.vitalValue}>{item.spo2}%</Text>
                <Text style={styles.vitalLabel}>SPO2</Text>
              </View>
              <View style={styles.vital}>
                <Text style={styles.vitalValue}>{rr != null ? rr : "–"}</Text>
                <Text style={styles.vitalLabel}>RESP</Text>
              </View>
            </View>
            {item.status && <Text style={styles.statusBadge}>{item.status}</Text>}
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
  summaryCard: {
    backgroundColor: "#f2f2f2", borderRadius: 16, padding: 18, marginBottom: 18,
  },
  summaryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTitle: { fontSize: 15, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000" },
  classBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  classBadgeText: { fontSize: 11, fontFamily: FONT_DEMI, color: "#ffffff" },
  monthLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  monthLabel: { fontSize: 9, color: "#9a9a9a", width: CHART_WIDTH / 12, textAlign: "center" },
  recentHeading: { fontSize: 13, fontFamily: FONT_DEMI, color: "#6b6b6b", marginTop: 18 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 15, fontFamily: FONT_DEMI, color: "#000000", marginBottom: 4 },
  emptySub: { fontSize: 13, color: "#9a9a9a", textAlign: "center", paddingHorizontal: 20 },
  recordCard: {
    backgroundColor: "#f2f2f2", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  recordDate: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#6b6b6b", marginBottom: 8 },
  vitalsRow: { flexDirection: "row", justifyContent: "space-between" },
  vital: { alignItems: "center", flex: 1 },
  vitalValue: { fontSize: 18, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000" },
  vitalLabel: { fontSize: 10, color: "#9a9a9a", marginTop: 2 },
  statusBadge: {
    marginTop: 10, alignSelf: "flex-start", backgroundColor: "#000000", color: "#ffffff",
    fontSize: 11, fontFamily: FONT_DEMI, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
});