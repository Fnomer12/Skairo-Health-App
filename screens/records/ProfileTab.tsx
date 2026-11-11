import React, { useState } from "react";
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Pressable,
  Modal, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Share,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import {
  Camera, Calendar, Mars, Venus, Fingerprint, AlertTriangle, ChevronRight, UserRound, Moon,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Profile, Gender, updateProfile, deleteProfile, calculateAge } from "../../db/profiles";
import { useTheme, ThemeColors } from "../../context/ThemeContext";
import { ThemeMode } from "../../db/settings";
import appConfig from "../../app.json";

type Props = {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  onProfileDeleted: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  topInset?: number; // height of the floating header above the page
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => CURRENT_YEAR - i);

const APP_VERSION: string = appConfig?.expo?.version ?? "1.0.0";

function formatDobShort(dateOfBirth: string): string {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  return `${MONTHS_SHORT[month - 1]} ${day}, ${year}`;
}

// Apple Settings–style colours (same palette as the cards on the other tabs)
const PAL = {
  light: {
    group: "#FFFFFF",
    edge: "rgba(0,0,0,0.07)",
    shadow: 0.05,
    text: "#000000",
    muted: "#8E8E93",
    faint: "#C7C7CC",
    sep: "#E5E5EA",
    blue: "#007AFF",
    red: "#FF3B30",
    segBg: "#EEEEF0",
    segOn: "#FFFFFF",
    avatar: "#8E99AB",
    themeIcon: "#1C1C1E",
  },
  dark: {
    group: "#1C1C1E",
    edge: "transparent",
    shadow: 0,
    text: "#FFFFFF",
    muted: "#8E8E93",
    faint: "#48484A",
    sep: "#38383A",
    blue: "#0A84FF",
    red: "#FF453A",
    segBg: "#2C2C2E",
    segOn: "#636366",
    avatar: "#5B6577",
    themeIcon: "#3A3A3C",
  },
};

const ICON_BG = { dob: "#FF9500", sex: "#5E5CE6", id: "#8E8E93", allergy: "#FF3B30" };

