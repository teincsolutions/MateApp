import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@mateapp/core';
import { loadSettings, saveSettings } from '../../adapters/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const { gpsInterval, minDistance, setGpsInterval, setMinDistance } = useSettingsStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => saveSettings(gpsInterval, minDistance),
      500,
    );
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [gpsInterval, minDistance]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS Tracking</Text>

          <View style={styles.settingGroup}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Tracking Interval</Text>
              <Text style={styles.settingValue}>{(gpsInterval / 1000).toFixed(1)}s</Text>
            </View>
            <Text style={styles.settingDesc}>How often to record GPS position during mapping.</Text>
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setGpsInterval(Math.max(1000, gpsInterval - 1000))}
              >
                <Text style={styles.controlBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.controlValue}>{(gpsInterval / 1000).toFixed(1)}s</Text>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setGpsInterval(Math.min(30000, gpsInterval + 1000))}
              >
                <Text style={styles.controlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1s</Text>
              <Text style={styles.sliderLabel}>30s</Text>
            </View>
          </View>

          <View style={[styles.settingGroup, { borderBottomWidth: 0 }]}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingLabel}>Minimum Distance</Text>
              <Text style={styles.settingValue}>{minDistance.toFixed(0)}m</Text>
            </View>
            <Text style={styles.settingDesc}>Minimum movement before recording a new track point.</Text>
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setMinDistance(Math.max(1, minDistance - 1))}
              >
                <Text style={styles.controlBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.controlValue}>{minDistance.toFixed(0)}m</Text>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setMinDistance(Math.min(100, minDistance + 1))}
              >
                <Text style={styles.controlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1m</Text>
              <Text style={styles.sliderLabel}>100m</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Management</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/manage')}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Manage Data</Text>
              <Text style={styles.menuItemDesc}>Edit stops, areas, and fare levels</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>App</Text>
            <Text style={styles.aboutValue}>MateApp v1.0.0</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.aboutLabel}>Description</Text>
            <Text style={styles.aboutValue}>Offline-first route mapping for public transport</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 24, marginTop: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 20 },
  settingGroup: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  settingValue: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  settingDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  controlBtn: {
    backgroundColor: '#2563EB', width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  controlValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginHorizontal: 24, minWidth: 60, textAlign: 'center' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 11, color: '#9CA3AF' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  menuItemDesc: { fontSize: 13, color: '#6B7280' },
  menuArrow: { fontSize: 22, color: '#D1D5DB', marginLeft: 12 },
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  aboutLabel: { fontSize: 14, color: '#6B7280' },
  aboutValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
});
