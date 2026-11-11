import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Platform, TouchableOpacity, Pressable,
  Modal, TextInput, Alert, ActivityIndicator, Image, ScrollView,
  Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Cloud, Mars, Venus, AlertTriangle } from "lucide-react-native";
import GlassButton from "./components/GlassButton";
import AvatarStack from "./components/AvatarStack";
import { Profile, Gender, initDatabase, getProfiles, addProfile, fullName } from "../db/profiles";
import { useTheme, ThemeColors } from "../context/ThemeContext";
import {
  backupToDrive,
  restoreFromDrive,
  debugListDriveAppData,
  debugFetchDriveBackupContent,
  getConnectedAccountEmail,
  getSavedPassphrase,
  savePassphrase,
  isErrorWithCode,
  statusCodes,
} from "../lib/googleDrive";

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

export default function ProfileScreen({ onSelectProfile }: Props) {
  const { colors, resolvedScheme } = useTheme();
  const styles = createStyles(colors);
  const isDark = resolvedScheme === "dark";
  const blue = isDark ? "#0A84FF" : "#007AFF";
  const red = isDark ? "#FF453A" : "#FF3B30";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [allergies, setAllergies] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [drivePending, setDrivePending] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR - 25);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);

  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [passphrasePurpose, setPassphrasePurpose] = useState<"backup" | "restore">("backup");
  const passphraseResolver = useRef<((value: string | null) => void) | null>(null);

  const atCapacity = profiles.length >= MAX_PROFILES;

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

  const refreshConnectedAccount = useCallback(async () => {
    const email = await getConnectedAccountEmail();
    setConnectedEmail(email);
  }, []);

  useEffect(() => {
    loadProfiles();
    refreshConnectedAccount();
  }, [loadProfiles, refreshConnectedAccount]);

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

  function promptForPassphrase(purpose: "backup" | "restore"): Promise<string | null> {
    setPassphrasePurpose(purpose);
    setPassphraseInput("");
    setPassphraseVisible(true);
    return new Promise((resolve) => {
      passphraseResolver.current = resolve;
    });
  }

  function submitPassphrase() {
    setPassphraseVisible(false);
    passphraseResolver.current?.(passphraseInput.trim() || null);
    passphraseResolver.current = null;
  }

  function cancelPassphrase() {
    setPassphraseVisible(false);
    passphraseResolver.current?.(null);
    passphraseResolver.current = null;
  }

  async function handleConnectDrive() {
    if (drivePending) return;
    setDrivePending(true);
    try {
      let passphrase = await getSavedPassphrase();

      if (profiles.length === 0) {
        if (!passphrase) {
          passphrase = await promptForPassphrase("restore");
          if (!passphrase) return;
        }
        const result = await restoreFromDrive(passphrase);
        if (result.status === "no-backup") {
          Alert.alert("No backup found", "We checked your Google Drive but didn't find a Skairo Health backup yet.");
        } else if (result.status === "already-has-data") {
          Alert.alert("Already have profiles", "Restore is only offered on an empty device, to avoid creating duplicates.");
        } else {
          await savePassphrase(passphrase);
          await loadProfiles();
          Alert.alert("Restored", `Brought back ${result.restoredProfiles} profile(s) and ${result.restoredRecords} reading(s) from Drive.`);
        }
      } else {
        if (!passphrase) {
          passphrase = await promptForPassphrase("backup");
          if (!passphrase) return;
        }
        const result = await backupToDrive(passphrase);
        await savePassphrase(passphrase);
        Alert.alert("Backed up", `Saved ${result.profileCount} profile(s) and ${result.recordCount} reading(s) to your Google Drive, encrypted.`);
      }
      // The account may have just been signed into for the first time, or
      // switched — refresh the label so it's never stale.
      await refreshConnectedAccount();
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
        // user backed out of the Google sign-in sheet — nothing to show
      } else {
        Alert.alert("Google Drive error", (e as Error).message);
      }
    } finally {
      setDrivePending(false);
    }
  }

  async function handleDebugCheckDrive() {
    try {
      const [result, email] = await Promise.all([debugListDriveAppData(), getConnectedAccountEmail()]);
      const accountLine = `Connected account: ${email ?? "none signed in"}\n\n`;
      Alert.alert("Drive App Data (debug)", accountLine + result, [
        { text: "Close", style: "cancel" },
        { text: "View Contents", onPress: handleViewBackupContent },
      ]);
    } catch (e) {
      Alert.alert("Drive check failed", (e as Error).message);
    }
  }

  async function handleViewBackupContent() {
    try {
      const passphrase = await getSavedPassphrase();
      const content = await debugFetchDriveBackupContent(passphrase ?? undefined);
      Alert.alert("Backup File Contents", content);
    } catch (e) {
      Alert.alert("Couldn't read backup content", (e as Error).message);
    }
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
      {/* header — brand label, large title, glass buttons */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.brand, { color: blue }]}>SKAIRO HEALTH</Text>
          <Text style={styles.title}>{profiles.length ? "Profile" : "Welcome"}</Text>
                    <View style={styles.countRow}>
            {profiles.length > 0 && (
              <AvatarStack
                people={profiles.map((p) => ({ id: p.id, name: fullName(p), photoUri: p.photoUri }))}
                max={3}
                size={24}
                ringColor={colors.background}
                overflowBg={isDark ? "#2C2C2E" : "#F2F2F5"}
                overflowText={colors.text}
              />
            )}
            <Text style={styles.countText}>
              {profiles.length} of {MAX_PROFILES} profiles
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <GlassButton
            onPress={handleConnectDrive}
            onLongPress={handleDebugCheckDrive}
            disabled={drivePending}
            isDark={isDark}
            accessibilityLabel={connectedEmail ? "Back up to Google Drive" : "Connect Google Drive"}
          >
            {drivePending ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Cloud color={colors.text} size={19} strokeWidth={2.2} />
            )}
          </GlassButton>
          <GlassButton onPress={openAdd} isDark={isDark} accessibilityLabel="Add profile">
            <Plus color={colors.text} size={21} strokeWidth={2.4} />
          </GlassButton>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.text} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {profiles.map((item) => {
              const initials = `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.cell, pressed && { transform: [{ scale: 0.96 }] }]}
                  onPress={() => onSelectProfile(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${fullName(item)}`}
                >
                  <View style={[styles.avatar, { backgroundColor: isDark ? "#5B6577" : "#8E99AB" }]}>
                    {item.photoUri ? (
                      <Image source={{ uri: item.photoUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initials}</Text>
                    )}
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.firstName}
                  </Text>
                  {item.allergies ? (
                    <View style={styles.allergyRow}>
                      <AlertTriangle color={red} fill={red} size={11} strokeWidth={0} />
                      <Text style={[styles.allergyText, { color: red }]} numberOfLines={1}>
                        {item.allergies}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noAllergy}>No allergies</Text>
                  )}
                </Pressable>
              );
            })}

            {!atCapacity && (
              <Pressable
                style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
                onPress={openAdd}
                accessibilityRole="button"
                accessibilityLabel="Add profile"
              >
                <View style={[styles.addCircle, { borderColor: isDark ? "#48484A" : "#C7C7CC" }]}>
                  <Plus color={colors.textMuted} size={30} strokeWidth={2} />
                </View>
                <Text style={[styles.name, { color: colors.textMuted }]}>
                  {profiles.length === 0 ? "Add profile" : "Add another"}
                </Text>
              </Pressable>
            )}
          </View>

          {atCapacity && (
            <Text style={styles.note}>You've reached the {MAX_PROFILES}-profile limit.</Text>
          )}
          {profiles.length === 0 && (
            <Text style={styles.note}>Add a profile for each person who uses this device.</Text>
          )}

          {/* Google Drive status — one quiet line */}
          <Pressable onPress={handleConnectDrive} disabled={drivePending} style={styles.driveRow}>
            <View style={[styles.driveDot, { backgroundColor: connectedEmail ? "#34C759" : colors.textFaint }]} />
            <Text style={styles.driveText} numberOfLines={1}>
              {connectedEmail ? `Backing up to ${connectedEmail}` : "Google Drive backup off · "}
              {!connectedEmail && <Text style={{ color: blue, fontFamily: FONT_DEMI }}>Connect</Text>}
            </Text>
          </Pressable>
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

      <Modal visible={passphraseVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>
                {passphrasePurpose === "backup" ? "Set a backup passphrase" : "Enter your backup passphrase"}
              </Text>
              <Text style={styles.passphraseHint}>
                {passphrasePurpose === "backup"
                  ? "Your vitals are encrypted before upload. Remember this — you'll need it to restore on another device."
                  : "Enter the passphrase you used when this backup was created."}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Passphrase"
                placeholderTextColor={colors.textFaint}
                value={passphraseInput}
                onChangeText={setPassphraseInput}
                secureTextEntry
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelPassphrase}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={submitPassphrase}
                  disabled={passphraseInput.trim().length < 4}
                >
                  <Text style={styles.saveText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
    header: {
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
      paddingHorizontal: 20, gap: 12,
    },
    headerText: { flex: 1 },
    headerButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
    brand: { fontSize: 13, fontFamily: FONT_BOLD, fontWeight: "700", letterSpacing: 0.4 },
    title: {
      fontSize: 32, fontFamily: FONT_BOLD, fontWeight: "700", color: colors.text,
      letterSpacing: -0.5, marginTop: 2, lineHeight: 38,
    },
        countRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    countText: { fontSize: 14, color: colors.textMuted, fontFamily: FONT_MEDIUM },

    scrollContent: { paddingTop: 30, paddingHorizontal: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 26 },
    cell: { width: "50%", alignItems: "center" },
    avatar: {
      width: 112, height: 112, borderRadius: 56,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 4 },
      }),
    },
    avatarImage: { width: 112, height: 112, borderRadius: 56 },
    avatarText: { color: "#FFFFFF", fontSize: 38, fontFamily: FONT_DEMI, fontWeight: "600" },
    name: {
      marginTop: 10, fontSize: 16, fontFamily: FONT_DEMI, fontWeight: "600", color: colors.text,
      textAlign: "center", maxWidth: 150,
    },
    allergyRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, maxWidth: 150 },
    allergyText: { fontSize: 12.5, fontFamily: FONT_DEMI, fontWeight: "600" },
    noAllergy: { fontSize: 12.5, fontFamily: FONT_MEDIUM, color: colors.textFaint, marginTop: 2 },
    addCircle: {
      width: 112, height: 112, borderRadius: 56, borderWidth: 1.5, borderStyle: "dashed",
      alignItems: "center", justifyContent: "center",
    },
    note: {
      fontSize: 13, fontFamily: FONT_MEDIUM, color: colors.textMuted, textAlign: "center", marginTop: 24,
    },
    driveRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 34,
    },
    driveDot: { width: 7, height: 7, borderRadius: 4 },
    driveText: { fontSize: 12.5, fontFamily: FONT_MEDIUM, color: colors.textMuted, flexShrink: 1 },
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
    passphraseHint: {
      fontSize: 12,
      fontFamily: FONT_MEDIUM,
      color: colors.textMuted,
      marginBottom: 12,
      lineHeight: 17,
    },
  });
}