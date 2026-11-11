import React, { useEffect, useMemo, useRef, useState } from "react";
import MorphingModal, { MorphRect } from "../components/MorphingModal";
import ReadingCard from "../components/ReadingCard";
import MonthPicker from "../components/MonthPicker";
import Pagination from "../components/Pagination";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity, Pressable,
  ScrollView, Alert, NativeSyntheticEvent, NativeScrollEvent, Animated,
} from "react-native";
import { ChevronRight, Filter, Trash2, X } from "lucide-react-native";
import { Reading } from "../../db/records";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

type Props = {
  records: Reading[];
  connected: boolean;
  onDeleteRecord: (id: number) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  topInset?: number; // height of the floating header above the list
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PAGE_SIZE = 10; // day cards per page
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// colours that match ReadingCard
const CARD = {
  light: { card: "#FFFFFF", stack: "#E6E6EB", muted: "#8E8E93", accent: "#007AFF", danger: "#FF3B30" },
  dark: { card: "#1C1C1E", stack: "#2C2C2E", muted: "#8E8E93", accent: "#0A84FF", danger: "#FF453A" },
};

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// One calendar day's readings, newest first
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

export default function IntakeTab({ records, connected, onDeleteRecord, onScroll, topInset = 0 }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const styles = createStyles(colors);
  const c = resolvedScheme === "dark" ? CARD.dark : CARD.light;

  const [filterOpen, setFilterOpen] = useState(false);

  // own scroll position (the filter pill moves with the list) — still reported up to the header
  const listY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: listY } } }], {
    useNativeDriver: false,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => onScroll?.(e),
  });
  const [activeFilter, setActiveFilter] = useState<{ month: number; year: number } | null>(null);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [morphOrigin, setMorphOrigin] = useState<MorphRect | null>(null);
  const cardRefs = useRef<Record<string, View | null>>({});
  const listRef = useRef<any>(null);
  const [page, setPage] = useState(1);

  // first stored reading + months that have data (for the filter)
  const { firstDate, monthsWithData } = useMemo(() => {
    let first = Infinity;
    const set = new Set<string>();
    for (const r of records) {
      const d = new Date(r.recordedAt);
      if (isNaN(d.getTime())) continue;
      first = Math.min(first, d.getTime());
      set.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    return { firstDate: first === Infinity ? new Date() : new Date(first), monthsWithData: set };
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!activeFilter) return records;
    return records.filter((r) => {
      const d = new Date(r.recordedAt);
      return d.getMonth() === activeFilter.month && d.getFullYear() === activeFilter.year;
    });
  }, [records, activeFilter]);

  const dayGroups = useMemo(() => groupByDay(filteredRecords), [filteredRecords]);
  const totalPages = Math.max(1, Math.ceil(dayGroups.length / PAGE_SIZE));
  const pageGroups = useMemo(
    () => dayGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [dayGroups, page]
  );

  // back to page 1 when the filter changes; stay in range if readings get deleted
  useEffect(() => {
    setPage(1);
  }, [activeFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function goToPage(p: number) {
    setPage(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }
  const activeDayGroup = useMemo(
    () => dayGroups.find((g) => g.key === activeDayKey) ?? null,
    [dayGroups, activeDayKey]
  );

  function clearFilter() {
    setActiveFilter(null);
    setFilterOpen(false);
  }

  function confirmDelete(r: Reading) {
    Alert.alert(
      "Delete reading",
      `Remove the reading from ${formatDayLabel(r.recordedAt)} at ${formatTime(r.recordedAt)}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDeleteRecord(r.id) },
      ]
    );
  }

  // if every reading of the open day gets deleted, close the modal
  useEffect(() => {
    if (dayModalOpen && !activeDayGroup) {
      setMorphOrigin(null);
      setDayModalOpen(false);
    }
  }, [dayModalOpen, activeDayGroup]);

  function openDay(group: DayGroup) {
    const show = (rect: MorphRect | null) => {
      setMorphOrigin(rect);
      setActiveDayKey(group.key);
      setDayModalOpen(true);
    };
    const node = cardRefs.current[group.key];
    if (node) node.measureInWindow((x, y, width, height) => show({ x, y, width, height }));
    else show(null);
  }

  function closeDay() {
    setDayModalOpen(false);
  }

  if (records.length === 0) {
    return (
      <View style={[styles.empty, { paddingTop: topInset + 40 }]}>
        <Text style={styles.emptyText}>No analyzed intake yet.</Text>
        <Text style={styles.emptySub}>
          {connected ? "Take a reading from the device to see it here." : "Connect the device and take a reading to see analyzed vitals."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Animated.FlatList
        ref={listRef}
        data={pageGroups}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.list, { paddingTop: topInset }]}
        scrollIndicatorInsets={{ top: topInset }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>
              {activeFilter ? `${MONTHS[activeFilter.month]} ${activeFilter.year}` : "Analyzed intakes"}
            </Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pager}>
              <Pagination page={page} totalPages={totalPages} onChange={goToPage} isDark={resolvedScheme === "dark"} />
              <Text style={[styles.pagerText, { color: c.muted }]}>
                Days {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, dayGroups.length)} of {dayGroups.length}
              </Text>
            </View>
          ) : null
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
          const n = item.readings.length;
          const isStack = n > 1;

          return (
            <View
              ref={(el) => {
                cardRefs.current[item.key] = el;
              }}
              collapsable={false}
              style={[
                styles.dayWrap,
                { marginBottom: n > 2 ? 30 : n > 1 ? 24 : 12 },
                activeDayKey === item.key && { opacity: 0 },
              ]}
            >
              {/* the layers behind the card show there are more readings */}
              {n > 2 && <View style={[styles.layer, styles.layerFar, { backgroundColor: c.stack }]} />}
              {isStack && <View style={[styles.layer, styles.layerNear, { backgroundColor: c.stack }]} />}

              <Pressable
                disabled={!isStack}
                onPress={() => openDay(item)}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityRole={isStack ? "button" : undefined}
                accessibilityLabel={isStack ? `${formatDayLabel(latest.recordedAt)}, ${n} readings. Tap to view all` : undefined}
              >
                <ReadingCard
                  reading={latest}
                  style={styles.dayCard}
                  footer={
                    isStack ? (
                      <>
                        <Text style={[styles.footText, { color: c.muted }]}>{n} readings this day</Text>
                        <View style={styles.footAction}>
                          <Text style={[styles.footLink, { color: c.accent }]}>View all</Text>
                          <ChevronRight size={15} color={c.accent} strokeWidth={2.6} />
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.footText, { color: c.muted }]}>1 reading this day</Text>
                        <Pressable onPress={() => confirmDelete(latest)} hitSlop={8} style={styles.footAction}>
                          <Trash2 size={14} color={c.danger} strokeWidth={2.2} />
                          <Text style={[styles.footLink, { color: c.danger }]}>Delete</Text>
                        </Pressable>
                      </>
                    )
                  }
                />
              </Pressable>
            </View>
          );
        }}
      />

      <MorphingModal
        open={dayModalOpen}
        origin={morphOrigin}
        onRequestClose={closeDay}
        onClosed={() => setActiveDayKey(null)}
        fromColor={c.card}
        toColor={colors.background}
        fromRadius={18}
        toRadius={18}
        backdropColor={colors.modalBackdrop}
        contentStyle={styles.dayModalContent}
      >
        <View style={styles.dayModalHeader}>
          <View>
            <Text style={styles.modalTitle}>
              {activeDayGroup ? formatDayLabel(activeDayGroup.readings[0].recordedAt) : ""}
            </Text>
            <Text style={[styles.modalSub, { color: c.muted }]}>
              {activeDayGroup ? `${activeDayGroup.readings.length} readings` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={closeDay} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
            <X color={colors.text} size={16} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.dayModalList} showsVerticalScrollIndicator={false}>
          {activeDayGroup?.readings.map((r) => (
            <ReadingCard key={r.id} reading={r} onDelete={() => confirmDelete(r)} />
          ))}
        </ScrollView>
      </MorphingModal>

      {/* filter — rides along with the list (so it never sits under the header) */}
      {filterOpen && <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />}
      <Animated.View
        style={[StyleSheet.absoluteFill, { top: topInset, transform: [{ translateY: Animated.multiply(listY, -1) }] }]}
        pointerEvents="box-none"
      >
        <MonthPicker
          year={activeFilter?.year ?? null}
          month={activeFilter?.month ?? null}
          onChange={(year, month) => setActiveFilter({ year, month })}
          onClear={clearFilter}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          firstDate={firstDate}
          monthsWithData={monthsWithData}
          accent={c.accent}
          isDark={resolvedScheme === "dark"}
          label={activeFilter ? `${MONTHS_SHORT[activeFilter.month]} ${activeFilter.year}` : "Filter"}
          leading={<Filter color={activeFilter ? c.accent : colors.text} size={13} strokeWidth={2.4} />}
          style={styles.filter}
        />
      </Animated.View>
    </View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    list: { paddingHorizontal: 20, paddingBottom: 120 },
    empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 30 },
    emptyText: { fontSize: 15, fontFamily: FONT_DEMI, color: colors.text, marginBottom: 6, textAlign: "center" },
    emptySub: { fontSize: 13, color: colors.textFaint, textAlign: "center" },
    filterEmpty: { paddingVertical: 40, alignItems: "center" },
    clearFilterLink: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.text, textDecorationLine: "underline", marginTop: 4 },
    headerRow: {
      height: 32, justifyContent: "center", marginBottom: 12,
    },
    filter: { position: "absolute", top: 0, right: 20 },
    sectionLabel: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.textMuted },

    // day card
    dayWrap: { position: "relative" },
    layer: { position: "absolute", height: 30, borderRadius: 16 },
    layerNear: { left: 10, right: 10, bottom: -7 },
    layerFar: { left: 22, right: 22, bottom: -14, opacity: 0.6 },
    dayCard: { marginBottom: 0 },
    pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
    footText: { fontSize: 13, fontFamily: FONT_MEDIUM, fontWeight: "500" },
    footAction: { flexDirection: "row", alignItems: "center", gap: 3 },
    footLink: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },
    pager: { marginTop: 8, alignItems: "center", gap: 8 },
    pagerText: { fontSize: 12, fontFamily: FONT_MEDIUM },

    // day modal
    modalTitle: { fontSize: 18, fontFamily: FONT_BOLD, fontWeight: "700", color: colors.text },
    modalSub: { fontSize: 13, fontFamily: FONT_MEDIUM, marginTop: 1 },
    closeBtn: {
      width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    dayModalContent: { padding: 16 },
    dayModalHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
    },
    dayModalList: { flexGrow: 0, flexShrink: 1 },
  });
}