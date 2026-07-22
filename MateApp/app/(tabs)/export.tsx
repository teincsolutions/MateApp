import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { JourneyRepository } from '../../adapters/index';
import { exportJourneyToFile, exportMasterToFile, ExportFormat } from '../../adapters/fileWriter';
import { Journey } from '@mateapp/core';

const FORMATS: { key: ExportFormat; label: string }[] = [
  { key: 'xlsx', label: 'XLSX' },
  { key: 'csv', label: 'CSV' },
  { key: 'db', label: '.db' },
];

function formatLabel(f: ExportFormat): string {
  if (f === 'db') return '.db';
  return f.toUpperCase();
}

export default function ExportScreen() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('xlsx');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await JourneyRepository.getAll();
        setJourneys(all);
        setSelected(new Set());
      })();
    }, [])
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = journeys.length > 0 && selected.size === journeys.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(journeys.map((j) => j.id)));
    }
  };

  const handleExportJourney = async (journey: Journey) => {
    setExporting(journey.id);
    try {
      await exportJourneyToFile([journey.id], format);
    } catch (err) {
      console.error('[ExportScreen] exportJourney failed:', err);
    }
    setExporting(null);
  };

  const handleExportSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setExporting('selected');
    try {
      await exportJourneyToFile(ids, format);
    } catch (err) {
      console.error('[ExportScreen] exportSelected failed:', err);
    }
    setExporting(null);
  };

  const handleMasterExport = async () => {
    setExporting('master');
    try {
      await exportMasterToFile(format);
    } catch (err) {
      console.error('[ExportScreen] masterExport failed:', err);
    }
    setExporting(null);
  };

  const isDb = format === 'db';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Export Data</Text>
        <Text style={styles.subtitle}>
          {isDb
            ? 'Select journeys to bundle into a single .db file for Android validation.'
            : `Export a journey as ${formatLabel(format)}.`}
        </Text>

        <View style={styles.formatRow}>
          {FORMATS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.formatBtn, format === f.key && styles.formatBtnActive]}
              onPress={() => setFormat(f.key)}
            >
              <Text style={[styles.formatBtnText, format === f.key && styles.formatBtnTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.masterBtn}
          onPress={handleMasterExport}
          disabled={exporting !== null}
        >
          {exporting === 'master' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.masterBtnText}>
              {isDb ? 'Export All (.db)' : `Export All (${formatLabel(format)})`}
            </Text>
          )}
        </TouchableOpacity>

        {journeys.length === 0 ? (
          <Text style={styles.empty}>No journeys to export. Complete some mapping first.</Text>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Journeys ({journeys.length})</Text>
              {isDb && (
                <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll}>
                  <Ionicons
                    name={allSelected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={allSelected ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={styles.selectAllText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {journeys.map((journey) => {
              const isSelected = selected.has(journey.id);
              return (
                <TouchableOpacity
                  key={journey.id}
                  style={[styles.card, isDb && isSelected && styles.cardSelected]}
                  onPress={() => isDb && toggle(journey.id)}
                  disabled={exporting !== null}
                >
                  {isDb && (
                    <View style={styles.checkbox}>
                      {isSelected ? (
                        <Ionicons name="checkbox" size={22} color="#2563EB" />
                      ) : (
                        <Ionicons name="square-outline" size={22} color="#9CA3AF" />
                      )}
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{journey.name}</Text>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardDate}>{new Date(journey.created_at).toLocaleDateString()}</Text>
                      <View style={journey.status === 'draft' ? styles.badgeDraft : styles.badgeComplete}>
                        <Text style={styles.badgeText}>{journey.status === 'draft' ? 'Draft' : 'Completed'}</Text>
                      </View>
                    </View>
                  </View>
                  {!isDb && (
                    <TouchableOpacity
                      style={styles.exportBtn}
                      onPress={() => handleExportJourney(journey)}
                      disabled={exporting !== null}
                    >
                      {exporting === journey.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.exportBtnText}>{formatLabel(format)}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
            {isDb && (
              <TouchableOpacity
                style={[styles.exportSelectedBtn, selected.size === 0 && { opacity: 0.4 }]}
                onPress={handleExportSelected}
                disabled={exporting !== null || selected.size === 0}
              >
                {exporting === 'selected' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.exportSelectedText}>Export ({selected.size})</Text>
                )}
              </TouchableOpacity>
            )}
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
  masterBtn: { backgroundColor: '#059669', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  masterBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, marginTop: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectAllText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  empty: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  checkbox: { marginRight: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { fontSize: 12, color: '#9CA3AF' },
  badgeDraft: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: '#FEF3C7' },
  badgeComplete: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  exportBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  exportSelectedBtn: { backgroundColor: '#2563EB', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  exportSelectedText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
