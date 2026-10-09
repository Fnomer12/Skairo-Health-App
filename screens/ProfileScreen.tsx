import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Platform, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Image, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, ChevronRight, Cloud, Mars, Venus } from "lucide-react-native";
import { Profile, Gender, initDatabase, getProfiles, addProfile, fullName } from "../db/profiles";

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
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.cloudButton} onPress={handleConnectDrive}>
            <Cloud color="#000000" size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, atCapacity && styles.addButtonDisabled]}
            onPress={openAdd}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus color="#ffffff" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#000000" />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[styles.list, { paddingBottom: 40 + insets.bottom }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No profiles yet.</Text>
              <Text style={styles.emptySub}>Tap the + button to add the first profile.</Text>
            </View>
          }
          ListFooterComponent={
            !atCapacity ? (
              <TouchableOpacity style={styles.addPlaceholder} onPress={openAdd}>
                <View style={styles.addPlaceholderIcon}>
                  <Plus color="#9a9a9a" size={18} />
                </View>
                <Text style={styles.addPlaceholderText}>
                  Add another profile ({MAX_PROFILES - profiles.length} slot{MAX_PROFILES - profiles.length === 1 ? "" : "s"} left)
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.capacityNote}>You've reached the {MAX_PROFILES}-profile limit.</Text>
            )
          }
          renderItem={({ item }) => {
            const initials = `${item.firstName?.[0] ?? ""}${item.lastName?.[0] ?? ""}`.toUpperCase();
            return (
              <TouchableOpacity style={styles.row} onPress={() => onSelectProfile(item)}>
                <View style={styles.avatar}>
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initials}</Text>
                  )}
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowName}>{fullName(item)}</Text>
                  {item.allergies ? (
                    <Text style={styles.rowSub} numberOfLines={1}>Allergies: {item.allergies}</Text>
                  ) : (
                    <Text style={styles.rowSub}>No allergies noted</Text>
                  )}
                </View>
                <ChevronRight color="#c7c7c7" size={20} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={addVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New profile</Text>
            <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />

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
                <Mars color={gender === "Male" ? "#ffffff" : "#6b6b6b"} size={16} />
                <Text style={[styles.genderButtonText, gender === "Male" && styles.genderButtonTextActive]}>
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === "Female" && styles.genderButtonActive]}
                onPress={() => setGender("Female")}
              >
                <Venus color={gender === "Female" ? "#ffffff" : "#6b6b6b"} size={16} />
                <Text style={[styles.genderButtonText, gender === "Female" && styles.genderButtonTextActive]}>
                  Female
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Allergies (e.g. peanuts, penicillin)"
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
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", paddingTop: 60 },
  brandTitle: {
    textAlign: "center",
    fontSize: 26,
    fontFamily: FONT_BOLD,
    fontWeight: "800",
    color: "#000000",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000" },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 10 },
  countText: { fontSize: 12, color: "#9a9a9a", fontFamily: FONT_MEDIUM, marginTop: 2 },
  cloudButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f2f2f2",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  addButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#000000",
    alignItems: "center", justifyContent: "center",
  },
  addButtonDisabled: { backgroundColor: "#cfcfcf" },
  addPlaceholder: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: "#d0d0d0", borderStyle: "dashed",
    paddingVertical: 18, marginTop: 4,
  },
  addPlaceholderIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#f2f2f2",
    alignItems: "center", justifyContent: "center",
  },
  addPlaceholderText: { fontSize: 13, fontFamily: FONT_MEDIUM, color: "#9a9a9a" },
  capacityNote: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#9a9a9a", textAlign: "center", marginTop: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { marginTop: 60, alignItems: "center", paddingHorizontal: 30 },
  emptyText: { fontSize: 16, fontFamily: FONT_DEMI, color: "#000000", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#9a9a9a", textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#f2f2f2", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#e0e0e0",
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#000000",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: "#ffffff", fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700" },
  rowTextWrap: { flex: 1 },
  rowName: { fontSize: 16, fontFamily: FONT_DEMI, color: "#000000" },
  rowSub: { fontSize: 12, color: "#9a9a9a", marginTop: 2, fontFamily: FONT_MEDIUM },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "85%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: "#000000" },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  dobRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10,
  },
  dobRowLabel: { fontSize: 14, fontFamily: FONT_MEDIUM, color: "#6b6b6b" },
  dobRowValue: { fontSize: 14, fontFamily: FONT_DEMI, color: "#000000" },
  genderLabel: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#6b6b6b", marginBottom: 6 },
  genderRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  genderButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#f8f8f8",
  },
  genderButtonActive: { backgroundColor: "#000000", borderColor: "#000000" },
  genderButtonText: { fontSize: 14, fontFamily: FONT_MEDIUM, color: "#6b6b6b" },
  genderButtonTextActive: { color: "#ffffff", fontFamily: FONT_DEMI },
  pickerRow: { flexDirection: "row", height: 180, marginBottom: 12, gap: 6 },
  pickerColumn: {
    flex: 1, backgroundColor: "#f8f8f8", borderRadius: 10, borderWidth: 1, borderColor: "#e0e0e0",
  },
  pickerColumnWide: { flex: 1.6 },
  pickerItem: { paddingVertical: 10, alignItems: "center" },
  pickerItemText: { fontSize: 14, fontFamily: FONT_MEDIUM, color: "#9a9a9a" },
  pickerItemTextActive: { color: "#000000", fontFamily: FONT_BOLD, fontWeight: "700" },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 10 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelButton: { backgroundColor: "#f2f2f2" },
  cancelText: { fontFamily: FONT_DEMI, color: "#000000" },
  saveButton: { backgroundColor: "#000000" },
  saveText: { fontFamily: FONT_DEMI, color: "#ffffff" },
});