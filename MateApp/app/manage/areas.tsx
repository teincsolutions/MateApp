import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { AreaRepository, StopRepository } from '../../adapters/index';
import { Area } from '@mateapp/core';

export default function AreasListScreen() {
  const router = useRouter();
  const [areas, setAreas] = useState<(Area & { stopCount: number })[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const all = await AreaRepository.getAll();
      const withCounts = await Promise.all(all.map(async (a) => {
        const stops = await StopRepository.findByArea(a.id);
        return { ...a, stopCount: stops.length };
      }));
      setAreas(withCounts);
    })();
  }, []));

  return (
    <View style={styles.container}>
      <FlatList
        data={areas}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/manage/areas/[id]', params: { id: item.id } })}>
            <View>
              <Text style={styles.rowLabel}>{item.name}</Text>
              <Text style={styles.rowSub}>{item.stopCount} stops · {item.polygon ? 'Has polygon' : 'No polygon'}</Text>
            </View>
            <Text style={styles.rowArrow}>&gt;</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No areas found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16 },
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
