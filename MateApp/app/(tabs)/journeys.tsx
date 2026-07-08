import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JourneyRepository } from '../../adapters/index';
import { exportJourneyToFile } from '../../adapters/fileWriter';
import { Journey } from '@mateapp/core';

export default function JourneysScreen() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await JourneyRepository.getAll();
        setJourneys(all);
      })();
    }, [])
  );

  const drafts = journeys.filter((j) => j.status === 'draft');
  const completed = journeys.filter((j) => j.status === 'completed');

  const handleDelete = (journey: Journey) => {
    Alert.alert('Delete Journey', `Delete "${journey.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await JourneyRepository.delete(journey.id);
          setJourneys((prev) => prev.filter((j) => j.id !== journey.id));
        },
      },
    ]);
  };

  // Gap #8: Export action
  const handleExport = async (journey: Journey) => {
    setExporting(journey.id);
    try {
      await exportJourneyToFile(journey.id);
    } catch {
      Alert.alert('Error', 'Export failed.');
    }
    setExporting(null);
  };

  // Gap #7: Review action
  const handleReview = (journey: Journey) => {
    router.push({ pathname: '/mapping/index', params: { journeyId: journey.id } });
  };

  const renderJourney = (journey: Journey) => (
    <View key={journey.id} style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{journey.name}</Text>
        <Text style={styles.cardDate}>{new Date(journey.created_at).toLocaleDateString()}</Text>
        <View style={[styles.badge, journey.status === 'draft' ? styles.badgeDraft : styles.badgeCompleted]}>
          <Text style={styles.badgeText}>{journey.status === 'draft' ? 'Draft' : 'Completed'}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        {journey.status === 'draft' ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/mapping/index', params: { journeyId: journey.id } })}
          >
            <Text style={styles.actionBtnText}>Resume</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleReview(journey)}>
            <Text style={styles.actionBtnText}>Review</Text>
          </TouchableOpacity>
        )}
        {/* Gap #8: Export */}
        <TouchableOpacity
          style={styles.actionBtnExport}
          onPress={() => handleExport(journey)}
          disabled={exporting !== null}
        >
          {exporting === journey.id ? (
            <ActivityIndicator color="#2563EB" size="small" />
          ) : (
            <Text style={styles.actionBtnExportText}>Export</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleDelete(journey)}>
          <Text style={styles.actionBtnTextSecondary}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Journeys</Text>
        {journeys.length === 0 && (
          <Text style={styles.empty}>No journeys yet. Start a new journey to begin mapping.</Text>
        )}
        {drafts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Draft ({drafts.length})</Text>
            {drafts.map(renderJourney)}
          </>
        )}
        {completed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Completed ({completed.length})</Text>
            {completed.map(renderJourney)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 20, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 12, marginTop: 8, textTransform: 'uppercase' },
  empty: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardInfo: { marginBottom: 12 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cardDate: { fontSize: 13, color: '#9CA3AF', marginBottom: 6 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeDraft: { backgroundColor: '#FEF3C7' },
  badgeCompleted: { backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  actionBtnExport: { backgroundColor: '#EBF5FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2563EB' },
  actionBtnExportText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  actionBtnSecondary: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  actionBtnTextSecondary: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
});
