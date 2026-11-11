import React from "react";
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Droplet, Heart, Thermometer, Trash2, Wind } from "lucide-react-native";
import { Reading } from "../../db/records";
import { useTheme } from "../../context/ThemeContext";
import { VITAL_ORDER, VitalKey, formatValue, isPlausible, subScore, valueOf } from "../../lib/trendData";

const PALETTE = {
  light: {
    card: "#FFFFFF",
    edge: "rgba(0,0,0,0.07)",
    shadow: 0.06,
    text: "#000000",
    muted: "#8E8E93",
    faint: "#C7C7CC",
    sep: "#E5E5EA",
    danger: "#FF3B30",
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
    faint: "#545458",
    sep: "#38383A",
    danger: "#FF453A",
    status: { ok: "#30D158", warn: "#FF9F0A", bad: "#FF453A" },
    statusText: { ok: "#30D158", warn: "#FF9F0A", bad: "#FF453A" },
    vital: { heartRate: "#FF375F", temperature: "#40C8E0", spo2: "#0A84FF", respiratoryRate: "#BF5AF2" },
  },
};
type Level = "ok" | "warn" | "bad";

const ICON = { heartRate: Heart, temperature: Thermometer, spo2: Droplet, respiratoryRate: Wind };
const SHORT: Record<VitalKey, string> = { heartRate: "Heart", temperature: "Temp", spo2: "SpO₂", respiratoryRate: "Resp" };
const UNIT: Record<VitalKey, string> = { heartRate: "bpm", temperature: "°C", spo2: "%", respiratoryRate: "/min" };
const ORDER: Level[] = ["ok", "warn", "bad"];
const levelOf = (score: number): Level => (score === 0 ? "ok" : score === 3 ? "bad" : "warn");

// Shape + colour, so the status still reads for colour-blind users:
// circle-tick = in range, triangle = slightly out, octagon = outside range, grey circle = check values
function StatusGlyph({ kind, color }: { kind: Level | "check"; color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      {kind === "ok" && (
        <>
          <Circle cx={12} cy={12} r={10.5} fill={color} />
          <Path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === "warn" && (
        <>
          <Path d="M12 2.8 22 20.5H2z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M12 9v5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx={12} cy={17.2} r={1.3} fill="#fff" />
        </>
      )}
      {kind === "bad" && (
        <>
          <Path d="M8 1.8h8l6.2 6.2v8L16 22.2H8L1.8 16V8z" fill={color} />
          <Path d="M12 7v6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx={12} cy={16.6} r={1.3} fill="#fff" />
        </>
      )}
      {kind === "check" && (
        <>
          <Circle cx={12} cy={12} r={10.5} fill={color} />
          <Path d="M9.4 9.3a2.7 2.7 0 1 1 3.6 2.6c-.6.3-1 .8-1 1.5v.4" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={12} cy={17} r={1.3} fill="#fff" />
        </>
      )}
    </Svg>
  );
}

type Props = {
  reading: Reading;
  footer?: React.ReactNode; // optional bottom row (used by the Intake day cards)
  onDelete?: () => void; // shows a small delete button next to the status
  style?: StyleProp<ViewStyle>;
};

export default function ReadingCard({ reading, footer, onDelete, style }: Props) {
  const { resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const pal = isDark ? PALETTE.dark : PALETTE.light;

  // per-vital value + level (null level = impossible value)
  const vitals = VITAL_ORDER.map((k) => {
    const v = valueOf(reading, k);
    if (v == null) return { k, v, level: undefined as Level | null | undefined };
    return { k, v, level: isPlausible(k, v) ? levelOf(subScore(k, v)) : null };
  });
  const needsCheck = vitals.some((x) => x.level === null);
  const worst = vitals.reduce<Level>(
    (w, x) => (x.level && ORDER.indexOf(x.level) > ORDER.indexOf(w) ? x.level : w),
    "ok"
  );

  const d = new Date(reading.recordedAt);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const manual = !reading.status;

  const outCount = vitals.filter((x) => x.level === "warn" || x.level === "bad").length;
  const statusKind: Level | "check" = needsCheck ? "check" : worst;
  const statusText = needsCheck
    ? "Check values"
    : worst === "ok"
    ? "All in range"
    : worst === "warn"
    ? `${outCount} slightly out`
    : `${outCount} outside range`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: pal.card,
          borderColor: pal.edge,
          borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
          shadowOpacity: pal.shadow,
          elevation: isDark ? 0 : 1,
        },
        style,
      ]}
    >
      {/* top line */}
      <View style={styles.top}>
        <Text style={[styles.date, { color: pal.text }]} numberOfLines={1}>
          {date}
          <Text style={[styles.time, { color: pal.muted }]}>
            {"  "}
            {time}
            {manual ? " · Manual" : ""}
          </Text>
        </Text>

        <View style={styles.status} accessibilityLabel={statusText}>
          <StatusGlyph kind={statusKind} color={needsCheck ? pal.muted : pal.status[worst]} />
          <Text style={[styles.statusText, { color: needsCheck ? pal.muted : pal.text }]}>{statusText}</Text>
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.trash} accessibilityLabel="Delete reading">
            <Trash2 size={15} color={pal.danger} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {/* vitals */}
      <View style={styles.row}>
        {vitals.map(({ k, v, level }) => {
          const Icon = ICON[k];
          const valueColor =
            v == null || level === null ? pal.faint : level === "ok" ? pal.text : pal.statusText[level as Level];
          return (
            <View key={k} style={styles.vital}>
              <View style={styles.labelRow}>
                <Icon size={12} color={pal.vital[k]} fill={k === "heartRate" ? pal.vital[k] : "none"} strokeWidth={2.6} />
                <Text style={[styles.label, { color: pal.muted }]}>{SHORT[k]}</Text>
              </View>
              <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
                {v == null ? "–" : formatValue(k, v)}
                {v != null && <Text style={[styles.unit, { color: pal.muted }]}> {UNIT[k]}</Text>}
              </Text>
            </View>
          );
        })}
      </View>

      {footer != null && <View style={[styles.footer, { borderTopColor: pal.sep }]}>{footer}</View>}
    </View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  date: { flex: 1, fontSize: 14, fontFamily: FONT_DEMI, fontWeight: "600" },
  time: { fontSize: 13, fontFamily: FONT_MEDIUM, fontWeight: "500" },

  status: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusText: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },
  trash: { marginLeft: 4, padding: 2 },

  row: { flexDirection: "row", marginTop: 12 },
  vital: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: 11, fontFamily: FONT_DEMI, fontWeight: "600" },
  value: { fontSize: 20, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: -0.3, marginTop: 3 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unit: { fontSize: 11, fontFamily: FONT_MEDIUM, fontWeight: "500", letterSpacing: 0 },
});