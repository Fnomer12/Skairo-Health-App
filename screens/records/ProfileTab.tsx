import React, { useState } from "react";
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import {
  Pencil, Trash2, Camera, Calendar, Mars, Venus, Activity,
  Fingerprint, AlertTriangle, ChevronRight, UserRound, Sun, Check,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Profile, Gender, updateProfile, deleteProfile, calculateAge } from "../../db/profiles";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { ThemeMode } from "../../db/settings";

type Props = {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  onProfileDeleted: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

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

// Static (non-theme-reactive) mock-UI swatches — each one shows what that
// appearance mode actually looks like, the way iOS/Twitter/Telegram's own
// appearance pickers do, instead of just a labeled button.
const SWATCH = StyleSheet.create({
  full: { flex: 1, padding: 9, justifyContent: "center" },
  split: { flex: 1, flexDirection: "row" },
  half: { flex: 1, padding: 7, justifyContent: "center" },
  bar: { height: 7, borderRadius: 4, marginBottom: 7, width: "75%" },
  line: { height: 5, borderRadius: 3, marginTop: 5 },
});

function ThemePreviewSwatch({ variant }: { variant: "light" | "dark" | "system" }) {
  if (variant === "system") {
    return (
      <View style={SWATCH.split}>
        <View style={[SWATCH.half, { backgroundColor: "#ffffff" }]}>
          <View style={[SWATCH.bar, { backgroundColor: "#e4e4e4", width: "85%" }]} />
          <View style={[SWATCH.line, { backgroundColor: "#e4e4e4", width: "70%" }]} />
        </View>
        <View style={[SWATCH.half, { backgroundColor: "#000000" }]}>
          <View style={[SWATCH.bar, { backgroundColor: "#303032", width: "85%" }]} />
          <View style={[SWATCH.line, { backgroundColor: "#303032", width: "70%" }]} />
        </View>
      </View>
    );
  }
  const isLight = variant === "light";
  const bg = isLight ? "#ffffff" : "#000000";
  const barColor = isLight ? "#eeeeee" : "#242426";
  const lineColor = isLight ? "#dcdcdc" : "#3a3a3a";
  return (
    <View style={[SWATCH.full, { backgroundColor: bg }]}>
      <View style={[SWATCH.bar, { backgroundColor: barColor }]} />
      <View style={[SWATCH.line, { backgroundColor: lineColor, width: "68%" }]} />
      <View style={[SWATCH.line, { backgroundColor: lineColor, width: "48%" }]} />
    </View>
  );
}

export default function ProfileTab({ profile, onProfileUpdated, onProfileDeleted, onScroll }: Props) {
  const { colors, mode, setMode } = useTheme();
  const styles = createStyles(colors);

  const [editVisible, setEditVisible] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [allergies, setAllergies] = useState(profile.allergies ?? "");
  const [gender, setGender] = useState<Gender | null>(profile.gender ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const existingDob = profile.dateOfBirth ? profile.dateOfBirth.split("-").map(Number) : null;
  const [selectedYear, setSelectedYear] = useState(existingDob ? existingDob[0] : CURRENT_YEAR - 25);
  const [selectedMonth, setSelectedMonth] = useState(existingDob ? existingDob[1] : 1);
  const [selectedDay, setSelectedDay] = useState(existingDob ? existingDob[2] : 1);
  const [savingDob, setSavingDob] = useState(false);

  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  const age = profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;

  function openEdit() {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setAllergies(profile.allergies ?? "");
    setGender(profile.gender ?? null);
    setEditVisible(true);
  }

  async function handleSave() {
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
      const updated = await updateProfile(profile.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        allergies: allergies.trim(),
        gender,
      });
      onProfileUpdated(updated);
      setEditVisible(false);
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete profile",
      `This will permanently remove ${profile.firstName}'s profile and all of their records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              if (profile.photoUri) {
                await FileSystem.deleteAsync(profile.photoUri, { idempotent: true }).catch(() => {});
              }
              await deleteProfile(profile.id);
              onProfileDeleted();
            } catch (e) {
              Alert.alert("Couldn't delete", (e as Error).message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  function handleAvatarPress() {
    const options: Array<{ text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }> = [
      { text: "Choose from Library", onPress: pickFromLibrary },
    ];
    if (profile.photoUri) {
      options.push({ text: "Remove Photo", style: "destructive", onPress: handleRemovePhoto });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Profile Photo", undefined, options);
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setPhotoBusy(true);
    try {
      const sourceUri = result.assets[0].uri;
      const dir = `${FileSystem.documentDirectory}profile-photos/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const destUri = `${dir}profile-${profile.id}-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });

      if (profile.photoUri) {
        await FileSystem.deleteAsync(profile.photoUri, { idempotent: true }).catch(() => {});
      }

      const updated = await updateProfile(profile.id, { photoUri: destUri });
      onProfileUpdated(updated);
    } catch (e) {
      Alert.alert("Couldn't set photo", (e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true);
    try {
      if (profile.photoUri) {
        await FileSystem.deleteAsync(profile.photoUri, { idempotent: true }).catch(() => {});
      }
      const updated = await updateProfile(profile.id, { photoUri: null });
      onProfileUpdated(updated);
    } catch (e) {
      Alert.alert("Couldn't remove photo", (e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  function openDobPicker() {
    const current = profile.dateOfBirth ? profile.dateOfBirth.split("-").map(Number) : null;
    setSelectedYear(current ? current[0] : CURRENT_YEAR - 25);
    setSelectedMonth(current ? current[1] : 1);
    setSelectedDay(current ? current[2] : 1);
    setDobPickerVisible(true);
  }

  async function handleSaveDob() {
    const mm = String(selectedMonth).padStart(2, "0");
    const dd = String(selectedDay).padStart(2, "0");
    const dateOfBirth = `${selectedYear}-${mm}-${dd}`;
    setSavingDob(true);
    try {
      const updated = await updateProfile(profile.id, { dateOfBirth });
      onProfileUpdated(updated);
      setDobPickerVisible(false);
    } catch (e) {
      Alert.alert("Couldn't save date of birth", (e as Error).message);
    } finally {
      setSavingDob(false);
    }
  }

  const GenderIcon = profile.gender === "Male" ? Mars : profile.gender === "Female" ? Venus : UserRound;

  const THEME_OPTIONS: Array<{ key: ThemeMode; label: string }> = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "system", label: "Auto" },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.heroCard}>
          <Activity color={colors.onAccentFaint} size={130} strokeWidth={1.3} style={styles.heroPulseLeft} />
          <Activity color={colors.onAccentFaint} size={130} strokeWidth={1.3} style={styles.heroPulseRight} />

          <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} disabled={photoBusy}>
            <View style={styles.avatarCircle}>
              {photoBusy ? (
                <ActivityIndicator color={colors.accent} />
              ) : profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Camera color={colors.accentText} size={12} strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>
            {profile.firstName} {profile.lastName}
          </Text>
          {(profile.gender || age != null) && (
            <Text style={styles.heroSub}>
              {profile.gender ?? ""}{profile.gender && age != null ? " · " : ""}{age != null ? `Age ${age}` : ""}
            </Text>
          )}

          <TouchableOpacity style={styles.editButton} onPress={openEdit}>
            <Pencil color={colors.accentText} size={14} />
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Fingerprint color={colors.accentText} size={15} />
            </View>
            <Text style={styles.infoRowLabel}>Profile ID</Text>
            <Text style={styles.infoRowValue}>{profile.publicId}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <GenderIcon color={colors.accentText} size={15} />
            </View>
            <Text style={styles.infoRowLabel}>Gender</Text>
            <Text style={styles.infoRowValue}>{profile.gender ?? "Not set"}</Text>
          </View>
          <View style={styles.infoDivider} />
          <TouchableOpacity style={styles.infoRow} onPress={openDobPicker}>
            <View style={styles.infoIconWrap}>
              <Calendar color={colors.accentText} size={15} />
            </View>
            <Text style={styles.infoRowLabel}>Date of birth</Text>
            {profile.dateOfBirth ? (
              <Text style={styles.infoRowValue}>
                {formatDob(profile.dateOfBirth)} · Age {age}
              </Text>
            ) : (
              <Text style={styles.infoRowValuePlaceholder}>Tap to set</Text>
            )}
            <ChevronRight color={colors.textFaint} size={16} style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.allergyCard}>
          <View style={styles.allergyHeader}>
            <View style={styles.infoIconWrap}>
              <AlertTriangle color={colors.accentText} size={15} />
            </View>
            <Text style={styles.allergyLabel}>Allergies</Text>
          </View>
          <Text style={styles.allergyValue}>
            {profile.allergies && profile.allergies.length > 0 ? profile.allergies : "None specified"}
          </Text>
        </View>

        <View style={styles.appearanceCard}>
          <View style={styles.allergyHeader}>
            <View style={styles.infoIconWrap}>
              <Sun color={colors.accentText} size={15} />
            </View>
            <Text style={styles.allergyLabel}>Appearance</Text>
          </View>
          <View style={styles.previewRow}>
            {THEME_OPTIONS.map(({ key, label }) => {
              const active = mode === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.previewTile}
                  activeOpacity={0.85}
                  onPress={() => setMode(key)}
                >
                  <View style={[styles.previewSwatch, active && styles.previewSwatchActive]}>
                    <ThemePreviewSwatch variant={key} />
                    {active && (
                      <View style={styles.previewCheck}>
                        <Check color={colors.accentText} size={11} strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.previewLabel, active && styles.previewLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Trash2 color={colors.danger} size={16} />
              <Text style={styles.deleteButtonText}>Delete profile</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={editVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit profile</Text>
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
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setDobPickerVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveDob} disabled={savingDob}>
                {savingDob ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.saveText}>Done</Text>}
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
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    list: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, alignItems: "center" },

    heroCard: {
      position: "relative", width: "100%", backgroundColor: colors.accent,
      borderRadius: 28, overflow: "hidden", paddingVertical: 28, paddingHorizontal: 20,
      alignItems: "center", marginBottom: 16,
    },
    heroPulseLeft: { position: "absolute", left: -36, top: "50%", marginTop: -65, transform: [{ rotate: "8deg" }] },
    heroPulseRight: { position: "absolute", right: -36, top: "50%", marginTop: -65, transform: [{ rotate: "-8deg" }] },

    avatarWrapper: { marginBottom: 14 },
    avatarCircle: {
      width: 92, height: 92, borderRadius: 46, backgroundColor: colors.accentText,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    avatarImage: { width: 92, height: 92, borderRadius: 46 },
    avatarText: { color: colors.accent, fontSize: 28, fontFamily: FONT_BOLD, fontWeight: "700" },
    cameraBadge: {
      position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.accentText,
    },
    name: { fontSize: 19, fontFamily: FONT_BOLD, fontWeight: "700", color: colors.accentText },
    heroSub: { fontSize: 12, fontFamily: FONT_MEDIUM, color: colors.onAccentMuted, marginTop: 4, marginBottom: 16 },
    editButton: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.onAccentOverlay, borderWidth: 1, borderColor: colors.onAccentOverlayBorder,
    },
    editButtonText: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.accentText },

    infoCard: {
      width: "100%", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
      marginBottom: 14, overflow: "hidden",
    },
    infoRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 13, paddingHorizontal: 14,
    },
    infoIconWrap: {
      width: 30, height: 30, borderRadius: 10, backgroundColor: colors.accent,
      alignItems: "center", justifyContent: "center",
    },
    infoDivider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },
    infoRowLabel: { flex: 1, fontSize: 13, fontFamily: FONT_MEDIUM, color: colors.textMuted },
    infoRowValue: { fontSize: 13, fontFamily: FONT_DEMI, color: colors.text },
    infoRowValuePlaceholder: { fontSize: 13, fontFamily: FONT_MEDIUM, color: colors.textFaint },
    chevron: { marginLeft: 2 },

    allergyCard: {
      width: "100%", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 12,
    },
    allergyHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    allergyLabel: { fontSize: 13, fontFamily: FONT_MEDIUM, color: colors.textMuted },
    allergyValue: { fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.text, paddingLeft: 42 },

    appearanceCard: {
      width: "100%", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 12,
    },
    previewRow: { flexDirection: "row", gap: 10, paddingLeft: 42 },
    previewTile: { flex: 1, alignItems: "center" },
    previewSwatch: {
      width: "100%",
      aspectRatio: 1.15,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: colors.border,
      position: "relative",
      backgroundColor: colors.background,
    },
    previewSwatchActive: { borderColor: colors.accent },
    previewCheck: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    previewLabel: { fontSize: 11, fontFamily: FONT_MEDIUM, color: colors.textMuted, marginTop: 8 },
    previewLabelActive: { color: colors.text, fontFamily: FONT_DEMI },

    footer: {
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120,
      backgroundColor: colors.background,
    },
    deleteButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 12, borderRadius: 12, backgroundColor: colors.dangerBg,
      borderWidth: 1, borderColor: colors.dangerBorder,
    },
    deleteButtonText: { fontSize: 14, fontFamily: FONT_DEMI, color: colors.danger },
    modalBackdrop: { flex: 1, backgroundColor: colors.modalBackdrop, justifyContent: "center", alignItems: "center" },
    modalBox: { width: "85%", backgroundColor: colors.background, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM, color: colors.text,
    },
    textArea: { height: 80, textAlignVertical: "top" },
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