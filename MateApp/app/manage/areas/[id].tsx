import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, FlatList } from 'react-native';
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
  const [saving, setSaving] = useState(false);
  const [showAddStop, setShowAddStop] = useState(false);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [stopSearch, setStopSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!id) return;
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
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleDeleteArea = () => {
    let message = `Delete "${name}"?`;
    if (journeyCount > 0) {
      message = `This area is linked to ${journeyCount} journey(s). The area will be removed from all journeys and start/end references will be cleared.\n\n${message}`;
    }
    if (stops.length > 0 && journeyCount === 0) {
      message = `This area has ${stops.length} stop(s). They will be unlinked from the area.\n\n${message}`;
    }
    Alert.alert('Delete Area', message, [
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

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await AreaRepository.updateName(id!, name.trim());
    setSaving(false);
    Alert.alert('Saved', 'Area name updated.');
  };

  const handleOpenAddStop = async () => {
    const existing = await StopRepository.getAll();
    const linkedIds = new Set(stops.map(s => s.id));
    setAllStops(existing.filter(s => !linkedIds.has(s.id)));
    setStopSearch('');
    setShowAddStop(true);
  };

  const handleAddStop = async (stop: Stop) => {
    await AreaStopRepository.create(id!, stop.id);
    setShowAddStop(false);
    await refresh();
    Alert.alert('Added', `"${stop.label}" added to this area.`);
  };

  const filteredAddStops = stopSearch.trim()
    ? allStops.filter(s => s.label.toLowerCase().includes(stopSearch.toLowerCase()))
    : allStops;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Area Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Area name" placeholderTextColor="#9CA3AF" />
        <TouchableOpacity style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]} onPress={handleSaveName} disabled={!name.trim() || saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Name'}</Text>
        </TouchableOpacity>

        {journeyName ? (
          <Text style={styles.readonly}>Journey: {journeyName}</Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stops ({stops.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddStop}>
            <Text style={styles.addBtnText}>+ Add Stop</Text>
          </TouchableOpacity>
        </View>
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

      <Modal visible={showAddStop} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowAddStop(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Existing Stop</Text>
            <TouchableOpacity onPress={() => setShowAddStop(false)}>
              <Text style={styles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalSearch}
            value={stopSearch}
            onChangeText={setStopSearch}
            placeholder="Search stops..."
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          <FlatList
            data={filteredAddStops}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalOption} onPress={() => handleAddStop(item)}>
                <View>
                  <Text style={styles.modalOptionLabel}>{item.label}</Text>
                  <Text style={styles.modalOptionSub}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No matching stops found.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#D1D5DB', color: '#111827', marginBottom: 8 },
  saveBtn: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  addBtn: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  readonly: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  empty: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  stopLabel: { fontSize: 14, fontWeight: '500', color: '#111827' },
  removeBtn: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  chip: { alignSelf: 'flex-start', backgroundColor: '#EBF5FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 6 },
  chipText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  doneBtn: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  modalSearch: { margin: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#D1D5DB', color: '#111827' },
  modalOption: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalOptionLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  modalOptionSub: { fontSize: 13, color: '#6B7280' },
});
