import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Avatar from "./Avatar";

type Person = { id: number | string; name: string; photoUri?: string | null };

type Props = {
  people: Person[];
  max?: number; // how many faces to show before "+N"
  size?: number;
  ringColor: string; // usually the screen background, so the overlap looks cut out
  overflowBg: string;
  overflowText: string;
};

// Overlapping avatars with a "+N" bubble — React Native version of the 21st.dev avatar group
export default function AvatarStack({ people, max = 3, size = 26, ringColor, overflowBg, overflowText }: Props) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const ring = 2;
  const overlap = size * 0.3;

  return (
    <View style={styles.row} accessibilityLabel={`${people.length} profiles`}>
      {shown.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.ring,
            {
              borderColor: ringColor,
              borderWidth: ring,
              borderRadius: (size + ring * 2) / 2,
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: shown.length - i,
            },
          ]}
        >
          <Avatar uri={p.photoUri} name={p.name} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.ring,
            {
              borderColor: ringColor,
              borderWidth: ring,
              borderRadius: (size + ring * 2) / 2,
              marginLeft: -overlap,
            },
          ]}
        >
          <View
            style={[
              styles.more,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: overflowBg },
            ]}
          >
            <Text style={[styles.moreText, { color: overflowText, fontSize: size * 0.38 }]}>+{extra}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  ring: { overflow: "hidden" },
  more: { alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined, fontWeight: "600" },
});