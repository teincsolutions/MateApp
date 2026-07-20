import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SectionList } from 'react-native';
import { AreaRepository, StopRepository, JourneyRepository, JourneyAreaRepository } from '../../adapters/index';
import { Area } from '@mateapp/core';

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

export default function AreasListScreen() {
  const router = useRouter();
  const [areas, setAreas] = useState<(Area & { stopCount: number })[]>([]);
  const [areaSeq, setAreaSeq] = useState<Map<string, number>>(new Map());

  useFocusEffect(useCallback(() => {
    (async () => {
      const [all, allJourneys] = await Promise.all([
        AreaRepository.getAll(),
        JourneyRepository.getAll(),
      ]);
      const seqMap = new Map<string, number>();
      for (const j of allJourneys) {
        const jas = await JourneyAreaRepository.getByJourney(j.id);
        for (const ja of jas) {
          const existing = seqMap.get(ja.area_id);
          if (existing === undefined || ja.sequence < existing) {
            seqMap.set(ja.area_id, ja.sequence);
          }
        }
      }
      setAreaSeq(seqMap);
      const withCounts = await Promise.all(all.map(async (a) => {
        const stops = await StopRepository.findByArea(a.id);
        return { ...a, stopCount: stops.length };
      }));
      setAreas(withCounts);
    })();
  }, []));

  const sections = useMemo(() => {
    const grouped = new Map<string, (Area & { stopCount: number })[]>();
    for (const a of areas) {
      const day = formatDay(a.created_at);
      const list = grouped.get(day);
      if (list) list.push(a); else grouped.set(day, [a]);
    }
    return Array.from(grouped.entries())
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => {
          const sa = areaSeq.get(a.id) ?? Infinity;
          const sb = areaSeq.get(b.id) ?? Infinity;
          return sb - sa;
        }),
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
  }, [areas, areaSeq]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/manage/areas/[id]', params: { id: item.id } })}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{item.name}</Text>
              <Text style={styles.rowSub}>{item.stopCount} stops · {item.polygon ? 'Has polygon' : 'No polygon'}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
              <Text style={styles.rowArrow}>{'>'}</Text>
            </View>
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
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  rowContent: { flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  rowSub: { fontSize: 13, color: '#6B7280' },
  rowTime: { fontSize: 12, color: '#9CA3AF' },
  rowArrow: { fontSize: 16, color: '#D1D5DB' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
});
