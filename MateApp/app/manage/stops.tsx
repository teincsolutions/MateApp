import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, SectionList } from 'react-native';
import { StopRepository, AreaStopRepository, AreaRepository } from '../../adapters/index';
import { Stop } from '@mateapp/core';

function formatDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - date.getTime()) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function StopsListScreen() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopAreas, setStopAreas] = useState<Map<string, string[]>>(new Map());
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [allStops, allAreas] = await Promise.all([
      StopRepository.getAll(),
      AreaRepository.getAll(),
    ]);
    setStops(allStops);
    const map = new Map<string, string[]>();
    for (const area of allAreas) {
      const areaStops = await AreaStopRepository.getByArea(area.id);
      for (const as of areaStops) {
        const existing = map.get(as.stop_id);
        if (existing) {
          existing.push(area.name);
        } else {
          map.set(as.stop_id, [area.name]);
        }
      }
    }
    setStopAreas(map);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    if (!search.trim()) return stops;
    const q = search.toLowerCase();
    return stops.filter(s => s.label.toLowerCase().includes(q));
  }, [stops, search]);

  const sections = useMemo(() => {
    const grouped = new Map<string, Stop[]>();
    for (const s of filtered) {
      const day = formatDay(s.created_at);
      const list = grouped.get(day);
      if (list) list.push(s); else grouped.set(day, [s]);
    }
    return Array.from(grouped.entries())
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => b.seq - a.seq),
      }))
      .sort((a, b) => {
        const order = ['Today', 'Yesterday'];
        const ai = order.indexOf(a.title);
        const bi = order.indexOf(b.title);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return new Date(b.data[0].created_at).getTime() - new Date(a.data[0].created_at).getTime();
      });
  }, [filtered]);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search stops..." placeholderTextColor="#9CA3AF" autoCorrect={false} autoCapitalize="none" />
      <SectionList
        keyboardShouldPersistTaps="handled"
        sections={sections}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowContent} onPress={() => router.push({ pathname: '/manage/stops/[id]', params: { id: item.id } })}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowSub}>{stopAreas.get(item.id)?.join(', ') || '—'}</Text>
              <Text style={styles.rowSub}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}  ·  {item.radius}m radius</Text>
            </TouchableOpacity>
            <View style={styles.rowRight}>
              <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} disabled={deleting !== null}>
                <Text style={styles.deleteBtnText}>{deleting === item.id ? '...' : 'Del'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No stops found.</Text>}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  search: {
    margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#D1D5DB', color: '#111827',
  },
  list: { paddingHorizontal: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginTop: 16, marginBottom: 8, letterSpacing: 0.5, paddingLeft: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  rowContent: { flex: 1, padding: 14 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSub: { fontSize: 13, color: '#6B7280' },
  rowTime: { fontSize: 12, color: '#9CA3AF' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 14 },
  deleteBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
});
