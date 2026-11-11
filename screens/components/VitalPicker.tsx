import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { ChevronDown, Droplet, Heart, Thermometer, Wind } from "lucide-react-native";
import { VITAL_ORDER, VitalKey } from "../../lib/trendData";

export const VITAL_ICON = { heartRate: Heart, temperature: Thermometer, spo2: Droplet, respiratoryRate: Wind };
export const VITAL_NAME: Record<VitalKey, string> = {
  heartRate: "Heart Rate",
  temperature: "Temperature",
  spo2: "Blood Oxygen",
  respiratoryRate: "Respiratory Rate",
};

const COLORS = {
  light: {
    trigger: "#F2F2F5",
    surface: "#FFFFFF",
    border: "rgba(0,0,0,0.08)",
    highlight: "#F2F2F5",
    text: "#000000",
    muted: "#8E8E93",
  },
  dark: {
    trigger: "#2C2C2E",
    surface: "#2C2C2E",
    border: "rgba(255,255,255,0.10)",
    highlight: "#3A3A3C",
    text: "#FFFFFF",
    muted: "#8E8E93",
  },
};

const CLOSED_H = 32;
const OPEN_W = 220;
const ITEM_H = 40;
const PAD = 6;
const OPEN_H = PAD * 2 + VITAL_ORDER.length * ITEM_H;

type Props = {
  value: VitalKey;
  onChange: (v: VitalKey) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  vitalColors: Record<VitalKey, string>;
  style?: StyleProp<ViewStyle>;
};

export default function VitalPicker({ value, onChange, open, onOpenChange, isDark, vitalColors, style }: Props) {
  const c = isDark ? COLORS.dark : COLORS.light;
  const [triggerW, setTriggerW] = useState(150);
  const selectedIndex = VITAL_ORDER.indexOf(value);
  const [focus, setFocus] = useState(selectedIndex);

  // 0 = closed button, 1 = open menu
  const p = useRef(new Animated.Value(0)).current;
  // sliding highlight position
  const y = useRef(new Animated.Value(selectedIndex * ITEM_H)).current;

  useEffect(() => {
    Animated.spring(p, { toValue: open ? 1 : 0, damping: 34, stiffness: 380, mass: 0.8, useNativeDriver: false }).start();
    if (open) {
      setFocus(selectedIndex);
      y.setValue(selectedIndex * ITEM_H);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.spring(y, { toValue: focus * ITEM_H, damping: 30, stiffness: 520, mass: 0.8, useNativeDriver: true }).start();
  }, [focus, y]);

  const clamp = "clamp" as const;
  const container = {
    width: p.interpolate({ inputRange: [0, 1], outputRange: [triggerW, OPEN_W] }),
    height: p.interpolate({ inputRange: [0, 1], outputRange: [CLOSED_H, OPEN_H] }),
    borderRadius: p.interpolate({ inputRange: [0, 1], outputRange: [CLOSED_H / 2, 14] }),
    backgroundColor: p.interpolate({ inputRange: [0, 1], outputRange: [c.trigger, c.surface] }),
    borderColor: p.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", c.border] }),
    shadowOpacity: p.interpolate({ inputRange: [0, 1], outputRange: [0, isDark ? 0.5 : 0.14], extrapolate: clamp }),
    elevation: p.interpolate({ inputRange: [0, 1], outputRange: [0, 8], extrapolate: clamp }),
  };
  const triggerAnim = {
    opacity: p.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: clamp }),
    transform: [{ scale: p.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0.85], extrapolate: clamp }) }],
  };
  const menuOpacity = p.interpolate({ inputRange: [0.25, 0.9], outputRange: [0, 1], extrapolate: clamp });

  const select = (k: VitalKey, i: number) => {
    setFocus(i);
    onChange(k);
    setTimeout(() => onOpenChange(false), 140); // let the highlight land first
  };

  const Icon = VITAL_ICON[value];
  const color = vitalColors[value];

  return (
    <View pointerEvents="box-none" style={[{ width: OPEN_W, height: OPEN_H }, style]}>
      <Animated.View style={[styles.container, container]}>
        {/* closed state — the title button */}
        <Animated.View pointerEvents={open ? "none" : "auto"} style={[styles.triggerWrap, triggerAnim]}>
          <Pressable
            onPress={() => onOpenChange(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${VITAL_NAME[value]}. Tap to choose another vital sign`}
          >
            <View style={styles.trigger} onLayout={(e: LayoutChangeEvent) => setTriggerW(Math.ceil(e.nativeEvent.layout.width))}>
              <Icon size={15} color={color} fill={value === "heartRate" ? color : "none"} strokeWidth={2.4} />
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {VITAL_NAME[value]}
              </Text>
              <ChevronDown size={14} color={c.muted} strokeWidth={2.6} />
            </View>
          </Pressable>
        </Animated.View>

        {/* open state — the menu */}
        <Animated.View pointerEvents={open ? "auto" : "none"} style={[styles.menu, { opacity: menuOpacity }]}>
          <Animated.View
            style={[styles.highlight, { backgroundColor: c.highlight, transform: [{ translateY: y }] }]}
            pointerEvents="none"
          >
            <View style={[styles.bar, { backgroundColor: vitalColors[VITAL_ORDER[focus] ?? value] }]} />
          </Animated.View>

          {VITAL_ORDER.map((k, i) => {
            const KIcon = VITAL_ICON[k];
            const start = 0.25 + i * 0.08;
            const itemAnim = {
              opacity: p.interpolate({ inputRange: [start, start + 0.35], outputRange: [0, 1], extrapolate: clamp }),
              transform: [
                { translateX: p.interpolate({ inputRange: [start, start + 0.35], outputRange: [8, 0], extrapolate: clamp }) },
              ],
            };
            const active = i === focus;
            return (
              <Pressable
                key={k}
                onPressIn={() => setFocus(i)}
                onPress={() => select(k, i)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: k === value }}
              >
                <Animated.View style={[styles.item, itemAnim]}>
                  <KIcon size={17} color={vitalColors[k]} fill={k === "heartRate" ? vitalColors[k] : "none"} strokeWidth={2.3} />
                  <Text style={[styles.itemText, { color: active ? c.text : c.muted }]}>{VITAL_NAME[k]}</Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </Animated.View>
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
    left: 0,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  triggerWrap: { position: "absolute", top: 0, left: 0, width: OPEN_W, height: CLOSED_H },
  trigger: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, height: CLOSED_H, paddingHorizontal: 11 },
  title: { fontSize: 15, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: -0.2 },

  menu: { position: "absolute", top: 0, left: 0, width: OPEN_W, padding: PAD },
  highlight: { position: "absolute", top: PAD, left: PAD, right: PAD, height: ITEM_H, borderRadius: 10 },
  bar: { position: "absolute", left: 0, top: (ITEM_H - 20) / 2, width: 3, height: 20, borderRadius: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 11, height: ITEM_H, paddingLeft: 14 },
  itemText: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600" },
});