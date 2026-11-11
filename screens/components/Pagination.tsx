import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

const COLORS = {
  light: { text: "#000000", muted: "#8E8E93", faint: "#C7C7CC", active: "#000000", activeText: "#FFFFFF", pressed: "#F2F2F5" },
  dark: { text: "#FFFFFF", muted: "#8E8E93", faint: "#48484A", active: "#FFFFFF", activeText: "#000000", pressed: "#2C2C2E" },
};

type Props = {
  page: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
  isDark: boolean;
};

// 1 … 4 5 6 … 12  — same logic as the HeroUI "with ellipsis" example
function pageNumbers(page: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (page > 3) pages.push("ellipsis");
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Pagination({ page, totalPages, onChange, isDark }: Props) {
  const c = isDark ? COLORS.dark : COLORS.light;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <View style={styles.row} accessibilityRole="toolbar">
      <Pressable
        disabled={prevDisabled}
        onPress={() => onChange(page - 1)}
        style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.pressed }]}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: prevDisabled }}
        hitSlop={4}
      >
        <ChevronLeft size={18} color={prevDisabled ? c.faint : c.text} strokeWidth={2.4} />
      </Pressable>

      {pageNumbers(page, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <View key={`e${i}`} style={styles.item}>
            <Text style={[styles.num, { color: c.muted }]}>…</Text>
          </View>
        ) : (
          <Pressable
            key={p}
            onPress={() => p !== page && onChange(p)}
            style={({ pressed }) => [
              styles.item,
              p === page ? { backgroundColor: c.active } : pressed && { backgroundColor: c.pressed },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Page ${p}`}
            accessibilityState={{ selected: p === page }}
          >
            <Text style={[styles.num, { color: p === page ? c.activeText : c.text }]}>{p}</Text>
          </Pressable>
        )
      )}

      <Pressable
        disabled={nextDisabled}
        onPress={() => onChange(page + 1)}
        style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.pressed }]}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: nextDisabled }}
        hitSlop={4}
      >
        <ChevronRight size={18} color={nextDisabled ? c.faint : c.text} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  item: { minWidth: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  num: { fontSize: 14, fontFamily: FONT_DEMI, fontWeight: "600" },
});