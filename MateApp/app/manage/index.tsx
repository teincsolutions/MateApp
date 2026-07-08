import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { StopRepository, AreaRepository, JourneyRepository } from '../../adapters/index';

export default function ManageIndexScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState({ stops: 0, areas: 0, journeys: 0 });

  useEffect(() => {
    (async () => {
      const [stops, areas, journeys] = await Promise.all([
        StopRepository.getAll(),
        AreaRepository.getAll(),
        JourneyRepository.getAll(),
      ]);
      setCounts({ stops: stops.length, areas: areas.length, journeys: journeys.length });
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Manage Data</Text>
        <Text style={styles.subtitle}>View and edit stops, areas, and fare levels.</Text>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/manage/stops')}>
            <Text style={styles.cardCount}>{counts.stops}</Text>
            <Text style={styles.cardTitle}>Stops</Text>
            <Text style={styles.cardDesc}>View and edit stop labels and radius</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/manage/areas')}>
            <Text style={styles.cardCount}>{counts.areas}</Text>
            <Text style={styles.cardTitle}>Areas</Text>
            <Text style={styles.cardDesc}>Edit names and manage linked stops</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.fullcard} onPress={() => router.push('/manage/fare-levels')}>
          <Text style={styles.fullcardTitle}>Fare Levels</Text>
          <Text style={styles.fullcardDesc}>Manage journey fare levels — select a journey to view or edit</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 28 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardCount: { fontSize: 32, fontWeight: '700', color: '#2563EB', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#6B7280' },
  fullcard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  fullcardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  fullcardDesc: { fontSize: 13, color: '#6B7280' },
});
