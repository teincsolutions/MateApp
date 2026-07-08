import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { StopRepository } from '../../adapters/index';
import { Stop } from '@mateapp/core';

export default function StopsListScreen() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => { setStops(await StopRepository.getAll()); })();
  }, []));

  const filtered = search.trim()
    ? stops.filter(s => s.label.toLowerCase().includes(search.toLowerCase()))
    : stops;

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search stops..." placeholderTextColor="#9CA3AF" />
      <FlatList
        data={filtered}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/manage/stops/[id]', params: { id: item.id } })}>
            <View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowSub}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}  ·  {item.radius}m radius</Text>
            </View>
            <Text style={styles.rowArrow}>&gt;</Text>
          </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSub: { fontSize: 13, color: '#6B7280' },
  rowArrow: { fontSize: 16, color: '#D1D5DB' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
});
