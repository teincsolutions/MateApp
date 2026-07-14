import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { StopRepository, AreaStopRepository, AreaRepository } from '../../../adapters/index';
import { Stop } from '@mateapp/core';

export default function StopEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stop, setStop] = useState<Stop | null>(null);
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState('');
  const [linkedAreas, setLinkedAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    (async () => {
      const s = await StopRepository.getById(id);
      if (!s) return router.back();
      setStop(s);
      setLabel(s.label);
      setRadius(String(s.radius));
      const links = await AreaStopRepository.getByStop(s.id);
      const names: string[] = [];
      for (const l of links) {
        const a = await AreaRepository.getById(l.area_id);
        if (a) names.push(a.name);
      }
      setLinkedAreas(names);
    })();
  }, [id]));

  const handleSave = async () => {
    if (!stop || !label.trim()) return;
    setSaving(true);
    const newStop = await StopRepository.create(label.trim(), stop.latitude, stop.longitude, parseFloat(radius) || 50, stop.seq);
    for (const areaName of linkedAreas) {
      const area = await AreaRepository.getByName(areaName);
      if (area) {
        await AreaStopRepository.create(area.id, newStop.id);
      }
    }
    await StopRepository.delete(stop.id);
    setSaving(false);
    Alert.alert('Saved', 'Stop updated.');
    router.back();
  };

  const handleDelete = () => {
    const areaWarning = linkedAreas.length > 0
      ? `This stop is linked to: ${linkedAreas.join(', ')}.\n\nDeleting it will also remove it from these areas. Continue?`
      : 'This cannot be undone.';
    Alert.alert('Delete Stop', areaWarning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await StopRepository.delete(stop!.id);
        router.back();
      }},
    ]);
  };

  if (!stop) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Stop Label</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Stop label" placeholderTextColor="#9CA3AF" />

        <Text style={styles.sectionTitle}>GPS Coordinates (fixed)</Text>
        <Text style={styles.readonly}>{stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}</Text>

        <Text style={styles.sectionTitle}>Matching Radius (meters)</Text>
        <TextInput style={styles.input} value={radius} onChangeText={setRadius} placeholder="50" keyboardType="numeric" placeholderTextColor="#9CA3AF" />

        <Text style={styles.sectionTitle}>Linked Areas</Text>
        {linkedAreas.length === 0 ? (
          <Text style={styles.empty}>Not linked to any area.</Text>
        ) : (
          linkedAreas.map(name => (
            <View key={name} style={styles.chip}><Text style={styles.chipText}>{name}</Text></View>
          ))
        )}

        <TouchableOpacity style={[styles.saveBtn, (!label.trim() || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!label.trim() || saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Stop</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#D1D5DB', color: '#111827', marginBottom: 8 },
  readonly: { fontSize: 15, color: '#6B7280', marginBottom: 8 },
  empty: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  chip: { alignSelf: 'flex-start', backgroundColor: '#EBF5FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 6 },
  chipText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  saveBtn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
