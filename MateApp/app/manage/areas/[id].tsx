import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { AreaRepository, StopRepository, AreaStopRepository, AreaFareLevelRepository, JourneyRepository, JourneyAreaRepository } from '../../../adapters/index';
import { Stop, FareLevel } from '@mateapp/core';

export default function AreaEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [fareLevels, setFareLevels] = useState<FareLevel[]>([]);
  const [journeyName, setJourneyName] = useState('');
  const [journeyCount, setJourneyCount] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    (async () => {
      const area = await AreaRepository.getById(id);
      if (!area) return router.back();
      setName(area.name);
      const s = await StopRepository.findByArea(area.id);
      setStops(s);
      const fl = await AreaFareLevelRepository.getByArea(area.id);
      setFareLevels(fl);
      const journeys = await JourneyRepository.getAll();
      let linkedCount = 0;
      for (const j of journeys) {
        const jas = await JourneyAreaRepository.getByJourney(j.id);
        if (jas.some(ja => ja.area_id === id)) {
          linkedCount++;
          if (!journeyName) setJourneyName(j.name);
        }
      }
      setJourneyCount(linkedCount);
    })();
  }, [id]));

  const handleDeleteArea = () => {
    if (journeyCount > 0) {
      Alert.alert('Cannot Delete', `This area is linked to ${journeyCount} journey(s). Remove it from all journeys first.`);
      return;
    }
    if (stops.length > 0) {
      Alert.alert('Cannot Delete', 'Remove all stops from this area first.');
      return;
    }
    Alert.alert('Delete Area', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await AreaRepository.delete(id!);
        router.back();
      }},
    ]);
  };

  const handleRemoveStop = async (stopId: string) => {
    const areaStop = await AreaStopRepository.getByAreaAndStop(id!, stopId);
    if (areaStop) {
      await AreaStopRepository.delete(areaStop.id);
      setStops(prev => prev.filter(s => s.id !== stopId));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Area Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} editable={false} />

        {journeyName ? (
          <Text style={styles.readonly}>Journey: {journeyName}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Stops ({stops.length})</Text>
        {stops.length === 0 ? (
          <Text style={styles.empty}>No stops in this area.</Text>
        ) : (
          stops.map(stop => (
            <View key={stop.id} style={styles.stopRow}>
              <Text style={styles.stopLabel}>{stop.label}</Text>
              <TouchableOpacity onPress={() => handleRemoveStop(stop.id)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Fare Levels</Text>
        {fareLevels.length === 0 ? (
          <Text style={styles.empty}>No fare levels linked.</Text>
        ) : (
          fareLevels.map(fl => (
            <View key={fl.id} style={styles.chip}>
              <Text style={styles.chipText}>{fl.label} — GHS {fl.amount.toFixed(2)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteArea}>
          <Text style={styles.deleteBtnText}>Delete Area</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, color: '#6B7280', marginBottom: 8 },
  readonly: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  empty: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  stopLabel: { fontSize: 14, fontWeight: '500', color: '#111827' },
  removeBtn: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  chip: { alignSelf: 'flex-start', backgroundColor: '#EBF5FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 6 },
  chipText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
