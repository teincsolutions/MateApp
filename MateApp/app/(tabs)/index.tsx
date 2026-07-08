import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JourneyRepository } from '../../adapters/index';
import { Journey } from '@mateapp/core';

export default function HomeScreen() {
  const router = useRouter();
  const [draftJourney, setDraftJourney] = useState<Journey | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const drafts = await JourneyRepository.getByStatus('draft');
        setDraftJourney(drafts.length > 0 ? drafts[0] : null);
      })();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>MateApp</Text>
        <Text style={styles.subtitle}>Route Mapping</Text>

        {draftJourney && (
          <View style={styles.card}>
            <View>
              <Text style={styles.cardLabel}>Continue Journey</Text>
              <Text style={styles.cardTitle}>{draftJourney.name}</Text>
              <Text style={styles.cardStatus}>Draft - In Progress</Text>
            </View>
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={() => router.push({ pathname: '/mapping/index', params: { journeyId: draftJourney.id } })}
            >
              <Text style={styles.resumeButtonText}>Resume</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/journey/new')}>
          <Text style={styles.primaryButtonText}>+ New Journey</Text>
        </TouchableOpacity>

        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/validate')}>
            <Text style={styles.menuItemTitle}>Validate Fare</Text>
            <Text style={styles.menuItemDesc}>Check fare between two locations</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/export')}>
            <Text style={styles.menuItemTitle}>Export Data</Text>
            <Text style={styles.menuItemDesc}>Export journeys as XLSX</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.menuItemTitle}>Settings</Text>
            <Text style={styles.menuItemDesc}>GPS interval and preferences</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 32, fontWeight: '700', color: '#111827', marginTop: 20 },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 32, marginTop: 4 },
  card: {
    backgroundColor: '#EBF5FF', borderRadius: 12, padding: 20, marginBottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 4, borderLeftColor: '#2563EB',
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#2563EB', textTransform: 'uppercase', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  cardStatus: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  resumeButton: {
    backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
  },
  resumeButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  primaryButton: {
    backgroundColor: '#059669', paddingVertical: 18, borderRadius: 12,
    alignItems: 'center', marginBottom: 24,
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  menuGroup: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  menuItem: {
    paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
  },
  menuItemTitle: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  menuItemDesc: { fontSize: 13, color: '#6B7280', width: '100%', marginTop: 2 },
  menuArrow: { fontSize: 18, color: '#D1D5DB' },
});
