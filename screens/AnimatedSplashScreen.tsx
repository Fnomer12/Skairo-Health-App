import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

type Props = {
  onFinish: () => void;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TITLE = "SKAIRO HEALTH...";
const CHAR_STAGGER_MS = 90;
const CHAR_REVEAL_MS = 320;
const TOTAL_DURATION_MS = 3000; // whole splash stays up for 3 seconds
const ECG_SWEEP_MS = 900;

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const { width } = useWindowDimensions();

  // One reveal value per character: 0 = hidden, 1 = settled in place.
  const charAnims = useRef(TITLE.split("").map(() => new Animated.Value(0))).current;
  const ecgProgress = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reveal each letter one after another, rising up into place.
    charAnims.forEach((value, i) => {
      Animated.timing(value, {
        toValue: 1,
        duration: CHAR_REVEAL_MS,
        delay: i * CHAR_STAGGER_MS,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    });

    // A small ECG trace sweeps continuously the whole time.
    const ecgLoop = Animated.loop(
      Animated.timing(ecgProgress, {
        toValue: 1,
        duration: ECG_SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: false, // strokeDashoffset can't use the native driver
      })
    );
    ecgLoop.start();

    const endTimer = setTimeout(() => {
      ecgLoop.stop();
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
      ecgLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleSize = Math.min(Math.max(width * 0.075, 22), 34);
  const riseDistance = titleSize * 0.6;

  const ecgWidth = Math.min(Math.max(width * 0.3, 110), 160);
  const ecgHeight = ecgWidth * 0.22;
  const pathLength = 220;
  const strokeDashoffset = ecgProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [pathLength, -pathLength],
  });

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <View style={styles.titleRow}>
        {TITLE.split("").map((char, i) => {
          const translateY = charAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [riseDistance, 0],
          });
          return (
            <Animated.Text
              key={`${char}-${i}`}
              style={[
                styles.titleChar,
                {
                  fontSize: titleSize,
                  opacity: charAnims[i],
                  transform: [{ translateY }],
                },
              ]}
            >
              {char === " " ? "\u00A0" : char}
            </Animated.Text>
          );
        })}
      </View>

      <View
        style={{
          width: ecgWidth,
          height: ecgHeight,
          marginTop: titleSize * 0.8,
          overflow: "hidden",
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 180 40">
          <AnimatedPath
            d="
              M 0 20
              L 24 20
              L 29 18
              L 33 22
              L 37 20
              L 42 8
              L 47 32
              L 52 15
              L 57 20
              L 180 20
            "
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
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
  titleRow: {
    flexDirection: "row",
  },
  titleChar: {
    fontWeight: "700",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
});