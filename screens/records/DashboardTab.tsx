import React, { useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Platform, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, Animated,
} from "react-native";
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { Reading } from "../../db/records";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

type Props = {
  records: Reading[];
  loading: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

type VitalKey = "heartRate" | "temperature" | "spo2" | "respiratoryRate";

const RECENT_LIMIT = 10;
const CHART_POINTS = 14; // how many of the most recent readings feed the trend line

const VITAL_CONFIG: Record<VitalKey, { shortLabel: string; fullLabel: string; unit: string; decimals: number }> = {
  heartRate: { shortLabel: "HR", fullLabel: "Heart Rate", unit: "BPM", decimals: 0 },
  temperature: { shortLabel: "Temp", fullLabel: "Temperature", unit: "°", decimals: 1 },
  spo2: { shortLabel: "SpO2", fullLabel: "SpO2", unit: "%", decimals: 0 },
  respiratoryRate: { shortLabel: "Resp", fullLabel: "Respiratory Rate", unit: "brpm", decimals: 0 },
};
const VITAL_ORDER: VitalKey[] = ["heartRate", "temperature", "spo2", "respiratoryRate"];

// Chart drawing is done in a fixed logical coordinate space and stretched
// to fill the card's width via the SVG viewBox -- no onLayout measuring needed.
const CHART_W = 300;
const CHART_H = 120;
const CHART_PAD_X = 6;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 10;

function getVitalValue(r: Reading, key: VitalKey): number | null {
  const v = r[key];
  return typeof v === "number" ? v : null;
}

function formatVitalValue(value: number, key: VitalKey): string {
  const { unit, decimals } = VITAL_CONFIG[key];
  return `${value.toFixed(decimals)}${unit === "%" || unit === "°" ? unit : ""}`;
}

function vitalUnitSuffix(key: VitalKey): string {
  const { unit } = VITAL_CONFIG[key];
  return unit === "%" || unit === "°" ? "" : ` ${unit}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

// Builds a smooth-ish SVG path through a series of points using the
// "midpoint quadratic" trick: curve toward the midpoint of each segment
// using the previous point as the control point. No extra charting
// library needed, and it reads as a gentle curve rather than sharp zigzags.
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export default function DashboardTab({ records, loading, onScroll }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [selectedVital, setSelectedVital] = useState<VitalKey>("heartRate");

  const classification = classify(records, loading);
  const recentRecords = useMemo(() => records.slice(0, RECENT_LIMIT), [records]);

  // Chronological (oldest -> newest) series of the selected vital, built
  // from the most recent CHART_POINTS readings, skipping any where that
  // particular vital wasn't captured.
  const chartSeries = useMemo(() => {
    return records
      .slice(0, CHART_POINTS)
      .reverse()
      .map((r) => ({ date: r.recordedAt, value: getVitalValue(r, selectedVital) }))
      .filter((p): p is { date: string; value: number } => p.value != null);
  }, [records, selectedVital]);

  const geometry = useMemo(() => {
    if (chartSeries.length === 0) return null;
    const values = chartSeries.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin || Math.max(rawMax * 0.1, 1);
    const paddedMin = rawMin - range * 0.18;
    const paddedMax = rawMax + range * 0.18;
    const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;
    const innerW = CHART_W - CHART_PAD_X * 2;

    const points = chartSeries.map((p, i) => {
      const x = chartSeries.length > 1 ? CHART_PAD_X + (i / (chartSeries.length - 1)) * innerW : CHART_W / 2;
      const y = CHART_PAD_TOP + (1 - (p.value - paddedMin) / (paddedMax - paddedMin)) * innerH;
      return { x, y, value: p.value, date: p.date };
    });

    const linePath = buildSmoothPath(points);
    const floorY = CHART_H - CHART_PAD_BOTTOM;
    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x} ${floorY} L ${points[0].x} ${floorY} Z`
        : "";

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { points, linePath, areaPath, rawMin, rawMax, avg };
  }, [chartSeries]);

  const latestValue = chartSeries.length ? chartSeries[chartSeries.length - 1].value : null;
  const previousValue = chartSeries.length > 1 ? chartSeries[chartSeries.length - 2].value : null;
  const delta = latestValue != null && previousValue != null ? latestValue - previousValue : null;
  const epsilon = selectedVital === "temperature" ? 0.1 : 0.5;
  const trendDirection: "up" | "down" | "flat" | null =
    delta == null ? null : delta > epsilon ? "up" : delta < -epsilon ? "down" : "flat";
  const vitalConfig = VITAL_CONFIG[selectedVital];
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Minus;

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
              <Text style={styles.summaryTitle}>Trends</Text>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{classification.label}</Text>
              </View>
            </View>

            <View style={styles.vitalPickerRow}>
              {VITAL_ORDER.map((key) => {
                const active = key === selectedVital;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.vitalPill, active && styles.vitalPillActive]}
                    activeOpacity={0.75}
                    onPress={() => setSelectedVital(key)}
                  >
                    <Text style={[styles.vitalPillText, active && styles.vitalPillTextActive]}>
                      {VITAL_CONFIG[key].shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {latestValue != null ? (
              <View style={styles.currentValueRow}>
                <Text style={styles.currentValueNumber}>
                  {latestValue.toFixed(vitalConfig.decimals)}
                  <Text style={styles.currentValueUnit}>{vitalUnitSuffix(selectedVital) || ` ${vitalConfig.unit}`}</Text>
                </Text>
                {trendDirection && delta != null && (
                  <View style={styles.trendChip}>
                    <TrendIcon color="#ffffff" size={12} strokeWidth={2.5} />
                    {trendDirection !== "flat" && (
                      <Text style={styles.trendChipText}>
                        {Math.abs(delta).toFixed(vitalConfig.decimals)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.noVitalData}>No {vitalConfig.fullLabel.toLowerCase()} readings yet</Text>
            )}

            {geometry && chartSeries.length > 1 ? (
              <>
                <View style={styles.chartWrap}>
                  <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#ffffff" stopOpacity={0.32} />
                        <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Line
                      x1={CHART_PAD_X} y1={CHART_PAD_TOP}
                      x2={CHART_W - CHART_PAD_X} y2={CHART_PAD_TOP}
                      stroke="rgba(255,255,255,0.14)" strokeWidth={1}
                    />
                    <Line
                      x1={CHART_PAD_X} y1={CHART_H - CHART_PAD_BOTTOM}
                      x2={CHART_W - CHART_PAD_X} y2={CHART_H - CHART_PAD_BOTTOM}
                      stroke="rgba(255,255,255,0.14)" strokeWidth={1}
                    />
                    <Path d={geometry.areaPath} fill="url(#areaFill)" stroke="none" />
                    <Path
                      d={geometry.linePath}
                      stroke="#ffffff" strokeWidth={2.5} fill="none"
                      strokeLinecap="round" strokeLinejoin="round"
                    />
                    {geometry.points.map((pt, i) => {
                      const isLast = i === geometry.points.length - 1;
                      return (
                        <Circle
                          key={i}
                          cx={pt.x} cy={pt.y}
                          r={isLast ? 4.5 : 2.5}
                          fill={isLast ? "#ffffff" : "rgba(255,255,255,0.6)"}
                        />
                      );
                    })}
                  </Svg>
                </View>

                <View style={styles.chartAxisRow}>
                  <Text style={styles.chartAxisLabel}>{formatShortDate(chartSeries[0].date)}</Text>
                  <Text style={styles.chartAxisLabel}>{formatShortDate(chartSeries[chartSeries.length - 1].date)}</Text>
                </View>

                <View style={styles.chartStatsRow}>
                  <View style={styles.chartStatItem}>
                    <Text style={styles.chartStatLabel}>Low</Text>
                    <Text style={styles.chartStatValue}>{formatVitalValue(geometry.rawMin, selectedVital)}</Text>
                  </View>
                  <View style={styles.chartStatDivider} />
                  <View style={styles.chartStatItem}>
                    <Text style={styles.chartStatLabel}>Avg</Text>
                    <Text style={styles.chartStatValue}>{formatVitalValue(geometry.avg, selectedVital)}</Text>
                  </View>
                  <View style={styles.chartStatDivider} />
                  <View style={styles.chartStatItem}>
                    <Text style={styles.chartStatLabel}>High</Text>
                    <Text style={styles.chartStatValue}>{formatVitalValue(geometry.rawMax, selectedVital)}</Text>
                  </View>
                </View>
              </>
            ) : chartSeries.length === 1 ? (
              <Text style={styles.chartHint}>Add another reading to start seeing a trend</Text>
            ) : null}
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
        const rr = item.respiratoryRate;
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

    vitalPickerRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    vitalPill: {
      paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    vitalPillActive: { backgroundColor: "#ffffff" },
    vitalPillText: { fontSize: 12, fontFamily: FONT_DEMI, color: "rgba(255,255,255,0.75)" },
    vitalPillTextActive: { color: "#1a1a1a" },

    currentValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 16 },
    currentValueNumber: { fontSize: 34, fontFamily: FONT_BOLD, fontWeight: "700", color: "#ffffff", lineHeight: 38 },
    currentValueUnit: { fontSize: 14, fontFamily: FONT_DEMI, color: "rgba(255,255,255,0.8)" },
    trendChip: {
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12,
      paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6,
    },
    trendChipText: { fontSize: 11, fontFamily: FONT_DEMI, color: "#ffffff" },
    noVitalData: { fontSize: 13, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.7)", marginTop: 16 },

    chartWrap: { marginTop: 14, height: 120 },
    chartAxisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
    chartAxisLabel: { fontSize: 10, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.55)" },
    chartHint: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.65)", marginTop: 14 },

    chartStatsRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-around",
      marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)",
    },
    chartStatItem: { alignItems: "center", flex: 1 },
    chartStatDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.16)" },
    chartStatLabel: { fontSize: 10, fontFamily: FONT_MEDIUM, color: "rgba(255,255,255,0.6)", marginBottom: 2 },
    chartStatValue: { fontSize: 14, fontFamily: FONT_DEMI, color: "#ffffff" },

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
