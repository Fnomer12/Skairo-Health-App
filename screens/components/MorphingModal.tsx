import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";

/**
 * MorphingModal — React Native take on the "morphing dialog":
 * the card you tap grows into the modal (position, size, corners and colour
 * all morph), content fades in once it lands, and closing shrinks it back
 * into the card. No extra packages.
 */

export type MorphRect = { x: number; y: number; width: number; height: number };

type Props = {
  open: boolean;
  /** where the card sits on screen (from measureInWindow); null = grow from centre */
  origin: MorphRect | null;
  onRequestClose: () => void;
  /** fires after the close animation finishes */
  onClosed?: () => void;
  fromColor?: string;
  toColor: string;
  fromRadius?: number;
  toRadius?: number;
  backdropColor?: string;
  widthRatio?: number;
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function MorphingModal({
  open,
  origin,
  onRequestClose,
  onClosed,
  fromColor,
  toColor,
  fromRadius = 22,
  toRadius = 18,
  backdropColor = "rgba(0,0,0,0.4)",
  widthRatio = 0.88,
  maxHeightRatio = 0.75,
  contentStyle,
  children,
}: Props) {
  const { width: sw, height: sh } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const [contentH, setContentH] = useState<number | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  // open → mount; close → animate back, then unmount
  useEffect(() => {
    if (open) {
      started.current = false;
      progress.setValue(0);
      setMounted(true);
    } else if (mounted) {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;
        setMounted(false);
        setContentH(null);
        onClosed?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // once the content has been measured, morph open
  useEffect(() => {
    if (open && mounted && contentH != null && !started.current) {
      started.current = true;
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: false,
        stiffness: 170,
        damping: 20,
        mass: 1,
      }).start();
    }
  }, [open, mounted, contentH, progress]);

  if (!mounted) return null;

  const W = Math.round(sw * widthRatio);
  const H = Math.min(contentH ?? 0, Math.round(sh * maxHeightRatio));
  const fx = (sw - W) / 2;
  const fy = (sh - H) / 2;
  const o = origin ?? { x: fx + W * 0.1, y: fy + H * 0.1, width: W * 0.8, height: H * 0.8 };

  const lerp = (a: number, b: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const clampLerp = (a: number, b: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [a, b], extrapolate: "clamp" });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      {/* dimmed backdrop — tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor, opacity: clampLerp(0, 1) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
      </Animated.View>

      {/* invisible copy, used only to measure the content's natural height */}
      <View
        pointerEvents="none"
        style={[styles.measure, { width: W }]}
        onLayout={(e) => setContentH(Math.ceil(e.nativeEvent.layout.height))}
      >
        <View style={contentStyle}>{children}</View>
      </View>

      {contentH != null && (
        <Animated.View
          style={[
            styles.shell,
            {
              left: lerp(o.x, fx),
              top: lerp(o.y, fy),
              width: lerp(o.width, W),
              height: lerp(o.height, H),
              borderRadius: clampLerp(fromRadius, toRadius),
              backgroundColor: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [fromColor ?? toColor, toColor],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              { width: W, height: H },
              contentStyle,
              {
                opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1], extrapolate: "clamp" }),
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.6, 1],
                      outputRange: [12, 12, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            {children}
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  measure: { position: "absolute", left: 0, top: 0, opacity: 0 },
  shell: { position: "absolute", overflow: "hidden" },
});