import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { StopRepository, AreaStopRepository, AreaRepository } from '../../adapters/index';
import { Stop } from '@mateapp/core';

export default function StopsListScreen() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = async () => { setStops(await StopRepository.getAll()); };

  useFocusEffect(useCallback(() => { refresh(); }, []));

  const filtered = search.trim()
    ? stops.filter(s => s.label.toLowerCase().includes(search.toLowerCase()))
    : stops;

  const handleDelete = async (stop: Stop) => {
    setDeleting(stop.id);
    const links = await AreaStopRepository.getByStop(stop.id);
    const areaNames: string[] = [];
    for (const l of links) {
      const a = await AreaRepository.getById(l.area_id);
      if (a) areaNames.push(a.name);
    }

    const message = areaNames.length > 0
      ? `This stop is linked to: ${areaNames.join(', ')}.\n\nDeleting it will also remove it from these areas. Continue?`
      : `Delete "${stop.label}"?`;

    Alert.alert('Delete Stop', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => setDeleting(null) },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await StopRepository.delete(stop.id);
        setStops(prev => prev.filter(s => s.id !== stop.id));
        setDeleting(null);
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search stops..." placeholderTextColor="#9CA3AF" />
      <FlatList
        data={filtered}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowContent} onPress={() => router.push({ pathname: '/manage/stops/[id]', params: { id: item.id } })}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowSub}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}  ·  {item.radius}m radius</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} disabled={deleting !== null}>
              <Text style={styles.deleteBtnText}>{deleting === item.id ? '...' : 'Del'}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No stops found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  search: {
    margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#D1D5DB', color: '#111827',
  },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  rowContent: { flex: 1, padding: 14 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSub: { fontSize: 13, color: '#6B7280' },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  deleteBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
});
