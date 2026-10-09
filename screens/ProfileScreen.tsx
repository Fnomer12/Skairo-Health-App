import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Image, ScrollView,
  Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Cloud, Mars, Venus } from "lucide-react-native";
import { Profile, Gender, initDatabase, getProfiles, addProfile, fullName } from "../db/profiles";
import { useTheme, ThemeColors } from "../context/ThemeContext";

type Props = {
  onSelectProfile: (profile: Profile) => void;
};

const MAX_PROFILES = 8;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => CURRENT_YEAR - i);

function formatDob(dateOfBirth: string): string {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Mirrors the Apple-ID-style account picker: one profile sits big and
// centered, two sit side by side at a slightly smaller size, and anything
// from three up to the 8-profile cap settles into a neat, uniform grid.
function getAvatarSize(count: number): number {
  if (count <= 1) return 118;
  if (count === 2) return 100;
  if (count <= 4) return 88;
  return 76;
}

// Only the two-profile case gets a playful vertical stagger — the "floating
// bubbles" look — everything from three up behaves the same (a plain grid).
function getBubbleOffset(count: number, index: number): number {
  if (count === 2) return index % 2 === 0 ? -10 : 10;
  return 0;
}

// The colorful "confetti ring" halo that radiates around each avatar —
// three rings of small, rainbow-hued dots placed with simple trig so the
// scatter is deterministic (same avatar always gets the same halo) instead
// of re-randomizing on every render.
type HaloDot = { x: number; y: number; size: number; color: string };

function buildHaloDots(avatarSize: number): HaloDot[] {
  const baseRadius = avatarSize / 2;
  const rings: Array<{ radius: number; count: number; dotSize: number; hueOffset: number }> = [
    { radius: baseRadius * 1.16, count: 10, dotSize: avatarSize * 0.05, hueOffset: 0 },
    { radius: baseRadius * 1.34, count: 14, dotSize: avatarSize * 0.065, hueOffset: 55 },
    { radius: baseRadius * 1.52, count: 9, dotSize: avatarSize * 0.04, hueOffset: 120 },
  ];

  const dots: HaloDot[] = [];
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ringIndex * 0.35;
      // Deterministic per-dot jitter (trig-based, not random) so the ring
      // reads as scattered confetti rather than a perfect circle of dots.
      const radiusJitter = 1 + Math.sin(angle * 3 + ringIndex) * 0.08;
      const radius = ring.radius * radiusJitter;
      const sizeJitter = 0.8 + Math.abs(Math.sin(angle * 2 + ringIndex)) * 0.4;
      const hue = Math.round((angle * (180 / Math.PI) + ring.hueOffset) % 360);
      dots.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: ring.dotSize * sizeJitter,
        color: `hsl(${hue}, 78%, 58%)`,
      });
    }
  });
  return dots;
}

const AvatarHalo = React.memo(function AvatarHalo({ avatarSize }: { avatarSize: number }) {
  const dots = useMemo(() => buildHaloDots(avatarSize), [avatarSize]);
  const haloSize = avatarSize * 1.75;
  const offset = (avatarSize - haloSize) / 2;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", width: haloSize, height: haloSize, left: offset, top: offset }}
    >
      {dots.map((dot, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: haloSize / 2 + dot.x - dot.size / 2,
            top: haloSize / 2 + dot.y - dot.size / 2,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: dot.color,
          }}
        />
      ))}
    </View>
  );
});

