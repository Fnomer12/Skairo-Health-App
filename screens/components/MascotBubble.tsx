import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

export type MascotPose =
  | "happy" // all good
  | "encouraging" // thumbs up
  | "concerned" // a little off
  | "serious" // important message
  | "thinking" // scratching head — manual / unusual reading
  | "celebrating" // arms up — good streak
  | "sleepy" // yawning — no reading for a few days
  | "measuring" // stethoscope — first reading
  | "alert" // hands on cheeks — High
  | "hydrating" // glass of water — slightly warm / water tip
  | "active" // mid-stride — heart rate up
  | "calm" // eyes closed — breathing fast
  | "feverish"; // thermometer — fever

const POSES: Record<MascotPose, any> = {
  happy: require("../../assets/mascot/pulse-happy.png"),
  encouraging: require("../../assets/mascot/pulse-encouraging.png"),
  concerned: require("../../assets/mascot/pulse-concerned.png"),
  serious: require("../../assets/mascot/pulse-serious.png"),
  thinking: require("../../assets/mascot/pulse-thinking.png"),
  celebrating: require("../../assets/mascot/pulse-celebrating.png"),
  sleepy: require("../../assets/mascot/pulse-sleepy.png"),
  measuring: require("../../assets/mascot/pulse-measuring.png"),
  alert: require("../../assets/mascot/pulse-alert.png"),
  hydrating: require("../../assets/mascot/pulse-hydrating.png"),
  active: require("../../assets/mascot/pulse-active.png"),
  calm: require("../../assets/mascot/pulse-calm.png"),
  feverish: require("../../assets/mascot/pulse-feverish.png"),
};

export function poseForStatus(status: string | null | undefined): MascotPose | null {
  if (!status) return "thinking";
  const s = status.toLowerCase();
  if (s.includes("critical")) return null;
  if (s.includes("high")) return "alert";
  if (s.includes("warn") || s.includes("elevated")) return "concerned";
  return "happy";
}

type Props = {
  pose: MascotPose;
  message: string;
  size?: number;
};

