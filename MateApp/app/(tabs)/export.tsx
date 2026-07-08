import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JourneyRepository } from '../../adapters/index';
import { exportJourneyToFile, exportMasterToFile } from '../../adapters/fileWriter';
import { Journey } from '@mateapp/core';

type ExportFormat = 'xlsx' | 'csv';

export default function ExportScreen() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('xlsx');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await JourneyRepository.getAll();
        setJourneys(all);
      })();
    }, [])
  );

  const handleExportJourney = async (journey: Journey) => {
    setExporting(journey.id);
    try {
      const path = await exportJourneyToFile(journey.id, format);
      if (!path) {
        Alert.alert('Error', 'Failed to export journey.');
      }
    } catch {
      Alert.alert('Error', 'Export failed.');
    }
    setExporting(null);
  };

  const handleMasterExport = async () => {
    setExporting('master');
    try {
      const path = await exportMasterToFile(format);
      if (!path) {
        Alert.alert('Error', 'Failed to export data.');
      }
    } catch {
      Alert.alert('Error', 'Export failed.');
    }
    setExporting(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Export Data</Text>
        <Text style={styles.subtitle}>Export your mapping data as Excel (XLSX) or CSV files.</Text>

        {/* Format toggle */}
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'xlsx' && styles.formatBtnActive]}
            onPress={() => setFormat('xlsx')}
          >
            <Text style={[styles.formatBtnText, format === 'xlsx' && styles.formatBtnTextActive]}>XLSX</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
            onPress={() => setFormat('csv')}
          >
            <Text style={[styles.formatBtnText, format === 'csv' && styles.formatBtnTextActive]}>CSV</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.masterBtn}
          onPress={handleMasterExport}
          disabled={exporting !== null}
        >
          {exporting === 'master' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.masterBtnText}>Master Export (All Data) — {format.toUpperCase()}</Text>
          )}
        </TouchableOpacity>

        {journeys.length === 0 ? (
          <Text style={styles.empty}>No journeys to export. Complete some mapping first.</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Journeys ({journeys.length})</Text>
            {journeys.map((journey) => (
              <View key={journey.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{journey.name}</Text>
                  <Text style={styles.cardDate}>{new Date(journey.created_at).toLocaleDateString()}</Text>
                  <View style={journey.status === 'draft' ? styles.badgeDraft : styles.badgeComplete}>
                    <Text style={styles.badgeText}>{journey.status === 'draft' ? 'Draft' : 'Completed'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.exportBtn}
                  onPress={() => handleExportJourney(journey)}
                  disabled={exporting !== null}
                >
                  {exporting === journey.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.exportBtnText}>{format.toUpperCase()}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
  formatRow: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 3, marginBottom: 20 },
  formatBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  formatBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  formatBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  formatBtnTextActive: { color: '#2563EB' },
  masterBtn: {
    backgroundColor: '#059669', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginBottom: 32,
  },
  masterBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase' },
  empty: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardInfo: { flex: 1, marginRight: 12 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  badgeDraft: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: '#FEF3C7' },
  badgeComplete: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  exportBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
