import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

type Props = {
  dots?: number;
  size?: number; // dot diameter
  height?: number; // how high they bounce
  colors?: [string, string]; // gradient top → bottom
  glow?: string; // glow / ripple / shadow colour
};

const DURATION = 1400;
const STAGGER = 150;

/**
 * React Native version of the 21st.dev "Kinetic Dots Loader":
 * liquid dots that bounce with gravity, squash on impact, send a floor ripple and cast a breathing shadow.
 */
export default function KineticDotsLoader({
  dots = 4,
  size = 18,
  height = 40,
  colors = ["#67E8F9", "#2563EB"],
  glow = "#06B6D4",
}: Props) {
  const values = useRef(Array.from({ length: dots }, () => new Animated.Value(0))).current;

  useEffect(() => {
    let stopped = false;
    const loops: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (stopped || reduce) return; // reduce motion: dots stay still
        values.forEach((v, i) => {
          const loop = Animated.loop(
            Animated.timing(v, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: true })
          );
          loops.push(loop);
          timers.push(setTimeout(() => !stopped && loop.start(), i * STAGGER));
        });
      });

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, [values]);

  const gradId = useRef(`kdl-${Math.random().toString(36).slice(2)}`).current;

  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {values.map((t, i) => {
        // 1. gravity bounce — fast off the floor, slow at the top, fast back down
        const translateY = t.interpolate({
          inputRange: [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1],
          outputRange: [0, -0.49, -0.875, -0.99, -1, -0.99, -0.875, -0.49, 0].map((k) => k * height),
        });
        // 2. rubber squash & stretch
        const scaleX = t.interpolate({
          inputRange: [0, 0.05, 0.15, 0.5, 0.85, 1],
          outputRange: [1.4, 0.9, 1, 1, 0.9, 1.4],
        });
        const scaleY = t.interpolate({
          inputRange: [0, 0.05, 0.15, 0.5, 0.85, 1],
          outputRange: [0.6, 1.1, 1, 1, 1.1, 0.6],
        });
        // 3. shadow shrinks and fades while the dot is high
        const shadowScale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.4, 0.5, 1.4] });
        const shadowOpacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.1, 0.6] });
        // 4. floor ripple on impact
        const rippleScale = t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.5, 1.5] });
        const rippleOpacity = t.interpolate({ inputRange: [0, 0.05, 0.3, 1], outputRange: [0, 0.8, 0, 0] });

        return (
          <View key={i} style={[styles.col, { width: size + 6, height: height + size + 6 }]}>
            {/* floor ripple */}
            <Animated.View
              style={[
                styles.ripple,
                {
                  width: size * 2.2,
                  height: size * 0.65,
                  borderColor: glow,
                  opacity: rippleOpacity,
                  transform: [{ scale: rippleScale }],
                },
              ]}
            />
            {/* reflective shadow */}
            <Animated.View
              style={[
                styles.shadow,
                {
                  width: size,
                  height: size * 0.3,
                  backgroundColor: glow,
                  opacity: shadowOpacity,
                  transform: [{ scale: shadowScale }],
                },
              ]}
            />
            {/* the dot */}
            <Animated.View style={{ transform: [{ translateY }] }}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    shadowColor: glow,
                    transform: [{ translateY: size / 2 }, { scaleX }, { scaleY }, { translateY: -size / 2 }],
                  },
                ]}
              >
                <Svg width={size} height={size}>
                  <Defs>
                    <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={colors[0]} />
                      <Stop offset="1" stopColor={colors[1]} />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradId})`} />
                  {/* specular highlight */}
                  <Circle cx={size * 0.32} cy={size * 0.3} r={size * 0.14} fill="rgba(255,255,255,0.6)" />
                </Svg>
              </Animated.View>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
  col: { alignItems: "center", justifyContent: "flex-end" },
  dot: {
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  ripple: { position: "absolute", bottom: -2, borderWidth: 1.5, borderRadius: 999 },
  shadow: { position: "absolute", bottom: -4, borderRadius: 999 },
});