// Each pose has its own little looping "scene" (with a rest between loops so it never feels busy).
function useIdleAnimation(pose: MascotPose, reduceMotion: boolean) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    if (reduceMotion) return;

    const SCENE: Record<MascotPose, { duration: number; rest: number } | null> = {
      happy: { duration: 900, rest: 2600 },
      encouraging: { duration: 700, rest: 2800 },
      concerned: { duration: 2400, rest: 600 },
      serious: null, // stays still — serious message, calm mascot
      thinking: { duration: 1100, rest: 1800 },
      celebrating: { duration: 800, rest: 1400 },
      sleepy: { duration: 3200, rest: 400 },
      measuring: { duration: 1000, rest: 300 },
      alert: { duration: 500, rest: 2500 },
      hydrating: { duration: 1200, rest: 2400 },
      active: { duration: 600, rest: 200 },
      calm: { duration: 4000, rest: 0 },
      feverish: { duration: 700, rest: 2200 },
    };
    const scene = SCENE[pose];
    if (!scene) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: scene.duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(scene.rest),
      ])
    );
    const start = setTimeout(() => loop.start(), 450); // after the pop-in
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [pose, reduceMotion, t]);

  // transforms per pose
  const r = (out: string[], inp?: number[]) =>
    t.interpolate({ inputRange: inp ?? out.map((_, i) => i / (out.length - 1)), outputRange: out });
  const n = (out: number[], inp?: number[]) =>
    t.interpolate({ inputRange: inp ?? out.map((_, i) => i / (out.length - 1)), outputRange: out });

  switch (pose) {
    case "happy": // little hop
      return [{ translateY: n([0, -6, 0, -3, 0]) }];
    case "encouraging": // thumbs-up pump (tilt forward and back)
      return [{ rotate: r(["0deg", "-6deg", "3deg", "0deg"]) }];
    case "concerned": // slow worried sway
      return [{ rotate: r(["0deg", "-3deg", "0deg", "3deg", "0deg"]) }];
    case "thinking": // scratching: quick small rocks, then a head tilt
      return [
        { rotate: r(["0deg", "-4deg", "-1deg", "-4deg", "-1deg", "-4deg", "0deg"]) },
        { translateX: n([0, -1, 0, -1, 0, -1, 0]) },
      ];
    case "celebrating": // jump with squash & stretch
      return [
        { translateY: n([0, 2, -14, -14, 0, 0], [0, 0.12, 0.42, 0.55, 0.85, 1]) },
        { scaleY: n([1, 0.88, 1.08, 1, 0.9, 1], [0, 0.12, 0.42, 0.55, 0.85, 1]) },
        { scaleX: n([1, 1.1, 0.95, 1, 1.08, 1], [0, 0.12, 0.42, 0.55, 0.85, 1]) },
      ];
    case "sleepy": // slow breathing + head droop
      return [
        { scale: n([1, 1.04, 1]) },
        { rotate: r(["0deg", "4deg", "0deg"]) },
      ];
    case "measuring": // heartbeat: lub-dub
      return [{ scale: n([1, 1.07, 1, 1.05, 1, 1], [0, 0.1, 0.22, 0.32, 0.45, 1]) }];
    case "alert": // quick shake
      return [{ translateX: n([0, -4, 4, -3, 3, -1, 0]) }];
    case "hydrating": // tips back for a sip
      return [{ rotate: r(["0deg", "-7deg", "-7deg", "0deg"], [0, 0.3, 0.7, 1]) }];
    case "active": // jogging bounce
      return [
        { translateY: n([0, -5, 0, -5, 0]) },
        { rotate: r(["-3deg", "3deg", "-3deg", "3deg", "-3deg"]) },
      ];
    case "calm": // slow, deep breath
      return [{ scale: n([1, 1.05, 1.05, 1], [0, 0.4, 0.6, 1]) }];
    case "feverish": // little shiver
      return [
        { translateX: n([0, -1.5, 1.5, -1.5, 1.5, 0]) },
        { rotate: r(["0deg", "-2deg", "2deg", "0deg"]) },
      ];
    default:
      return [];
  }
}

export default function MascotBubble({ pose, message, size = 84 }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const pop = useRef(new Animated.Value(0)).current;
  const zzz = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // little pop whenever the pose changes
  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [pose, reduceMotion, pop]);

  // floating "Z" for the sleepy pose
  useEffect(() => {
    zzz.setValue(0);
    if (pose !== "sleepy" || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(zzz, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pose, reduceMotion, zzz]);

  const idle = useIdleAnimation(pose, reduceMotion);
  const isDark = resolvedScheme === "dark";

  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel={message}>
      <Animated.View
        style={[
          styles.mascotWrap,
          { width: size, height: size },
          isDark && styles.mascotWrapDark,
          { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        ]}
      >
        <Animated.View style={{ transform: idle as any, transformOrigin: "50% 90%" } as any}>
          <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
        </Animated.View>

        {pose === "sleepy" && (
          <Animated.Text
            style={[
              styles.zzz,
              {
                opacity: zzz.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: zzz.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
                  { translateX: zzz.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
                  { scale: zzz.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) },
                ],
              },
            ]}
          >
            z
          </Animated.Text>
        )}
      </Animated.View>

      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  mascotWrap: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  // light circle so the charcoal limbs stay visible in dark mode
  mascotWrapDark: { backgroundColor: "rgba(255,255,255,0.88)" },
  zzz: {
    position: "absolute", top: 4, right: 6,
    fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "800", color: "#5E8BFF",
  },
  bubble: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, position: "relative",
  },
  tail: {
    position: "absolute", left: -6, top: "50%", width: 12, height: 12, marginTop: -6,
    borderLeftWidth: 1, borderBottomWidth: 1, transform: [{ rotate: "45deg" }],
  },
  message: { fontSize: 14, lineHeight: 20, fontFamily: FONT_MEDIUM },
});