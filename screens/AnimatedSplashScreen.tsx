import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Rect, Defs, RadialGradient, Stop } from "react-native-svg";
import { useFonts, DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import { EncryptedText } from "./components/ui/EncryptedText";

// Adjust the import above to wherever you place EncryptedText.tsx in your
// project (e.g. "@/components/ui/EncryptedText" to match your other code).

type Props = {
  onFinish: () => void;
};

const LOGO = require("../assets/images/skairo-logo.png");

const TITLE = "Skairo Health";
const TOTAL_DURATION_MS = 3000;

type BubbleConfig = {
  leftPct: number; // 0-1, relative to container width
  topPct: number; // 0-1, relative to container height
  size: number; // diameter in px
  floatRange: number; // px of vertical drift
  pulseDuration: number;
  floatDuration: number;
  delay: number;
  peakOpacity: number;
};

// Scattered loosely around the title, varied sizes so it reads as organic
// rather than a repeating pattern.
const BUBBLES: BubbleConfig[] = [
  { leftPct: 0.10, topPct: 0.14, size: 42, floatRange: 14, pulseDuration: 2600, floatDuration: 4200, delay: 0, peakOpacity: 0.5 },
  { leftPct: 0.84, topPct: 0.12, size: 54, floatRange: 18, pulseDuration: 3100, floatDuration: 4800, delay: 300, peakOpacity: 0.45 },
  { leftPct: 0.18, topPct: 0.80, size: 34, floatRange: 10, pulseDuration: 2200, floatDuration: 3600, delay: 600, peakOpacity: 0.55 },
  { leftPct: 0.88, topPct: 0.74, size: 46, floatRange: 16, pulseDuration: 2900, floatDuration: 4500, delay: 150, peakOpacity: 0.4 },
  { leftPct: 0.04, topPct: 0.46, size: 26, floatRange: 9, pulseDuration: 1900, floatDuration: 3200, delay: 900, peakOpacity: 0.5 },
  { leftPct: 0.95, topPct: 0.40, size: 30, floatRange: 11, pulseDuration: 2400, floatDuration: 3800, delay: 450, peakOpacity: 0.45 },
  { leftPct: 0.36, topPct: 0.04, size: 20, floatRange: 8, pulseDuration: 2000, floatDuration: 3300, delay: 1100, peakOpacity: 0.55 },
  { leftPct: 0.64, topPct: 0.92, size: 22, floatRange: 8, pulseDuration: 2100, floatDuration: 3400, delay: 750, peakOpacity: 0.5 },
  { leftPct: 0.50, topPct: 0.97, size: 34, floatRange: 12, pulseDuration: 2700, floatDuration: 4100, delay: 1350, peakOpacity: 0.4 },
];

function Bubble({ config, areaSize }: { config: BubbleConfig; areaSize: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: config.peakOpacity,
          duration: config.pulseDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: config.peakOpacity * 0.25,
          duration: config.pulseDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -config.floatRange,
          duration: config.floatDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: config.floatDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const t = setTimeout(() => {
      pulseLoop.start();
      floatLoop.start();
    }, config.delay);

    return () => {
      clearTimeout(t);
      pulseLoop.stop();
      floatLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const left = config.leftPct * areaSize - config.size / 2;
  const top = config.topPct * areaSize - config.size / 2;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left,
        top,
        width: config.size,
        height: config.size,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Svg width={config.size} height={config.size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`glow-${config.leftPct}-${config.topPct}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#glow-${config.leftPct}-${config.topPct})`} />
      </Svg>
    </Animated.View>
  );
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ DancingScript_700Bold });

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoBreath = useRef(new Animated.Value(0)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(10)).current;

  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    // Logo lands first with a soft overshoot.
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 650,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(logoScale, {
      toValue: 1,
      duration: 650,
      delay: 100,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
    Animated.timing(haloOpacity, {
      toValue: 1,
      duration: 900,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // A slow breathing pulse on the logo once it's settled, echoing the
    // heartbeat line built into the mark itself.
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoBreath, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          delay: 750,
          useNativeDriver: true,
        }),
        Animated.timing(logoBreath, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathLoop.start();

    // Title rises in underneath once the logo has mostly landed.
    Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 550,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(titleTranslateY, {
      toValue: 0,
      duration: 550,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const endTimer = setTimeout(() => {
      breathLoop.stop();
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, TOTAL_DURATION_MS);

    return () => {
      clearTimeout(endTimer);
      breathLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Keep the screen solid black (no flash of the wrong font) while the
    // custom font finishes loading.
    return <View style={styles.root} />;
  }

  const titleSize = Math.min(Math.max(width * 0.11, 30), 48);
  const logoSize = Math.min(Math.max(width * 0.38, 140), 220);
  const bubbleAreaSize = Math.min(width, height) * 0.95;

  const breathScale = logoBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="44%" r="70%">
            <Stop offset="0%" stopColor="#141414" stopOpacity={1} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>

      <View
        style={{
          width: bubbleAreaSize,
          height: bubbleAreaSize,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {BUBBLES.map((b, i) => (
          <Bubble key={i} config={b} areaSize={bubbleAreaSize} />
        ))}

        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {/* Soft halo seated behind the logo so it reads as glowing on black */}
          <Animated.View
            style={{
              position: "absolute",
              width: logoSize * 1.5,
              height: logoSize * 1.5,
              opacity: haloOpacity,
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="logoHalo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.22} />
                  <Stop offset="60%" stopColor="#FFFFFF" stopOpacity={0.07} />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#logoHalo)" />
            </Svg>
          </Animated.View>

          <Animated.Image
            source={LOGO}
            resizeMode="contain"
            style={{
              width: logoSize,
              height: logoSize,
              opacity: logoOpacity,
              transform: [{ scale: Animated.multiply(logoScale, breathScale) }],
            }}
          />

          <Animated.View
            style={{
              marginTop: titleSize * 0.35,
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <EncryptedText
              text={TITLE}
              startDelayMs={500}
              revealDelayMs={70}
              scrambleIntervalMs={40}
              style={[styles.title, { fontSize: titleSize }]}
              encryptedStyle={styles.titleEncrypted}
              revealedStyle={styles.titleRevealed}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "DancingScript_700Bold",
    letterSpacing: 0,
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleEncrypted: {
    color: "#6B6B6B",
  },
  titleRevealed: {
    color: "#FFFFFF",
  },
});