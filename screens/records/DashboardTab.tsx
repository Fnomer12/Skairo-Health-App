import React, { useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Platform, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, Animated,
} from "react-native";
import { Activity } from "lucide-react-native";
import { Reading } from "../../db/records";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

type DashboardReading = Reading & { respiratoryRate?: number };

type Props = {
  records: Reading[];
  loading: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MAX_BAR_HEIGHT = 72;
const RECENT_LIMIT = 10;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function cardColor(status: string | null): string {
  if (!status) return "#3a3a3a";
  const s = status.toLowerCase();
  if (s.includes("critical") || s.includes("danger")) return "#C62828";
  if (s.includes("warn") || s.includes("elevated")) return "#E08A00";
  return "#1F8A4C";
}

function classify(records: Reading[], loading: boolean): { label: string; color: string } {
  if (loading) return { label: "Loading…", color: "#3a3a3a" };
  if (records.length === 0) return { label: "No data yet", color: "#3a3a3a" };
  return { label: statusLabel(records[0].status), color: cardColor(records[0].status) };
}

function statusLabel(status: string | null): string {
  if (!status) return "No data yet";
  const s = status.toLowerCase();
  if (s.includes("critical") || s.includes("danger")) return "Needs attention";
  if (s.includes("warn") || s.includes("elevated")) return "Slightly elevated";
  return "Normal range";
}

export default function DashboardTab({ records, loading, onScroll }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const monthlyCounts = useMemo(() => {
    const counts = new Array(12).fill(0);
    const thisYear = now.getFullYear();
    records.forEach((r) => {
      const d = new Date(r.recordedAt);
      if (d.getFullYear() === thisYear) counts[d.getMonth()] += 1;
    });
    return counts;
  }, [records]);

  const maxCount = Math.max(1, ...monthlyCounts);
  const classification = classify(records, loading);
  const recentRecords = useMemo(() => records.slice(0, RECENT_LIMIT), [records]);
  const selectedCount = monthlyCounts[selectedMonth];
  const isCurrentMonth = selectedMonth === now.getMonth();

  return (
    <Animated.FlatList
      data={recentRecords}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={
        <View>
          <View style={[styles.summaryCard, { backgroundColor: classification.color }]}>
            <View style={styles.cardIconBleedLarge} pointerEvents="none">
              <Activity color="rgba(255,255,255,0.14)" size={190} strokeWidth={1.2} />
            </View>

            <View style={styles.summaryTopRow}>
              <Text style={styles.summaryTitle}>This year</Text>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{classification.label}</Text>
              </View>
            </View>

            <View style={styles.chartRow}>
              {monthlyCounts.map((count, i) => {
                const hasData = count > 0;
                const isSelected = i === selectedMonth;
                const barHeight = hasData
                  ? Math.max((count / maxCount) * MAX_BAR_HEIGHT, 8)
                  : 4;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.chartColumn}
                    activeOpacity={0.6}
                    onPress={() => setSelectedMonth(i)}
                    hitSlop={{ top: 8, bottom: 8 }}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: isSelected ? "#ffffff" : hasData ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.16)",
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.monthLabel, isSelected && styles.monthLabelActive]}>
                      {MONTH_LABELS[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.selectedDetail}>
              {MONTH_NAMES[selectedMonth]}{isCurrentMonth ? " (this month)" : ""} · {selectedCount} reading{selectedCount === 1 ? "" : "s"}
            </Text>
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
        const bg = cardColor(item.status);
        return (
          <View style={[styles.recordCard, { backgroundColor: bg }]}>
            <View style={styles.cardIconBleedSmall} pointerEvents="none">
              <Activity color="rgba(255,255,255,0.16)" size={120} strokeWidth={1.4} />
            </View>

            <View style={styles.recordTopRow}>
              <Text style={styles.recordDate}>{formatDate(item.recordedAt)}</Text>
              {item.status && (
                <View style={styles.recordStatusPill}>
                  <Text style={styles.recordStatusPillText}>{item.status}</Text>
                </View>
              )}
            </View>

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
          </View>
        );
      }}
    />
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { paddingHorizontal: 20, paddingBottom: 120 },

    summaryCard: {
      position: "relative", borderRadius: 22, overflow: "hidden", padding: 20, marginBottom: 18,
    },
    cardIconBleedLarge: { position: "absolute", right: -36, top: -30, transform: [{ rotate: "-12deg" }] },
    cardIconBleedSmall: { position: "absolute", right: -26, top: -20, transform: [{ rotate: "-12deg" }] },

    summaryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    summaryTitle: { fontSize: 15, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff" },
    classBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    classBadgeText: { fontSize: 11, fontFamily: FONT_DEMI, color: "#ffffff" },

    chartRow: {
      flexDirection: "row", alignItems: "flex-end", marginTop: 22, height: MAX_BAR_HEIGHT + 24,
    },
    chartColumn: { flex: 1, alignItems: "center" },
    barTrack: {
      width: 14, height: MAX_BAR_HEIGHT, borderRadius: 7,
      backgroundColor: "rgba(255,255,255,0.14)", justifyContent: "flex-end", overflow: "hidden",
    },
    bar: { width: 14, borderRadius: 7 },
    monthLabel: { fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 8, fontFamily: FONT_MEDIUM },
    monthLabelActive: { color: "#ffffff", fontFamily: FONT_BOLD, fontWeight: "700" },
    selectedDetail: {
      fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: FONT_MEDIUM, marginTop: 14, textAlign: "center",
    },

    recentHeading: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.textMuted, marginBottom: 12 },

    empty: { paddingVertical: 40, alignItems: "center" },
    emptyText: { fontSize: 15, fontFamily: FONT_DEMI, color: colors.text, marginBottom: 4 },
    emptySub: { fontSize: 13, color: colors.textFaint, textAlign: "center", paddingHorizontal: 20 },

    recordCard: {
      position: "relative", borderRadius: 20, overflow: "hidden", padding: 16, marginBottom: 12,
    },
    recordTopRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
    },
    recordDate: { fontSize: 12, fontFamily: FONT_DEMI, color: "rgba(255,255,255,0.85)" },
    recordStatusPill: {
      backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    },
    recordStatusPillText: { fontSize: 10, fontFamily: FONT_DEMI, color: "#ffffff" },

    vitalsRow: { flexDirection: "row", justifyContent: "space-between" },
    vital: { alignItems: "center", flex: 1 },
    vitalValue: { fontSize: 18, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff" },
    vitalLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2, fontFamily: FONT_MEDIUM },
  });
}