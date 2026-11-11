import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";

/**
 * LiquidTabBar — React Native port of the "Waterline" liquid navbar idea.
 * The active drop stretches toward the tab you pick (fast head, lagging tail),
 * sheds droplets on long jumps, squishes when it lands, and sends a ripple.
 * Each icon plays its own little scene. Pure RN Animated, native driver only.
 */

export type LiquidFx = "pop" | "spin" | "heartbeat" | "wave" | "drop" | "none";

export type LiquidTabItem = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  fx?: LiquidFx;
};

type Props = {
  items: LiquidTabItem[];
  activeIndex: number;
  onChange: (index: number, item: LiquidTabItem) => void;
  /** follow the app theme: "light" = light liquid glass, "dark" = dark liquid glass */
  tone?: "dark" | "light";
  /** colour of the selected tab (iOS blue by default) */
  accent?: string;
  /** optional round glass button beside the bar (iOS 26 style, like Apple Music's Search) */
  action?: {
    icon: React.ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
  };
};

const ITEM_HEIGHT = 54;
const ACTION_SIZE = 62;

export default function LiquidTabBar({ items, activeIndex, onChange, tone = "dark", accent, action }: Props) {
  const [barWidth, setBarWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; n: number } | null>(null);

  const n = items.length;
  const itemW = barWidth > 0 ? barWidth / n : 0;

  // two bodies: the head races to the new tab, the tail lags behind → stretch
  const head = useRef(new Animated.Value(0)).current;
  const tail = useRef(new Animated.Value(0)).current;
  // droplets that break off on long jumps
  const drop1 = useRef(new Animated.Value(0)).current;
  const drop2 = useRef(new Animated.Value(0)).current;
  // landing squish + ripple
  const squish = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(1)).current;
  // per-icon scene + active lift
  const fxAnims = useRef(items.map(() => new Animated.Value(1))).current;
  const lift = useRef(items.map((_, i) => new Animated.Value(i === activeIndex ? 1 : 0))).current;

  const placed = useRef(false);
  const prevIndex = useRef(activeIndex);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  // first layout (and on resize): snap everything into place, no animation
  useEffect(() => {
    if (!itemW) return;
    const x = activeIndex * itemW;
    [head, tail, drop1, drop2].forEach((v) => v.setValue(x));
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemW]);

  // move the drop whenever the active tab changes
  useEffect(() => {
    if (!placed.current || !itemW) return;
    const from = prevIndex.current;
    prevIndex.current = activeIndex;
    const x = activeIndex * itemW;

    lift.forEach((v, i) =>
      Animated.spring(v, { toValue: i === activeIndex ? 1 : 0, useNativeDriver: true, friction: 6, tension: 120 }).start()
    );

    if (reduceMotion || from === activeIndex) {
      [head, tail, drop1, drop2].forEach((v) => v.setValue(x));
      return;
    }

    const longJump = Math.abs(activeIndex - from) > 1;

    Animated.parallel([
      Animated.spring(head, { toValue: x, useNativeDriver: true, tension: 210, friction: 19 }),
      Animated.sequence([
        Animated.delay(longJump ? 90 : 60),
        Animated.spring(tail, { toValue: x, useNativeDriver: true, tension: 75, friction: 12 }),
      ]),
      Animated.spring(drop1, { toValue: x, useNativeDriver: true, tension: 120, friction: 10 }),
      Animated.sequence([
        Animated.delay(40),
        Animated.spring(drop2, { toValue: x, useNativeDriver: true, tension: 95, friction: 9 }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;
      // land: squash, then wobble back
      squish.setValue(longJump ? 0.8 : 0.88);
      Animated.spring(squish, { toValue: 1, useNativeDriver: true, friction: 4, tension: 160 }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, reduceMotion]);

  function handlePress(i: number) {
    if (itemW && !reduceMotion) {
      setRipple((r) => ({ x: i * itemW + itemW / 2, n: (r?.n ?? 0) + 1 }));
      rippleAnim.setValue(0);
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      if ((items[i].fx ?? "pop") !== "none") {
        fxAnims[i].setValue(0);
        Animated.timing(fxAnims[i], {
          toValue: 1,
          duration: items[i].fx === "heartbeat" ? 900 : 750,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      }
    }
    if (i !== activeIndex) onChange(i, items[i]);
  }

  // ---- derived geometry (all native-driver friendly) ----
  const derived = useMemo(() => {
    if (!itemW) return null;
    const abs = (v: Animated.AnimatedInterpolation<number> | Animated.AnimatedSubtraction<number>) =>
      v.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, 1], extrapolate: "extend" });

    const dist = abs(Animated.subtract(head, tail));
    const center = Animated.multiply(Animated.add(head, tail), 0.5);
    const scaleX = Animated.add(1, Animated.multiply(dist, 1 / itemW));
    // the neck thins as it stretches
    const thin = dist.interpolate({
      inputRange: [0, itemW, itemW * 2.5],
      outputRange: [1, 0.8, 0.66],
      extrapolate: "clamp",
    });
    const scaleY = Animated.multiply(thin, squish);
    // squish also widens a touch (volume preserving feel)
    const landX = squish.interpolate({ inputRange: [0.8, 1], outputRange: [1.1, 1] });

    const dropStyle = (d: Animated.Value, size: number) => {
      const gap = abs(Animated.subtract(d, head));
      return {
        opacity: gap.interpolate({
          inputRange: [0, itemW * 0.45, itemW * 0.9],
          outputRange: [0, 0, 0.85],
          extrapolate: "clamp",
        }),
        transform: [
          { translateX: Animated.add(d, itemW / 2 - size / 2) },
          {
            scale: gap.interpolate({
              inputRange: [0, itemW * 0.6, itemW * 1.6],
              outputRange: [0.3, 0.7, 1],
              extrapolate: "clamp",
            }),
          },
        ],
      };
    };

    return {
      blob: {
        width: itemW,
        transform: [{ translateX: center }, { scaleX: Animated.multiply(scaleX, landX) }, { scaleY }],
      },
      drop1: dropStyle(drop1, 12),
      drop2: dropStyle(drop2, 9),
    };
  }, [itemW, head, tail, drop1, drop2, squish]);

  const fxTransform = (fx: LiquidFx | undefined, v: Animated.Value) => {
    switch (fx ?? "pop") {
      case "spin":
        return [{ perspective: 200 }, { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }];
      case "heartbeat":
        return [
          {
            scale: v.interpolate({
              inputRange: [0, 0.12, 0.24, 0.36, 0.5, 1],
              outputRange: [1, 1.32, 0.94, 1.22, 1, 1],
            }),
          },
        ];
      case "wave":
        return [
          {
            rotate: v.interpolate({
              inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
              outputRange: ["0deg", "-16deg", "12deg", "-8deg", "4deg", "0deg"],
            }),
          },
        ];
      case "drop":
        return [
          { translateY: v.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [0, -10, 2, -2, 0] }) },
          { scaleX: v.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [1, 0.9, 1.25, 0.95, 1] }) },
          { scaleY: v.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [1, 1.1, 0.75, 1.05, 1] }) },
        ];
      case "none":
        return [];
      default: // pop
        return [
          { scale: v.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [1, 0.72, 1.18, 1] }) },
        ];
    }
  };

  const isDark = tone === "dark";
  const fg = accent ?? (isDark ? "#0A84FF" : "#007AFF"); // selected tab
  const fgSoft = isDark ? "#FFFFFF" : "#000000"; // other tabs
  const glass = isDark ? styles.barDark : styles.barLight;
  const selFill = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.shadow, styles.barWrap]}>
        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={[styles.bar, glass]}>
          <View
            style={styles.inner}
            onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
            accessibilityRole="tablist"
          >
            {derived && (
              <>
                {/* droplets sit behind the main drop */}
                <Animated.View pointerEvents="none" style={[styles.droplet, { width: 12, height: 12, borderRadius: 6, backgroundColor: selFill }, derived.drop1]} />
                <Animated.View pointerEvents="none" style={[styles.droplet, { width: 9, height: 9, borderRadius: 4.5, backgroundColor: selFill }, derived.drop2]} />

                {/* soft highlight behind the selected tab */}
                <Animated.View pointerEvents="none" style={[styles.blob, { backgroundColor: selFill }, derived.blob]} />

                {/* tap ripple */}
                {ripple && (
                  <Animated.View
                    key={ripple.n}
                    pointerEvents="none"
                    style={[
                      styles.ripple,
                      {
                        width: itemW * 0.8,
                        left: ripple.x - (itemW * 0.8) / 2,
                        borderColor: fg,
                        opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                        transform: [
                          { scaleX: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.45] }) },
                          { scaleY: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) },
                        ],
                      },
                    ]}
                  />
                )}
              </>
            )}

            {items.map((item, i) => {
              const active = i === activeIndex;
              const { Icon } = item;
              const liftY = lift[i].interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
              const liftS = lift[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
              return (
                <Pressable
                  key={item.key}
                  style={styles.item}
                  onPress={() => handlePress(i)}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  hitSlop={4}
                >
                  <Animated.View style={{ transform: [{ translateY: liftY }, { scale: liftS }] }}>
                    <Animated.View
                      style={[
                        { transform: fxTransform(item.fx, fxAnims[i]) as any },
                        item.fx === "wave" && { transformOrigin: "50% 92%" },
                      ]}
                    >
                      <Icon color={active ? fg : fgSoft} size={23} strokeWidth={active ? 2.2 : 1.9} />
                    </Animated.View>
                  </Animated.View>
                  <Text style={[styles.label, { color: active ? fg : fgSoft }, active && styles.labelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>

      {/* separate round glass action button */}
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          style={({ pressed }) => [styles.shadow, { borderRadius: ACTION_SIZE / 2 }, pressed && { transform: [{ scale: 0.93 }] }]}
        >
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={[styles.action, glass]}>
            {action.icon}
          </BlurView>
        </Pressable>
      )}
    </View>
  );
}

const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.OS === "ios" ? 30 : 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  barWrap: { flex: 1, borderRadius: ITEM_HEIGHT / 2 + 4 },
  bar: {
    borderRadius: ITEM_HEIGHT / 2 + 4,
    overflow: "hidden",
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // liquid glass: see-through tint + bright hairline edge
  barDark: {
    backgroundColor: "rgba(40,40,44,0.55)",
    borderColor: "rgba(255,255,255,0.16)",
  },
  barLight: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderColor: "rgba(255,255,255,0.85)",
  },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: "row",
    position: "relative",
    height: ITEM_HEIGHT,
  },
  blob: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: ITEM_HEIGHT / 2,
  },
  droplet: {
    position: "absolute",
    left: 0,
    top: ITEM_HEIGHT / 2 - 6,
  },
  ripple: {
    position: "absolute",
    top: 0,
    height: ITEM_HEIGHT,
    borderRadius: ITEM_HEIGHT / 2,
    borderWidth: 1.5,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: { fontSize: 11, fontFamily: FONT_MEDIUM, fontWeight: "500" },
  labelActive: { fontFamily: FONT_DEMI, fontWeight: "600" },
});