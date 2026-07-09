import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { AreaFareLevelRepository } from '../../../adapters/index';
import { FareLevel } from '@mateapp/core';

export default function FareLevelEditScreen() {
  const router = useRouter();
  const { id, journeyId } = useLocalSearchParams<{ id: string; journeyId?: string }>();
  const isNew = id === 'new';
  const [level, setLevel] = useState<FareLevel | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id || isNew) return;
    (async () => {
      if (journeyId) {
        const fls = await AreaFareLevelRepository.getByJourney(journeyId);
        const found = fls.find(f => f.id === id);
        if (found) { setLevel(found); setLabel(found.label); setAmount(String(found.amount)); }
      }
    })();
  }, [id, journeyId, isNew]));

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const amt = parseFloat(amount) || 0;

    if (isNew) {
      if (!journeyId) return;
      const minLabel = label.trim();
      const levels = await AreaFareLevelRepository.getByJourney(journeyId);
      const nextOrder = levels.length > 0 ? Math.max(...levels.map(l => l.order_no)) + 1 : 0;
      const fl = await AreaFareLevelRepository.create(journeyId, minLabel, nextOrder, amt);
      Alert.alert('Created', `Fare level "${minLabel}" — GHS ${amt.toFixed(2)} created.`);
    } else {
      if (!level) return;
      await AreaFareLevelRepository.updateAmount(level.id, amt);
      Alert.alert('Saved', `Amount updated to GHS ${amt.toFixed(2)}. All stops referencing this level will use the new amount.`);
    }

    setSaving(false);
    router.back();
  };

  const handleDelete = async () => {
    if (isNew) return;
    Alert.alert('Delete Fare Level', 'Stops referencing this level will lose their fare reference.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await AreaFareLevelRepository.delete(level!.id);
        router.back();
      }},
    ]);
  };

  if (!isNew && !level) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Label</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="e.g. Minimum" placeholderTextColor="#9CA3AF" />

        <Text style={styles.sectionTitle}>Amount (GHS)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />

        {!isNew && (
          <Text style={styles.meta}>Updating the amount will immediately affect all stops across all areas that reference this level.</Text>
        )}

        <TouchableOpacity style={[styles.saveBtn, (!label.trim() || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!label.trim() || saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : isNew ? 'Create Fare Level' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Fare Level</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#D1D5DB', color: '#111827', marginBottom: 8 },
  meta: { fontSize: 13, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  saveBtn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
