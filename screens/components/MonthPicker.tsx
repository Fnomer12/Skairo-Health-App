import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { ChevronDown } from "lucide-react-native";

const COLORS = {
  light: {
    trigger: "#F2F2F5",
    surface: "#FFFFFF",
    border: "rgba(0,0,0,0.08)",
    chip: "#F2F2F5",
    text: "#000000",
    muted: "#8E8E93",
    faint: "#C7C7CC",
  },
  dark: {
    trigger: "#2C2C2E",
    surface: "#2C2C2E",
    border: "rgba(255,255,255,0.10)",
    chip: "#3A3A3C",
    text: "#FFFFFF",
    muted: "#8E8E93",
    faint: "#545458",
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLOSED_H = 32;
const OPEN_W = 236;
const PAD = 8;
const YEAR_H = 30;
const CELL_H = 38;
const ALL_H = 40;

type Props = {
  year: number | null; // null = nothing selected (e.g. "all months")
  month: number | null; // 0–11
  onChange: (year: number, month: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstDate: Date; // first stored reading
  monthsWithData: Set<string>; // "2026-10"
  accent: string;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string; // text on the closed pill (defaults to the month name)
  leading?: React.ReactNode; // icon before the label
  onClear?: () => void; // shows a "Show all months" row at the bottom
};

export default function MonthPicker({
  year,
  month,
  onChange,
  open,
  onOpenChange,
  firstDate,
  monthsWithData,
  accent,
  isDark,
  style,
  label: labelOverride,
  leading,
  onClear,
}: Props) {
  const c = isDark ? COLORS.dark : COLORS.light;
  const today = new Date();
  const hasValue = year != null && month != null;
  const isCurrent = hasValue && year === today.getFullYear() && month === today.getMonth();
  const OPEN_H = PAD + YEAR_H + 8 + 4 * CELL_H + (onClear ? ALL_H : 0) + PAD;
  const firstYear = Math.min(firstDate.getFullYear(), today.getFullYear());
  const years = Array.from({ length: today.getFullYear() - firstYear + 1 }, (_, i) => firstYear + i);

  const [triggerW, setTriggerW] = useState(110);
  const [viewYear, setViewYear] = useState(year ?? today.getFullYear());
  const p = useRef(new Animated.Value(0)).current;
  const yearsRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (open) setViewYear(year ?? today.getFullYear());
    Animated.spring(p, { toValue: open ? 1 : 0, damping: 34, stiffness: 380, mass: 0.8, useNativeDriver: false }).start();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = "clamp" as const;
  const container = {
    width: p.interpolate({ inputRange: [0, 1], outputRange: [triggerW, OPEN_W] }),
    height: p.interpolate({ inputRange: [0, 1], outputRange: [CLOSED_H, OPEN_H] }),
    borderRadius: p.interpolate({ inputRange: [0, 1], outputRange: [CLOSED_H / 2, 16] }),
    backgroundColor: p.interpolate({ inputRange: [0, 1], outputRange: [c.trigger, c.surface] }),
    borderColor: p.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", c.border] }),
    shadowOpacity: p.interpolate({ inputRange: [0, 1], outputRange: [0, isDark ? 0.5 : 0.14], extrapolate: clamp }),
    elevation: p.interpolate({ inputRange: [0, 1], outputRange: [0, 8], extrapolate: clamp }),
  };
  const triggerAnim = {
    opacity: p.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: clamp }),
    transform: [{ scale: p.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0.85], extrapolate: clamp }) }],
  };
  const fadeIn = (start: number) => ({
    opacity: p.interpolate({ inputRange: [start, start + 0.35], outputRange: [0, 1], extrapolate: clamp }),
    transform: [{ translateY: p.interpolate({ inputRange: [start, start + 0.35], outputRange: [-6, 0], extrapolate: clamp }) }],
  });

  const firstKey = firstDate.getFullYear() * 12 + firstDate.getMonth();
  const todayKey = today.getFullYear() * 12 + today.getMonth();

  const label =
    labelOverride ??
    (!hasValue
      ? "All months"
      : isCurrent
      ? new Date(year, month, 1).toLocaleDateString(undefined, { month: "long" })
      : new Date(year, month, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" }));

  return (
    <View pointerEvents="box-none" style={[{ width: OPEN_W, height: OPEN_H }, style]}>
      <Animated.View style={[styles.container, container]}>
        {/* closed — the month pill */}
        <Animated.View pointerEvents={open ? "none" : "auto"} style={[styles.triggerWrap, triggerAnim]}>
          <Pressable
            onPress={() => onOpenChange(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Tap to choose a month`}
          >
            <View style={styles.trigger} onLayout={(e: LayoutChangeEvent) => setTriggerW(Math.ceil(e.nativeEvent.layout.width))}>
              {leading}
              <Text style={[styles.triggerText, { color: c.text }]} numberOfLines={1}>
                {label}
              </Text>
              <ChevronDown size={14} color={c.muted} strokeWidth={2.6} />
            </View>
          </Pressable>
        </Animated.View>

        {/* open — years + months */}
        <View pointerEvents={open ? "auto" : "none"} style={styles.panel}>
          <Animated.View style={fadeIn(0.25)}>
            <ScrollView
              ref={yearsRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.years}
              onContentSizeChange={() => yearsRef.current?.scrollToEnd({ animated: false })}
            >
              {years.map((y) => {
                const on = y === viewYear;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setViewYear(y)}
                    style={[styles.yearChip, { backgroundColor: on ? c.text : c.chip }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.yearText, { color: on ? c.surface : c.muted }]}>{y}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          <View style={styles.grid}>
            {MONTHS.map((m, i) => {
              const key = viewYear * 12 + i;
              const disabled = key < firstKey || key > todayKey;
              const selected = viewYear === year && i === month;
              const hasData = monthsWithData.has(`${viewYear}-${i}`);
              const row = Math.floor(i / 3);
              return (
                <Animated.View key={m} style={[styles.cellWrap, fadeIn(0.3 + row * 0.08)]}>
                  <Pressable
                    disabled={disabled}
                    onPress={() => {
                      onChange(viewYear, i);
                      setTimeout(() => onOpenChange(false), 120);
                    }}
                    style={[styles.cell, selected && { backgroundColor: accent }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={`${m} ${viewYear}`}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        { color: selected ? "#FFFFFF" : disabled ? c.faint : hasData ? c.text : c.muted },
                      ]}
                    >
                      {m}
                    </Text>
                    {hasData && !selected && <View style={[styles.dataDot, { backgroundColor: accent }]} />}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {onClear && (
            <Animated.View style={[styles.allRow, { borderTopColor: c.chip }, fadeIn(0.6)]}>
              <Pressable
                onPress={() => {
                  onClear();
                  setTimeout(() => onOpenChange(false), 120);
                }}
                style={styles.allBtn}
                accessibilityRole="button"
              >
                <Text style={[styles.allText, { color: hasValue ? accent : c.muted }]}>
                  {hasValue ? "Show all months" : "Showing all months"}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  triggerWrap: { position: "absolute", top: 0, right: 0, width: OPEN_W, height: CLOSED_H, alignItems: "flex-end" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 5, height: CLOSED_H, paddingHorizontal: 11 },
  triggerText: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },

  panel: { position: "absolute", top: 0, right: 0, width: OPEN_W, padding: PAD },
  years: { gap: 6, height: YEAR_H, alignItems: "center" },
  yearChip: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  yearText: { fontSize: 13, fontFamily: FONT_BOLD, fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  cellWrap: { width: "33.333%", height: CELL_H, padding: 3 },
  cell: { flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 14, fontFamily: FONT_DEMI, fontWeight: "600" },
  allRow: { height: ALL_H, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  allBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  allText: { fontSize: 14, fontFamily: FONT_DEMI, fontWeight: "600" },
  dataDot: { position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2 },
});