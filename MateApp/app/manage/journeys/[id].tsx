import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  JourneyRepository,
  AreaRepository,
  StopRepository,
  JourneyAreaRepository,
} from "../../../adapters/index";

export default function JourneyEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [areaCount, setAreaCount] = useState(0);
  const [stopCount, setStopCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    const journey = await JourneyRepository.getById(id);
    if (!journey) return router.back();
    setName(journey.name);
    setStatus(journey.status);
    setCreatedAt(journey.created_at);

    const jas = await JourneyAreaRepository.getByJourney(id);
    setAreaCount(jas.length);

    let sc = 0;
    for (const ja of jas) {
      const stops = await StopRepository.findByArea(ja.area_id);
      sc += stops.length;
    }
    setStopCount(sc);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await JourneyRepository.updateName(id!, name.trim());
    setSaving(false);
    Alert.alert("Saved", "Journey name updated.");
  };

  const handleComplete = () => {
    Alert.alert(
      "Complete Journey",
      "Mark this journey as completed? Tracking will stop.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            await JourneyRepository.updateStatus(id!, "completed");
            setStatus("completed");
            Alert.alert("Completed", "Journey has been marked as completed.");
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Journey",
      `Delete "${name}"? This will permanently remove this journey and all associated data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await JourneyRepository.delete(id!);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Journey Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Journey name"
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
          onPress={handleSaveName}
          disabled={!name.trim() || saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Update Name"}
          </Text>
        </TouchableOpacity>

        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>
              {status === "draft" ? "Draft" : "Completed"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>
              {new Date(createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Areas</Text>
            <Text style={styles.infoValue}>{areaCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stops</Text>
            <Text style={styles.infoValue}>{stopCount}</Text>
          </View>
        </View>

        {status === "draft" && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
            <Text style={styles.completeBtnText}>Complete Journey</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Journey</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { padding: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    color: "#111827",
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  infoBlock: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: { fontSize: 14, color: "#6B7280" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  completeBtn: {
    backgroundColor: "#D1FAE5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  completeBtnText: { color: "#065F46", fontSize: 15, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteBtnText: { color: "#DC2626", fontSize: 15, fontWeight: "600" },
});
