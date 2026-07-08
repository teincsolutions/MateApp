import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { JourneyRepository, AreaFareLevelRepository } from '../../../adapters/index';
import { Journey, FareLevel } from '@mateapp/core';

export default function FareLevelsIndexScreen() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [levels, setLevels] = useState<FareLevel[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => { setJourneys(await JourneyRepository.getAll()); })();
  }, []));

  const handleSelectJourney = async (j: Journey) => {
    setSelectedJourney(j);
    const fl = await AreaFareLevelRepository.getByJourney(j.id);
    setLevels(fl);
  };

  return (
    <View style={styles.container}>
      {!selectedJourney ? (
        <FlatList
          data={journeys}
          keyExtractor={j => j.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleSelectJourney(item)}>
              <View>
                <Text style={styles.rowLabel}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.status}</Text>
              </View>
              <Text style={styles.rowArrow}>&gt;</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={<Text style={styles.header}>Select a Journey</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No journeys found.</Text>}
        />
      ) : (
        <FlatList
          data={levels}
          keyExtractor={l => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/manage/fare-levels/[id]', params: { id: item.id } })}>
              <View>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>Order: {item.order_no} · GHS {item.amount.toFixed(2)}</Text>
              </View>
              <Text style={styles.rowArrow}>&gt;</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <Text style={styles.header}>{selectedJourney.name} Fare Levels</Text>
          }
          ListEmptyComponent={<Text style={styles.empty}>No fare levels for this journey.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16 },
  header: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  headerRow: { marginBottom: 12 },
  backLink: { fontSize: 15, color: '#2563EB', fontWeight: '500', marginBottom: 8 },
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
