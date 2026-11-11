import React, { useEffect, useState } from "react";
import { Image, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Props = {
  uri?: string | null; // photo — falls back to initials if missing or it fails to load
  name: string; // used for the initials
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// Small round avatar: photo, or initials on a soft grey circle (like the 21st.dev / Radix avatar)
export default function Avatar({ uri, name, size = 28, style }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const box = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.root, box, style]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={box} onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#8E99AB" },
  initials: {
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined,
    fontWeight: "600",
  },
});