export default function ProfileScreen({ onSelectProfile }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [allergies, setAllergies] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);

  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR - 25);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);

  const atCapacity = profiles.length >= MAX_PROFILES;
  const avatarSize = getAvatarSize(profiles.length || 1);
  // The halo radiates out to ~1.75x the avatar size, so the grid needs extra
  // breathing room between bubbles (and a wider wrap column) to keep
  // neighboring halos from overlapping.
  const bubbleColumnWidth = avatarSize * 1.7;
  const gridGap = avatarSize * 0.85;

  const insets = useSafeAreaInsets();

  const loadProfiles = useCallback(async () => {
    try {
      await initDatabase();
      const rows = await getProfiles();
      setProfiles(rows);
    } catch (e) {
      Alert.alert("Couldn't load profiles", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function openAdd() {
    if (atCapacity) {
      Alert.alert("Profile limit reached", `You can have up to ${MAX_PROFILES} profiles. Delete one to add another.`);
      return;
    }
    setFirstName("");
    setLastName("");
    setAllergies("");
    setDateOfBirth(null);
    setGender(null);
    setAddVisible(true);
  }

  async function handleAdd() {
    if (!firstName.trim()) {
      Alert.alert("Name required", "Please enter at least a first name.");
      return;
    }
    if (!gender) {
      Alert.alert("Gender required", "Please select Male or Female.");
      return;
    }
    setSaving(true);
    try {
      await addProfile(firstName.trim(), lastName.trim(), allergies.trim(), dateOfBirth, gender);
      await loadProfiles();
      setAddVisible(false);
    } catch (e) {
      Alert.alert("Couldn't add profile", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleConnectDrive() {
    Alert.alert("Connect Google Drive", "Google Sign-In isn't wired up yet — see the setup steps.");
  }

  function openDobPicker() {
    const current = dateOfBirth ? dateOfBirth.split("-").map(Number) : null;
    setSelectedYear(current ? current[0] : CURRENT_YEAR - 25);
    setSelectedMonth(current ? current[1] : 1);
    setSelectedDay(current ? current[2] : 1);
    // Only one RN <Modal> can be reliably visible at a time — close the
    // "New profile" modal before opening the DOB picker modal on top of it.
    setAddVisible(false);
    setDobPickerVisible(true);
  }

  function handleConfirmDob() {
    const mm = String(selectedMonth).padStart(2, "0");
    const dd = String(selectedDay).padStart(2, "0");
    setDateOfBirth(`${selectedYear}-${mm}-${dd}`);
    setDobPickerVisible(false);
    setAddVisible(true); // hand control back to the New profile modal
  }

  function handleCancelDob() {
    setDobPickerVisible(false);
    setAddVisible(true); // hand control back to the New profile modal
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brandTitle}>Skairo Health</Text>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Profiles</Text>
          <Text style={styles.countText}>{profiles.length}/{MAX_PROFILES} users</Text>
        </View>
        <TouchableOpacity style={styles.cloudButton} onPress={handleConnectDrive}>
          <Cloud color={colors.text} size={18} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.text} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        >
          <View style={[styles.grid, { gap: gridGap }]}>
            {profiles.map((item, index) => {
              const initials = `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
              const offsetY = getBubbleOffset(profiles.length, index);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.bubbleWrap, { width: bubbleColumnWidth, transform: [{ translateY: offsetY }] }]}
                  onPress={() => onSelectProfile(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatarSlot, { width: avatarSize, height: avatarSize }]}>
                    <AvatarHalo avatarSize={avatarSize} />
                    <View
                      style={[
                        styles.avatarBubble,
                        { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                      ]}
                    >
                      {item.photoUri ? (
                        <Image
                          source={{ uri: item.photoUri }}
                          style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
                        />
                      ) : (
                        <Text style={[styles.avatarText, { fontSize: avatarSize * 0.32 }]}>{initials}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.bubbleName} numberOfLines={2}>
                    {fullName(item)}
                  </Text>
                  {item.allergies ? (
                    <Text style={styles.bubbleSub} numberOfLines={1}>
                      Allergies: {item.allergies}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {!atCapacity && (
              <TouchableOpacity
                style={[styles.bubbleWrap, { width: bubbleColumnWidth }]}
                onPress={openAdd}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.addBubble,
                    { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                  ]}
                >
                  <Plus color={colors.textFaint} size={avatarSize * 0.28} />
                </View>
                <Text style={styles.bubbleNameMuted}>
                  {profiles.length === 0 ? "Add profile" : "Add another"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {atCapacity && (
            <Text style={styles.capacityNote}>You've reached the {MAX_PROFILES}-profile limit.</Text>
          )}
          {profiles.length === 0 && (
            <Text style={styles.emptyHint}>Tap the circle above to add your first profile.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={addVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>New profile</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={colors.textFaint}
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor={colors.textFaint}
                value={lastName}
                onChangeText={setLastName}
              />

              <TouchableOpacity style={styles.dobRow} onPress={openDobPicker}>
                <Text style={styles.dobRowLabel}>Date of birth</Text>
                <Text style={styles.dobRowValue}>{dateOfBirth ? formatDob(dateOfBirth) : "Not set"}</Text>
              </TouchableOpacity>

              <Text style={styles.genderLabel}>Gender</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderButton, gender === "Male" && styles.genderButtonActive]}
                  onPress={() => setGender("Male")}
                >
                  <Mars color={gender === "Male" ? colors.accentText : colors.textMuted} size={16} />
                  <Text style={[styles.genderButtonText, gender === "Male" && styles.genderButtonTextActive]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, gender === "Female" && styles.genderButtonActive]}
                  onPress={() => setGender("Female")}
                >
                  <Venus color={gender === "Female" ? colors.accentText : colors.textMuted} size={16} />
                  <Text style={[styles.genderButtonText, gender === "Female" && styles.genderButtonTextActive]}>
                    Female
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Allergies (e.g. peanuts, penicillin)"
                placeholderTextColor={colors.textFaint}
                value={allergies}
                onChangeText={setAllergies}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAddVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.saveText}>Add</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={dobPickerVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Date of birth</Text>
            <View style={styles.pickerRow}>
              <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                {DAYS.map((d) => (
                  <TouchableOpacity key={d} style={styles.pickerItem} onPress={() => setSelectedDay(d)}>
                    <Text style={[styles.pickerItemText, selectedDay === d && styles.pickerItemTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={[styles.pickerColumn, styles.pickerColumnWide]} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={styles.pickerItem} onPress={() => setSelectedMonth(i + 1)}>
                    <Text style={[styles.pickerItemText, selectedMonth === i + 1 && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                {YEARS.map((y) => (
                  <TouchableOpacity key={y} style={styles.pickerItem} onPress={() => setSelectedYear(y)}>
                    <Text style={[styles.pickerItemText, selectedYear === y && styles.pickerItemTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handleCancelDob}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleConfirmDob}>
                <Text style={styles.saveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FONT_BOLD = Platform.OS === "ios" ? "AvenirNext-Bold" : undefined;
const FONT_MEDIUM = Platform.OS === "ios" ? "AvenirNext-Medium" : undefined;
const FONT_DEMI = Platform.OS === "ios" ? "AvenirNext-DemiBold" : undefined;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
    brandTitle: {
      textAlign: "center",
      fontSize: 26,
      fontFamily: FONT_BOLD,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 16,
      letterSpacing: 0.3,
    },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, marginBottom: 10,
    },
    title: { fontSize: 24, fontFamily: FONT_BOLD, fontWeight: "700", color: colors.text },
    countText: { fontSize: 12, color: colors.textFaint, fontFamily: FONT_MEDIUM, marginTop: 2 },
    cloudButton: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 24,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "flex-start",
      gap: 26,
      paddingHorizontal: 20,
      width: "100%",
    },
    bubbleWrap: { alignItems: "center", width: 112 },
    avatarSlot: { alignItems: "center", justifyContent: "center", position: "relative" },
    avatarBubble: {
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
        },
        android: { elevation: 6 },
      }),
    },
    avatarText: { color: colors.accentText, fontFamily: FONT_BOLD, fontWeight: "700" },
    bubbleName: {
      marginTop: 10, fontSize: 13, fontFamily: FONT_DEMI, color: colors.text,
      textAlign: "center",
    },
    bubbleSub: {
      fontSize: 10, fontFamily: FONT_MEDIUM, color: colors.textFaint,
      textAlign: "center", marginTop: 2,
    },
    addBubble: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    bubbleNameMuted: {
      marginTop: 10, fontSize: 13, fontFamily: FONT_MEDIUM, color: colors.textFaint,
      textAlign: "center",
    },
    capacityNote: {
      fontSize: 12, fontFamily: FONT_MEDIUM, color: colors.textFaint, textAlign: "center", marginTop: 22,
    },
    emptyHint: {
      fontSize: 12, fontFamily: FONT_MEDIUM, color: colors.textFaint, textAlign: "center", marginTop: 22,
    },

    modalBackdrop: { flex: 1, backgroundColor: colors.modalBackdrop, justifyContent: "center", alignItems: "center" },
    modalBox: { width: "85%", backgroundColor: colors.background, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.text,
    },
    textArea: { height: 80, textAlignVertical: "top" },
    dobRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
    },
    dobRowLabel: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.textMuted },
    dobRowValue: { fontSize: 14, fontFamily: FONT_DEMI, color: colors.text },
    genderLabel: { fontSize: 12, fontFamily: FONT_MEDIUM, color: colors.textMuted, marginBottom: 6 },
    genderRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    genderButton: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    genderButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    genderButtonText: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.textMuted },
    genderButtonTextActive: { color: colors.accentText, fontFamily: FONT_DEMI },
    pickerRow: { flexDirection: "row", height: 180, marginBottom: 12, gap: 6 },
    pickerColumn: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },
    pickerColumnWide: { flex: 1.6 },
    pickerItem: { paddingVertical: 10, alignItems: "center" },
    pickerItemText: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.textFaint },
    pickerItemTextActive: { color: colors.text, fontFamily: FONT_BOLD, fontWeight: "700" },
    modalButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 10 },
    modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    cancelButton: { backgroundColor: colors.surfaceAlt },
    cancelText: { fontFamily: FONT_DEMI, color: colors.text },
    saveButton: { backgroundColor: colors.accent },
    saveText: { fontFamily: FONT_DEMI, color: colors.accentText },
  });
}