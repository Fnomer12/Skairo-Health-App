import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  onPress: () => void;
  onLongPress?: () => void;
  isDark: boolean;
  disabled?: boolean;
  size?: number;
  accessibilityLabel: string;
  children: React.ReactNode;
};

// Round frosted-glass button (iOS 26 toolbar style)
export default function GlassButton({
  onPress,
  onLongPress,
  isDark,
  disabled,
  size = 44,
  accessibilityLabel,
  children,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.shadow, { borderRadius: size / 2 }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isDark ? "rgba(44,44,46,0.72)" : "rgba(255,255,255,0.78)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  circle: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});