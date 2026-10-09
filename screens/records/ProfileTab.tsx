import React, { useState } from "react";
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView,
} from "react-native";
import { Pencil, Trash2, Camera, Calendar, Mars, Venus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Profile, Gender, updateProfile, deleteProfile, calculateAge } from "../../db/profiles";

type Props = {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  onProfileDeleted: () => void;
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

export default function ProfileTab({ profile, onProfileUpdated, onProfileDeleted }: Props) {
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.list}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} disabled={photoBusy}>
          <View style={styles.avatarCircle}>
            {photoBusy ? (
              <ActivityIndicator color="#ffffff" />
            ) : profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Camera color="#ffffff" size={12} strokeWidth={2.4} />
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>
          {profile.firstName} {profile.lastName}
        </Text>

        <TouchableOpacity style={styles.editButton} onPress={openEdit}>
          <Pencil color="#000000" size={14} />
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Profile ID</Text>
            <Text style={styles.infoValue}>{profile.publicId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender</Text>
            <View style={styles.infoGenderValue}>
              {profile.gender === "Male" && <Mars color="#000000" size={14} />}
              {profile.gender === "Female" && <Venus color="#000000" size={14} />}
              <Text style={styles.infoValue}>{profile.gender ?? "Not set"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.dobCard} onPress={openDobPicker}>
          <View style={styles.dobTextWrap}>
            <Text style={styles.dobLabel}>Date of birth</Text>
            {profile.dateOfBirth ? (
              <Text style={styles.dobValue}>
                {formatDob(profile.dateOfBirth)} <Text style={styles.dobAge}>· Age {age}</Text>
              </Text>
            ) : (
              <Text style={styles.dobPlaceholder}>Tap to set date of birth</Text>
            )}
          </View>
          <Calendar color="#6b6b6b" size={18} />
        </TouchableOpacity>

        <View style={styles.allergyCard}>
          <Text style={styles.allergyLabel}>Allergies</Text>
          <Text style={styles.allergyValue}>
            {profile.allergies && profile.allergies.length > 0 ? profile.allergies : "None specified"}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color="#c62828" />
          ) : (
            <>
              <Trash2 color="#c62828" size={16} />
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
            <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />

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
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
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
                {savingDob ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Done</Text>}
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
  container: { flex: 1, backgroundColor: "#ffffff" },
  scrollView: { flex: 1 },
  list: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, alignItems: "center" },
  avatarWrapper: { marginBottom: 14 },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: "#000000",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { color: "#ffffff", fontSize: 30, fontFamily: FONT_BOLD, fontWeight: "700" },
  cameraBadge: {
    position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#000000", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#ffffff",
  },
  name: { fontSize: 20, fontFamily: FONT_BOLD, fontWeight: "700", color: "#000000", marginBottom: 10 },
  editButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f2f2f2", borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 20,
  },
  editButtonText: { fontSize: 13, fontFamily: FONT_MEDIUM, color: "#000000" },
  infoCard: {
    width: "100%", backgroundColor: "#f8f8f8", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0",
    padding: 14, marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, fontFamily: FONT_MEDIUM, color: "#6b6b6b" },
  infoValue: { fontSize: 13, fontFamily: FONT_DEMI, color: "#000000" },
  infoGenderValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  dobCard: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#f8f8f8", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0",
    padding: 14, marginBottom: 12,
  },
  dobTextWrap: { flex: 1 },
  dobLabel: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#6b6b6b", marginBottom: 4 },
  dobValue: { fontSize: 15, fontFamily: FONT_DEMI, color: "#000000" },
  dobAge: { fontSize: 13, fontFamily: FONT_MEDIUM, color: "#9a9a9a" },
  dobPlaceholder: { fontSize: 14, fontFamily: FONT_MEDIUM, color: "#9a9a9a" },
  allergyCard: {
    width: "100%", backgroundColor: "#f8f8f8", borderRadius: 14, borderWidth: 1, borderColor: "#e0e0e0",
    padding: 14, marginBottom: 12,
  },
  allergyLabel: { fontSize: 12, fontFamily: FONT_MEDIUM, color: "#6b6b6b", marginBottom: 4 },
  allergyValue: { fontSize: 14, fontFamily: FONT_MEDIUM, color: "#000000" },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: "#e0e0e0", backgroundColor: "#ffffff",
  },
  deleteButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 12, backgroundColor: "#fdecea",
    borderWidth: 1, borderColor: "#f3c6c2",
  },
  deleteButtonText: { fontSize: 14, fontFamily: FONT_DEMI, color: "#c62828" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "85%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontFamily: FONT_BOLD, fontWeight: "700", marginBottom: 14, color: "#000000" },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, fontSize: 14, fontFamily: FONT_MEDIUM,
  },
  textArea: { height: 80, textAlignVertical: "top" },
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