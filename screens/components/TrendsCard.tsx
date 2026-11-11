import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Reading } from "../../db/records";
import { useTheme } from "../../context/ThemeContext";
import VitalPicker from "./VitalPicker";
import MonthPicker from "./MonthPicker";
import { VitalKey, formatValue, readingLooksImplausible, subScore, valueOf } from "../../lib/trendData";

// ---------------------------------------------------------------------------
// Palette — Apple system colours for white (light) and black (dark)
// ---------------------------------------------------------------------------
const PALETTE = {
  light: {
    card: "#FFFFFF",
    edge: "rgba(0,0,0,0.07)",
    shadow: 0.08,
    text: "#000000",
    muted: "#8E8E93",
    faint: "#C7C7CC",
    sep: "#E5E5EA",
    status: { ok: "#34C759", warn: "#FF9500", bad: "#FF3B30" },
    statusText: { ok: "#248A3D", warn: "#C93400", bad: "#D70015" },
    vital: { heartRate: "#FF2D55", temperature: "#0C8FA6", spo2: "#007AFF", respiratoryRate: "#AF52DE" },
  },
  dark: {
    card: "#1C1C1E",
    edge: "transparent",
    shadow: 0,
    text: "#FFFFFF",
    muted: "#8E8E93",
    faint: "#48484A",
    sep: "#38383A",
    status: { ok: "#30D158", warn: "#FF9F0A", bad: "#FF453A" },
    statusText: { ok: "#30D158", warn: "#FF9F0A", bad: "#FF453A" },
    vital: { heartRate: "#FF375F", temperature: "#40C8E0", spo2: "#0A84FF", respiratoryRate: "#BF5AF2" },
  },
};
type Level = "ok" | "warn" | "bad";

const UNIT: Record<VitalKey, string> = { heartRate: "BPM", temperature: "°C", spo2: "%", respiratoryRate: "BR/MIN" };
const LEVEL_LABEL: Record<Level, string> = { ok: "Normal", warn: "Slightly out", bad: "Out of range" };
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const ORDER: Level[] = ["ok", "warn", "bad"];

const levelOf = (score: number): Level => (score === 0 ? "ok" : score === 3 ? "bad" : "warn");
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

type DayInfo = {
  level: Level | null; // worst level of the valid readings (null = none valid)
  latest: { value: number; level: Level } | null; // newest valid reading
  valid: number;
  invalid: number; // readings with impossible values (e.g. 56 °C)
};

// ---------------------------------------------------------------------------

type Props = { records: Reading[]; loading?: boolean };