export default function ProfileTab({ profile, onProfileUpdated, onProfileDeleted, onScroll, topInset = 0 }: Props) {
  const { colors, mode, setMode, resolvedScheme } = useTheme();
  const styles = createStyles(colors);
  const p = resolvedScheme === "dark" ? PAL.dark : PAL.light;

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
  const hasAllergies = !!profile.allergies && profile.allergies.trim().length > 0;

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

  function shareId() {
    Share.share({ message: `My Skairo Health profile ID: ${profile.publicId}` }).catch(() => {});
  }

  const GenderIcon = profile.gender === "Male" ? Mars : profile.gender === "Female" ? Venus : UserRound;

  const THEME_OPTIONS: Array<{ key: ThemeMode; label: string }> = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "system", label: "Auto" },
  ];

  const subtitle = [profile.gender, age != null ? `${age} years` : null, `ID ${profile.publicId}`]
    .filter(Boolean)
    .join(" · ");

  const groupStyle = [
    styles.group,
    {
      backgroundColor: p.group,
      borderColor: p.edge,
      borderWidth: resolvedScheme === "dark" ? 0 : StyleSheet.hairlineWidth,
      shadowOpacity: p.shadow,
    },
  ];

  // one settings row
  function Row({
    icon,
    iconBg,
    label,
    value,
    valueStyle,
    onPress,
    chevron = true,
    last = false,
  }: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value?: React.ReactNode;
    valueStyle?: object;
    onPress?: () => void;
    chevron?: boolean;
    last?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: p.segBg }]}
      >
        <View style={[styles.iconTile, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={[styles.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.sep }]}>
          <Text style={[styles.rowLabel, { color: p.text }]}>{label}</Text>
          <View style={styles.rowRight}>
            {typeof value === "string" ? (
              <Text style={[styles.rowValue, { color: p.muted }, valueStyle]} numberOfLines={1}>
                {value}
              </Text>
            ) : (
              value
            )}
            {chevron && onPress && <ChevronRight size={17} color={p.faint} strokeWidth={2.4} />}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
          <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.list, { paddingTop: topInset + 8 }]}
        scrollIndicatorInsets={{ top: topInset }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPress} disabled={photoBusy} activeOpacity={0.8} accessibilityLabel="Change profile photo">
            <View style={[styles.avatar, { backgroundColor: p.avatar }]}>
              {photoBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: p.blue, borderColor: colors.background }]}>
              <Camera color="#FFFFFF" size={14} strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
            {profile.firstName} {profile.lastName}
          </Text>
          <Text style={[styles.subtitle, { color: p.muted }]}>{subtitle}</Text>

          <TouchableOpacity onPress={openEdit} activeOpacity={0.7} style={[styles.editBtn, { backgroundColor: p.blue + "1F" }]}>
            <Text style={[styles.editText, { color: p.blue }]}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* personal */}
        <Text style={[styles.section, { color: p.muted }]}>Personal</Text>
        <View style={groupStyle}>
          <Row
            icon={<Calendar color="#FFFFFF" size={16} strokeWidth={2.2} />}
            iconBg={ICON_BG.dob}
            label="Date of birth"
            value={profile.dateOfBirth ? formatDobShort(profile.dateOfBirth) : "Not set"}
            onPress={openDobPicker}
          />
          <Row
            icon={<GenderIcon color="#FFFFFF" size={16} strokeWidth={2.2} />}
            iconBg={ICON_BG.sex}
            label="Sex"
            value={profile.gender ?? "Not set"}
            onPress={openEdit}
          />
          <Row
            icon={<Fingerprint color="#FFFFFF" size={16} strokeWidth={2.2} />}
            iconBg={ICON_BG.id}
            label="Profile ID"
            chevron={false}
            onPress={shareId}
            last
            value={
              <View style={styles.idWrap}>
                <Text style={[styles.idText, { color: p.muted }]} selectable>
                  {profile.publicId}
                </Text>
                <Text style={[styles.shareText, { color: p.blue }]}>Share</Text>
              </View>
            }
          />
        </View>

        {/* medical */}
        <Text style={[styles.section, { color: p.muted }]}>Medical</Text>
        <View style={groupStyle}>
          <Row
            icon={<AlertTriangle color="#FFFFFF" size={16} strokeWidth={2.2} />}
            iconBg={ICON_BG.allergy}
            label="Allergies"
            value={hasAllergies ? "" : "None added"}
            onPress={openEdit}
            last
          />
          {hasAllergies && (
            <Text style={[styles.allergyText, { color: p.red }]}>{profile.allergies}</Text>
          )}
        </View>

        {/* appearance */}
        <Text style={[styles.section, { color: p.muted }]}>Appearance</Text>
        <View style={groupStyle}>
          <View style={styles.row}>
            <View style={[styles.iconTile, { backgroundColor: p.themeIcon }]}>
              <Moon color="#FFFFFF" size={15} fill="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: p.text }]}>Theme</Text>
              <View style={[styles.seg, { backgroundColor: p.segBg }]}>
                {THEME_OPTIONS.map(({ key, label }) => {
                  const on = mode === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setMode(key)}
                      style={[styles.segItem, on && [styles.segItemOn, { backgroundColor: p.segOn }]]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.segText, { color: p.text }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* delete */}
        <View style={[groupStyle, styles.deleteGroup]}>
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={({ pressed }) => [styles.deleteRow, pressed && { backgroundColor: p.segBg }]}
          >
            {deleting ? (
              <ActivityIndicator color={p.red} />
            ) : (
              <Text style={[styles.deleteText, { color: p.red }]}>Delete profile</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.appFooter}>
          <Text style={[styles.appFooterName, { color: p.muted }]}>Skairo Health</Text>
          <Text style={[styles.appFooterVersion, { color: p.faint }]}>Version {APP_VERSION}</Text>
        </View>
      </ScrollView>

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

            <Text style={styles.genderLabel}>Sex</Text>
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
const FONT_MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },

    // header
    header: { alignItems: "center", paddingTop: 6, paddingBottom: 4 },
    avatar: {
      width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    avatarImage: { width: 92, height: 92, borderRadius: 46 },
    avatarText: { color: "#FFFFFF", fontSize: 34, fontFamily: FONT_DEMI, fontWeight: "600" },
    cameraBadge: {
      position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center", borderWidth: 3,
    },
    name: { fontSize: 24, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: -0.3, marginTop: 12 },
    subtitle: { fontSize: 14, fontFamily: FONT_MEDIUM, marginTop: 2 },
    editBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 18 },
    editText: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600" },

    // grouped list
    section: {
      fontSize: 12.5, fontFamily: FONT_MEDIUM, textTransform: "uppercase", letterSpacing: 0.3,
      marginTop: 22, marginBottom: 6, marginLeft: 16,
    },
    group: {
      borderRadius: 14, overflow: "hidden",
      shadowColor: "#000", shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    },
    row: { flexDirection: "row", alignItems: "center", paddingLeft: 14, minHeight: 48 },
    iconTile: { width: 29, height: 29, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    rowBody: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginLeft: 12, paddingRight: 14, minHeight: 48, gap: 10,
    },
    rowLabel: { fontSize: 15.5, fontFamily: FONT_MEDIUM },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    rowValue: { fontSize: 15.5, fontFamily: FONT_MEDIUM, flexShrink: 1 },
    idWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    idText: { fontSize: 14, fontFamily: FONT_MONO },
    shareText: { fontSize: 15, fontFamily: FONT_DEMI, fontWeight: "600" },
    allergyText: {
      fontSize: 14.5, fontFamily: FONT_DEMI, fontWeight: "600",
      paddingLeft: 55, paddingRight: 14, paddingBottom: 12, marginTop: -6,
    },

    // segmented control
    seg: { flexDirection: "row", borderRadius: 9, padding: 2, width: 180 },
    segItem: { flex: 1, alignItems: "center", paddingVertical: 5, borderRadius: 7 },
    segItemOn: {
      shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    segText: { fontSize: 13, fontFamily: FONT_DEMI, fontWeight: "600" },

    // delete
    deleteGroup: { marginTop: 26 },
    deleteRow: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    deleteText: { fontSize: 15.5, fontFamily: FONT_MEDIUM, fontWeight: "500" },

    appFooter: { alignItems: "center", marginTop: 22 },
    appFooterName: { fontSize: 12.5, fontFamily: FONT_DEMI },
    appFooterVersion: { fontSize: 11.5, fontFamily: FONT_MEDIUM, marginTop: 3 },

    // modals (unchanged)
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