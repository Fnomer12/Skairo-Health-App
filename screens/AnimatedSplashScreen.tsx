import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { initDatabase, getProfiles } from "../db/profiles";
import KineticDotsLoader from "./components/KineticDotsLoader";

type Props = {
  onFinish: () => void;
};

const LOGO = require("../assets/images/skairo-logo.png");
const PULSE = require("../assets/mascot/pulse-happy.png");

const TOTAL_MS = 2600; // how long the splash stays before fading out

/**
 * Splash "C · Pulse says hello":
 * logo + name fade in → Pulse pops up and waves → speech bubble types in → bouncing dots → fade out.
 */
export default function AnimatedSplashScreen({ onFinish }: Props) {
  const { resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const c = isDark
    ? { bg: "#000000", card: "#1C1C1E", text: "#FFFFFF", muted: "#8E8E93" }
    : { bg: "#F2F2F7", card: "#FFFFFF", text: "#000000", muted: "#8E8E93" };

  // greet the person if there's only one profile on this device
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const profiles = await getProfiles();
        if (profiles.length === 1) setName(profiles[0].firstName);
      } catch {
        // no greeting name — "Hi there!" is fine
      }
    })();
  }, []);

  const greeting = `Hi ${name ?? "there"}! 👋`;
  const subline = "Let’s check how you’re doing.";
  const [typed, setTyped] = useState(0); // characters of the subline shown

  const screen = useRef(new Animated.Value(1)).current;
  const brand = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let typeTimer: ReturnType<typeof setInterval> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      Animated.timing(screen, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
        () => !cancelled && onFinish()
      );
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          // no movement: show everything, wait a moment, go
          [brand, pop, bubble].forEach((v) => v.setValue(1));
          setTyped(subline.length);
          finishTimer = setTimeout(finish, 1200);
          return;
        }

        // 1. logo + name
        Animated.timing(brand, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

        // 2. Pulse pops in, then waves twice
        Animated.sequence([
          Animated.delay(200),
          Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
          Animated.timing(wave, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        ]).start();

        // 3. bubble appears, then the line types in
        Animated.sequence([
          Animated.delay(650),
          Animated.spring(bubble, { toValue: 1, friction: 6, tension: 110, useNativeDriver: true }),
        ]).start(() => {
          if (cancelled) return;
          typeTimer = setInterval(() => {
            setTyped((t) => {
              if (t >= subline.length) {
                if (typeTimer) clearInterval(typeTimer);
                return t;
              }
              return t + 1;
            });
          }, 22);
        });

        finishTimer = setTimeout(finish, TOTAL_MS);
      });

    return () => {
      cancelled = true;
      if (typeTimer) clearInterval(typeTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waveRotate = wave.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: ["0deg", "-7deg", "5deg", "-6deg", "3deg", "0deg"],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: c.bg, opacity: screen }]}>
      {/* logo + name */}
      <Animated.View
        style={[
          styles.brand,
          {
            opacity: brand,
            transform: [{ translateY: brand.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={styles.logoTile}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={[styles.brandText, { color: c.text }]}>Skairo Health</Text>
      </Animated.View>

      <View style={styles.center}>
        {/* speech bubble */}
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: c.card,
              opacity: bubble,
              transform: [
                { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.hello, { color: c.text }]}>{greeting}</Text>
          <Text style={[styles.sub, { color: c.muted }]}>
            {subline.slice(0, typed)}
            {/* keeps the bubble from changing size while typing */}
            <Text style={{ color: "transparent" }}>{subline.slice(typed)}</Text>
          </Text>
          <View style={[styles.tail, { backgroundColor: c.card }]} />
        </Animated.View>

        {/* Pulse */}
        <Animated.View
          style={{
            opacity: pop,
            transform: [
              { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: waveRotate },
            ],
          }}
        >
          <Image source={PULSE} style={styles.mascot} resizeMode="contain" accessibilityLabel="Pulse waving hello" />
        </Animated.View>
      </View>

      {/* loading — bouncing liquid dots */}
      <Animated.View style={[styles.loader, { opacity: brand }]}>
        <KineticDotsLoader dots={4} size={14} height={26} colors={["#7EE8C8", "#22A68A"]} glow="#2BBF9A" />
      </Animated.View>
    </Animated.View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 92 },
  logoTile: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  logo: { width: 30, height: 30 },
  brandText: { fontSize: 19, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: -0.2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  bubble: {
    maxWidth: 270, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 20, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  hello: { fontSize: 19, fontFamily: FONT_BOLD, fontWeight: "700" },
  sub: { fontSize: 15, fontFamily: FONT_MEDIUM, marginTop: 3, textAlign: "center" },
  tail: {
    position: "absolute", bottom: -7, width: 16, height: 16, borderRadius: 3, transform: [{ rotate: "45deg" }],
  },
  mascot: { width: 240, height: 240, marginTop: 18 },

  loader: { marginBottom: 60 },
});