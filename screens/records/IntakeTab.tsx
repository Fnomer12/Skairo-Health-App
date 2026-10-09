import React, { useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Platform, TouchableOpacity,
  Modal, ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent, Animated,
} from "react-native";
import { Trash2, Filter, X, Activity } from "lucide-react-native";
import { Reading } from "../../db/records";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

type IntakeReading = Reading & { respiratoryRate?: number };

type Props = {
  records: Reading[];
  connected: boolean;
  onDeleteRecord: (id: number) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function cardColor(status: string | null): string {
  if (!status) return "#3a3a3a";
  const s = status.toLowerCase();
  if (s.includes("critical") || s.includes("danger")) return "#C62828";
  if (s.includes("warn") || s.includes("elevated")) return "#E08A00";
  return "#1F8A4C";
}

// One calendar day's worth of readings, newest first — this is what turns
// several separate "Reading recorded" cards into a single stacked day card.
type DayGroup = {
  key: string;
  readings: Reading[];
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(records: Reading[]): DayGroup[] {
  const map = new Map<string, Reading[]>();
  for (const r of records) {
    const k = dayKey(r.recordedAt);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const groups: DayGroup[] = Array.from(map.entries()).map(([key, readings]) => ({
    key,
    readings: [...readings].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    ),
  }));
  groups.sort(
    (a, b) => new Date(b.readings[0].recordedAt).getTime() - new Date(a.readings[0].recordedAt).getTime()
  );
  return groups;
}

export default function IntakeTab({ records, connected, onDeleteRecord, onScroll }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const now = new Date();
  const [filterVisible, setFilterVisible] = useState(false);
  const [pendingMonth, setPendingMonth] = useState(now.getMonth());
  const [pendingYear, setPendingYear] = useState(now.getFullYear());
  const [activeFilter, setActiveFilter] = useState<{ month: number; year: number } | null>(null);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i),
    []
  );

  const filteredRecords = useMemo(() => {
    if (!activeFilter) return records;
    return records.filter((r) => {
      const d = new Date(r.recordedAt);
      return d.getMonth() === activeFilter.month && d.getFullYear() === activeFilter.year;
    });
  }, [records, activeFilter]);

  const dayGroups = useMemo(() => groupByDay(filteredRecords), [filteredRecords]);
  const activeDayGroup = useMemo(
    () => dayGroups.find((g) => g.key === activeDayKey) ?? null,
    [dayGroups, activeDayKey]
  );

  function openFilter() {
    setPendingMonth(activeFilter ? activeFilter.month : now.getMonth());
    setPendingYear(activeFilter ? activeFilter.year : now.getFullYear());
    setFilterVisible(true);
  }

  function applyFilter() {
    setActiveFilter({ month: pendingMonth, year: pendingYear });
    setFilterVisible(false);
  }

  function clearFilter() {
    setActiveFilter(null);
    setFilterVisible(false);
  }

  function confirmDelete(id: number, dateLabel: string) {
    Alert.alert(
      "Delete reading",
      `Remove the reading from ${dateLabel}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDeleteRecord(id) },
      ]
    );
  }

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
    <View style={styles.screen}>
      {activeFilter && (
        <View style={styles.activeFilterBanner}>
          <Text style={styles.activeFilterBannerText}>
            Showing {MONTHS[activeFilter.month]} {activeFilter.year}
          </Text>
          <TouchableOpacity onPress={clearFilter} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={colors.accentText} size={14} />
          </TouchableOpacity>
        </View>
      )}

      <Animated.FlatList
        data={dayGroups}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>Analyzed intakes</Text>
            <TouchableOpacity style={styles.filterPill} onPress={openFilter}>
              <Filter color={colors.text} size={13} />
              <Text style={styles.filterPillText}>Filter</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          activeFilter ? (
            <View style={styles.filterEmpty}>
              <Text style={styles.emptyText}>
                No intakes in {MONTHS[activeFilter.month]} {activeFilter.year}.
              </Text>
              <TouchableOpacity onPress={clearFilter}>
                <Text style={styles.clearFilterLink}>Clear filter</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const latest = item.readings[0];
          const rr = (latest as IntakeReading).respiratoryRate;
          const dayLabel = formatDayLabel(latest.recordedAt);
          const timeLabel = formatTime(latest.recordedAt);
          const bg = cardColor(latest.status);
          const extraCount = item.readings.length - 1;
          const isStack = extraCount > 0;

          return (
            <View style={styles.dayStackWrap}>
              {isStack && (
                <View style={[styles.ghostSliver, styles.ghostSliverFar, { backgroundColor: bg }]} />
              )}
              {isStack && (
                <View style={[styles.ghostSliver, styles.ghostSliverNear, { backgroundColor: bg }]} />
              )}

              <TouchableOpacity
                style={[styles.intakeCard, { backgroundColor: bg }]}
                activeOpacity={isStack ? 0.85 : 1}
                disabled={!isStack}
                onPress={() => setActiveDayKey(item.key)}
              >
                <View style={styles.cardIconBleed} pointerEvents="none">
                  <Activity color="rgba(255,255,255,0.16)" size={150} strokeWidth={1.4} />
                </View>

                <View style={styles.cardTopRow}>
                  <Text style={styles.cardDate}>
                    {dayLabel} · {isStack ? `last at ${timeLabel}` : timeLabel}
                  </Text>
                  {isStack ? (
                    <View style={styles.stackBadge}>
                      <Text style={styles.stackBadgeText}>+{extraCount}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => confirmDelete(latest.id, `${dayLabel} · ${timeLabel}`)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={styles.deletePill}
                    >
                      <Trash2 color="#ffffff" size={13} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.cardHeadline} numberOfLines={1}>
                  {latest.status || "Reading recorded"}
                </Text>

                <View style={styles.statChipsRow}>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipValue}>{latest.heartRate}</Text>
                    <Text style={styles.statChipLabel}>bpm</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipValue}>{latest.temperature}</Text>
                    <Text style={styles.statChipLabel}>°C</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipValue}>{latest.spo2}</Text>
                    <Text style={styles.statChipLabel}>SpO2 %</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipValue}>{rr != null ? rr : "–"}</Text>
                    <Text style={styles.statChipLabel}>rpm</Text>
                  </View>
                </View>

                {isStack && (
                  <Text style={styles.stackHint}>
                    Tap to view all {item.readings.length} readings
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={filterVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Filter by month</Text>
            <View style={styles.pickerRow}>
              <ScrollView style={[styles.pickerColumn, styles.pickerColumnWide]} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={styles.pickerItem} onPress={() => setPendingMonth(i)}>
                    <Text style={[styles.pickerItemText, pendingMonth === i && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                {years.map((y) => (
                  <TouchableOpacity key={y} style={styles.pickerItem} onPress={() => setPendingYear(y)}>
                    <Text style={[styles.pickerItemText, pendingYear === y && styles.pickerItemTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={clearFilter}>
                <Text style={styles.cancelText}>All time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={applyFilter}>
                <Text style={styles.saveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeDayGroup}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDayKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dayModalBox}>
            <View style={styles.dayModalHeader}>
              <Text style={styles.modalTitle}>
                {activeDayGroup ? formatDayLabel(activeDayGroup.readings[0].recordedAt) : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveDayKey(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={colors.text} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.dayModalList} showsVerticalScrollIndicator={false}>
              {activeDayGroup?.readings.map((r) => {
                const rr = (r as IntakeReading).respiratoryRate;
                const bg = cardColor(r.status);
                const timeLabel = formatTime(r.recordedAt);
                return (
                  <View key={r.id} style={[styles.dayModalRow, { backgroundColor: bg }]}>
                    <View style={styles.dayModalRowTop}>
                      <Text style={styles.dayModalRowTime}>{timeLabel}</Text>
                      <TouchableOpacity
                        onPress={() =>
                          confirmDelete(r.id, `${formatDayLabel(r.recordedAt)} · ${timeLabel}`)
                        }
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.deletePillSmall}
                      >
                        <Trash2 color="#ffffff" size={12} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dayModalRowHeadline} numberOfLines={1}>
                      {r.status || "Reading recorded"}
                    </Text>
                    <View style={styles.dayModalStatsRow}>
                      <Text style={styles.dayModalStat}>{r.heartRate} bpm</Text>
                      <Text style={styles.dayModalStat}>{r.temperature}°C</Text>
                      <Text style={styles.dayModalStat}>{r.spo2}% SpO2</Text>
                      <Text style={styles.dayModalStat}>{rr != null ? rr : "–"} rpm</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
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
    screen: { flex: 1 },
    activeFilterBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.accent, paddingVertical: 8, marginHorizontal: 20, marginBottom: 12,
      borderRadius: 10,
    },
    activeFilterBannerText: { fontSize: 12, fontFamily: FONT_DEMI, color: colors.accentText },
    list: { paddingHorizontal: 20, paddingBottom: 120 },
    empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 30 },
    emptyText: { fontSize: 15, fontFamily: FONT_DEMI, color: colors.text, marginBottom: 6, textAlign: "center" },
    emptySub: { fontSize: 13, color: colors.textFaint, textAlign: "center" },
    filterEmpty: { paddingVertical: 40, alignItems: "center" },
    clearFilterLink: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.text, textDecorationLine: "underline", marginTop: 4 },
    headerRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
    },
    sectionLabel: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.textMuted },
    filterPill: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    },
    filterPillText: { fontSize: 12, fontFamily: FONT_DEMI, color: colors.text },

    // Each day sits in its own stack wrapper. When a day has more than one
    // reading, two flat "ghost" slivers peek out from behind the bottom
    // edge of the main card — the Apple-Wallet stacked-card look — and the
    // extra margin below gives them room without colliding with the next
    // day's card.
    dayStackWrap: { position: "relative", marginBottom: 22 },
    ghostSliver: {
      position: "absolute",
      height: 20,
      borderRadius: 18,
    },
    ghostSliverNear: { left: 14, right: 14, bottom: -8, opacity: 0.55 },
    ghostSliverFar: { left: 26, right: 26, bottom: -16, opacity: 0.3 },

    intakeCard: {
      position: "relative",
      borderRadius: 22,
      overflow: "hidden",
      padding: 18,
    },
    cardIconBleed: {
      position: "absolute",
      right: -30,
      top: -24,
      transform: [{ rotate: "-12deg" }],
    },
    cardTopRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
    },
    cardDate: { fontSize: 12, fontFamily: FONT_DEMI, color: "rgba(255,255,255,0.85)", letterSpacing: 0.3 },
    deletePill: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center", justifyContent: "center",
    },
    stackBadge: {
      minWidth: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center", justifyContent: "center", paddingHorizontal: 8,
    },
    stackBadgeText: { fontSize: 12, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff" },
    cardHeadline: {
      fontSize: 22, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff", marginBottom: 18,
    },
    statChipsRow: { flexDirection: "row", gap: 8 },
    statChip: {
      flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 14,
      paddingVertical: 10, alignItems: "center",
    },
    statChipValue: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff" },
    statChipLabel: {
      fontSize: 9, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.75)",
      textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2,
    },
    stackHint: {
      marginTop: 12, fontSize: 11, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.7)",
      textAlign: "center",
    },

    modalBackdrop: { flex: 1, backgroundColor: colors.modalBackdrop, justifyContent: "center", alignItems: "center" },
    modalBox: { width: "85%", backgroundColor: colors.background, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: colors.text },
    pickerRow: { flexDirection: "row", height: 180, marginBottom: 12, gap: 6 },
    pickerColumn: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },
    pickerColumnWide: { flex: 1.6 },
    pickerItem: { paddingVertical: 10, alignItems: "center" },
    pickerItemText: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.textFaint },
    pickerItemTextActive: { color: colors.text, fontFamily: FONT_BOLD, fontWeight: "700" },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 10 },
    modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    cancelButton: { backgroundColor: colors.surfaceAlt },
    cancelText: { fontFamily: FONT_DEMI, color: colors.text },
    saveButton: { backgroundColor: colors.accent },
    saveText: { fontFamily: FONT_DEMI, color: colors.accentText },

    // Day-detail modal — opened by tapping a stacked day card, lists every
    // reading from that day with its own delete action.
    dayModalBox: {
      width: "88%", maxHeight: "75%", backgroundColor: colors.background, borderRadius: 18, padding: 18,
    },
    dayModalHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
    },
    dayModalList: { maxHeight: "100%" },
    dayModalRow: { borderRadius: 16, padding: 14, marginBottom: 10 },
    dayModalRowTop: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
    },
    dayModalRowTime: { fontSize: 12, fontFamily: FONT_DEMI, color: "rgba(255,255,255,0.85)" },
    deletePillSmall: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center", justifyContent: "center",
    },
    dayModalRowHeadline: {
      fontSize: 15, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff", marginBottom: 8,
    },
    dayModalStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    dayModalStat: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.85)" },
  });
}