export default function TrendsCard({ records }: Props) {
  const { resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const pal = isDark ? PALETTE.dark : PALETTE.light;

  const today = new Date();
  const [vital, setVital] = useState<VitalKey>("heartRate");
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string>(dayKey(today));
  const [menuOpen, setMenuOpen] = useState<"vital" | "month" | null>(null);
  const [gridW, setGridW] = useState(0);

  const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (monthStart.getDay() + 6) % 7; // Monday first

  // first stored reading + which months have data (for the month picker)
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

  // one entry per day that has any reading this month
  const days = useMemo(() => {
    const map = new Map<string, DayInfo & { latestT: number }>();
    for (const r of records) {
      const d = new Date(r.recordedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const v = valueOf(r, vital);
      if (v == null) continue;
      const k = dayKey(d);
      const info = map.get(k) ?? { level: null, latest: null, valid: 0, invalid: 0, latestT: -Infinity };
      if (readingLooksImplausible(r)) {
        info.invalid++;
      } else {
        const level = levelOf(subScore(vital, v));
        info.valid++;
        info.level = info.level == null || ORDER.indexOf(level) > ORDER.indexOf(info.level) ? level : info.level;
        if (d.getTime() > info.latestT) {
          info.latestT = d.getTime();
          info.latest = { value: v, level };
        }
      }
      map.set(k, info);
    }
    return map;
  }, [records, vital, year, month]);

  const cell = gridW > 0 ? gridW / 7 : 0;
  const dot = Math.min(28, Math.floor(cell) - 10);

  const sel = days.get(selected);
  const selDate = (() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m, d);
  })();

  const pickMonth = (y: number, m: number) => {
    const next = (y - today.getFullYear()) * 12 + (m - today.getMonth());
    setMonthOffset(next);
    setSelected(dayKey(next === 0 ? today : new Date(y, m, 1)));
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: pal.card,
          borderColor: pal.edge,
          borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
          shadowOpacity: pal.shadow,
          elevation: isDark ? 0 : 2,
        },
      ]}
    >
      {/* header — both pickers float over it */}
      <View style={styles.header} />

      {/* calendar */}
      <View style={styles.calendar} onLayout={(e: LayoutChangeEvent) => setGridW(e.nativeEvent.layout.width)}>
        {cell > 0 && (
          <>
            <View style={styles.grid}>
              {WEEKDAYS.map((d, i) => (
                <Text key={`w${i}`} style={[styles.weekday, { width: cell, color: pal.muted }]}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {Array.from({ length: lead }).map((_, i) => (
                <View key={`l${i}`} style={{ width: cell, height: dot + 10 }} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const date = new Date(year, month, i + 1);
                const k = dayKey(date);
                const info = days.get(k);
                const isToday = k === dayKey(today);
                const isFuture = date > today && !isToday;
                const isSelected = k === selected;
                const level = info?.level ?? null;
                const onlyInvalid = !!info && info.valid === 0 && info.invalid > 0;
                return (
                  <Pressable
                    key={k}
                    disabled={isFuture}
                    onPress={() => setSelected(k)}
                    style={[styles.cell, { width: cell, height: dot + 10 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isFuture }}
                    accessibilityLabel={`${date.toDateString()}${level ? `, ${LEVEL_LABEL[level]}` : ""}`}
                  >
                    <View
                      style={[
                        styles.ring,
                        {
                          width: dot + 7,
                          height: dot + 7,
                          borderRadius: (dot + 7) / 2,
                          borderColor: isSelected ? pal.text : "transparent",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dot,
                          { width: dot, height: dot, borderRadius: dot / 2 },
                          level && { backgroundColor: pal.status[level] },
                          onlyInvalid && { borderWidth: 1.5, borderStyle: "dashed", borderColor: pal.muted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNum,
                            { color: level ? "#FFFFFF" : isFuture ? pal.faint : pal.muted },
                            isToday && !level && { color: pal.text, fontWeight: "800" },
                          ]}
                        >
                          {i + 1}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* selected day — one line */}
      <View style={[styles.footer, { borderTopColor: pal.sep }]}>
        <Text style={[styles.footDate, { color: pal.text }]}>
          {selDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </Text>
        {sel?.latest ? (
          <Text style={[styles.footMeta, { color: pal.muted }]}>
            <Text style={[styles.footValue, { color: pal.text }]}>{formatValue(vital, sel.latest.value)}</Text> {UNIT[vital]}
            {"  "}
            <Text style={[styles.footStatus, { color: pal.statusText[sel.latest.level] }]}>{LEVEL_LABEL[sel.latest.level]}</Text>
          </Text>
        ) : sel && sel.invalid > 0 ? (
          <Text style={[styles.footMeta, { color: pal.muted }]}>
            {sel.invalid} reading{sel.invalid === 1 ? "" : "s"} need{sel.invalid === 1 ? "s" : ""} checking
          </Text>
        ) : (
          <Text style={[styles.footMeta, { color: pal.muted }]}>No reading</Text>
        )}
      </View>

      {/* tap anywhere on the card to close an open menu */}
      {menuOpen && <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(null)} />}

      <MonthPicker
        year={year}
        month={month}
        onChange={pickMonth}
        open={menuOpen === "month"}
        onOpenChange={(o) => setMenuOpen(o ? "month" : null)}
        firstDate={firstDate}
        monthsWithData={monthsWithData}
        accent={pal.vital[vital]}
        isDark={isDark}
        style={[styles.monthPicker, menuOpen === "month" && styles.onTop]}
      />

      <VitalPicker
        value={vital}
        onChange={setVital}
        open={menuOpen === "vital"}
        onOpenChange={(o) => setMenuOpen(o ? "vital" : null)}
        isDark={isDark}
        vitalColors={pal.vital}
        style={[styles.picker, menuOpen === "vital" && styles.onTop]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  header: { height: 32 },
  picker: { position: "absolute", top: 14, left: 14 },
  monthPicker: { position: "absolute", top: 14, right: 14 },
  onTop: { zIndex: 2, elevation: 9 },

  calendar: { marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { fontSize: 10, textAlign: "center", marginBottom: 4, fontFamily: FONT_DEMI, fontWeight: "600" },
  cell: { alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dot: { alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 12, fontFamily: FONT_DEMI, fontWeight: "600" },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footDate: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },
  footMeta: { fontSize: 12, fontFamily: FONT_MEDIUM },
  footValue: { fontSize: 15, fontFamily: FONT_BOLD, fontWeight: "700" },
  footStatus: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },
});