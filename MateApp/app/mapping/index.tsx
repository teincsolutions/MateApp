import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal,
  TextInput, ScrollView, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { JourneyRepository, AreaRepository, StopRepository, AreaStopRepository, JourneyAreaRepository, JourneyFareRepository, AreaFareLevelRepository, TrackPointRepository } from '../../adapters/index';
import { GeometryService, LatLng, useJourneyStore, useMappingStore, useSettingsStore, Journey, Area, Stop, JourneyArea as JA, TrackPoint } from '@mateapp/core';

export default function MappingScreen() {
  const router = useRouter();
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const { activeJourney, activeJourneyArea, setActiveJourney, setActiveJourneyArea, setIsTracking } = useJourneyStore();
  const { currentLocation, trackPoints, trackSequence, setCurrentLocation, addTrackPoint, setTrackSequence, setIsRecording, reset: resetMapping } = useMappingStore();
  const { gpsInterval, minDistance } = useSettingsStore();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyAreas, setJourneyAreas] = useState<JA[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaPolygons, setAreaPolygons] = useState<{ areaId: string; polygon: LatLng[] }[]>([]);
  const [showNewAreaModal, setShowNewAreaModal] = useState(false);
  const [showFareModal, setShowFareModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [stopLabel, setStopLabel] = useState('');
  const [fareAmounts, setFareAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [suggestedArea, setSuggestedArea] = useState<Area | null>(null);

  const loadJourney = useCallback(async () => {
    if (!journeyId) return;
    const j = await JourneyRepository.getById(journeyId);
    if (!j) return;
    setJourney(j);
    setActiveJourney(j);
    const jas = await JourneyAreaRepository.getByJourney(j.id);
    setJourneyAreas(jas);

    const allAreas: Area[] = [];
    const allStops: Stop[] = [];
    const allPolygons: { areaId: string; polygon: LatLng[] }[] = [];
    for (const ja of jas) {
      const area = await AreaRepository.getById(ja.area_id);
      if (area) {
        allAreas.push(area);
        if (area.polygon) {
          allPolygons.push({ areaId: area.id, polygon: GeometryService.polygonFromJson(area.polygon) });
        }
        const areaStops = await StopRepository.findByArea(area.id);
        allStops.push(...areaStops);
      }
      if (ja.sequence === jas.length) {
        setActiveJourneyArea({ area: area!, journeyAreaId: ja.id, sequence: ja.sequence });
      }
    }
    setAreas(allAreas);
    setStops(allStops);
    setAreaPolygons(allPolygons);

    const tps = await TrackPointRepository.getByJourney(j.id);
    const maxSeq = tps.length > 0 ? Math.max(...tps.map(t => t.sequence)) : 0;
    setTrackSequence(maxSeq);

    const existingTps = await TrackPointRepository.getByJourney(j.id);
    for (const tp of existingTps) {
      addTrackPoint(tp);
    }
    setIsTracking(true);
  }, [journeyId]);

  useFocusEffect(
    useCallback(() => {
      loadJourney();
      return () => {
        if (locationSub.current) {
          locationSub.current.remove();
          locationSub.current = null;
        }
      };
    }, [loadJourney])
  );

  useEffect(() => {
    if (!journey) return;
    (async () => {
      const granted = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Location permission is required for mapping.');
        return;
      }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: minDistance, timeInterval: gpsInterval },
        async (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCurrentLocation(loc);
          if (journey) {
            const seq = await TrackPointRepository.getMaxSequence(journey.id);
            const currentJA = journeyAreas.length > 0 ? journeyAreas[journeyAreas.length - 1] : null;
            await TrackPointRepository.create(journey.id, currentJA?.id || null, seq + 1, loc.latitude, loc.longitude);
            setTrackSequence(seq + 1);
          }
        }
      );
    })();
    return () => {
      if (locationSub.current) {
        locationSub.current.remove();
        locationSub.current = null;
      }
    };
  }, [journey?.id, gpsInterval, minDistance]);

  const handleAddStop = async () => {
    if (!currentLocation || !activeJourneyArea) {
      Alert.alert('Error', 'No active area. Create or select an area first.');
      return;
    }
    const existingStops = await StopRepository.findByRadius(currentLocation.latitude, currentLocation.longitude, 50);
    if (existingStops.length > 0) {
      const existing = existingStops[0];
      const existingAreaStop = await AreaStopRepository.getByAreaAndStop(activeJourneyArea.area.id, existing.id);
      if (existingAreaStop) {
        Alert.alert('Stop Exists', `Stop "${existing.label}" already exists in this area.`);
        return;
      }
      await AreaStopRepository.create(activeJourneyArea.area.id, existing.id);
      Alert.alert('Stop Reused', `Stop "${existing.label}" has been added to this area.`);
      await refreshStops();
      return;
    }
    setStopLabel('');
    setShowStopModal(true);
  };

  const handleCreateStopFromModal = async () => {
    const label = stopLabel.trim();
    if (!label) return;
    setShowStopModal(false);
    await createStop(label);
  };

  const createStop = async (label: string) => {
    if (!currentLocation || !activeJourneyArea) return;
    const stop = await StopRepository.create(label, currentLocation.latitude, currentLocation.longitude);
    await AreaStopRepository.create(activeJourneyArea.area.id, stop.id);
    await updateAreaPolygon(activeJourneyArea.area.id);
    await refreshStops();
    Alert.alert('Stop Created', `Stop "${label}" added to ${activeJourneyArea.area.name}`);
  };

  const updateAreaPolygon = async (areaId: string) => {
    const areaStops = await StopRepository.findByArea(areaId);
    if (areaStops.length >= 3) {
      const points: LatLng[] = areaStops.map(s => ({ latitude: s.latitude, longitude: s.longitude }));
      const hull = GeometryService.polygonFromStops(points);
      if (hull.length >= 4) {
        await AreaRepository.updatePolygon(areaId, GeometryService.polygonToJson(hull));
      }
    }
  };

  const handleNewArea = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'GPS location not available.');
      return;
    }
    const areasWithPolygons = await AreaRepository.getAllWithPolygons();
    for (const area of areasWithPolygons) {
      if (area.polygon) {
        const polygon = GeometryService.polygonFromJson(area.polygon);
        if (GeometryService.pointInPolygon(currentLocation, polygon)) {
          setSuggestedArea(area);
          setShowNewAreaModal(true);
          return;
        }
      }
    }
    setSuggestedArea(null);
    setShowNewAreaModal(true);
  };

  const handleCreateArea = async () => {
    if (!currentLocation || !journey) return;
    const name = newAreaName.trim();
    let area: Area;

    if (suggestedArea) {
      area = suggestedArea;
    } else {
      if (!name) {
        Alert.alert('Error', 'Enter an area name.');
        return;
      }
      area = await AreaRepository.create(name);
      setSuggestedArea(null);
    }

    const seq = journeyAreas.length + 1;
    const ja = await JourneyAreaRepository.create(journey.id, area.id, seq);
    const stop = await StopRepository.create(
      suggestedArea ? `${area.name} Stop` : `${name} Stop`,
      currentLocation.latitude,
      currentLocation.longitude
    );
    await AreaStopRepository.create(area.id, stop.id);
    setActiveJourneyArea({ area, journeyAreaId: ja.id, sequence: seq });
    await JourneyRepository.updateStatus(journey.id, 'draft');
    setShowNewAreaModal(false);
    setNewAreaName('');

    await loadJourney();
    Alert.alert('Area Created', `Now in area: ${area.name}`);
  };

  const handleUseSuggestedArea = async () => {
    if (!suggestedArea || !currentLocation || !journey) return;
    const seq = journeyAreas.length + 1;
    const ja = await JourneyAreaRepository.create(journey.id, suggestedArea.id, seq);

    const existingStops = await StopRepository.findByRadius(currentLocation.latitude, currentLocation.longitude, 50);
    if (existingStops.length === 0) {
      const stop = await StopRepository.create(`${suggestedArea.name} Stop`, currentLocation.latitude, currentLocation.longitude);
      await AreaStopRepository.create(suggestedArea.id, stop.id);
    }
    setActiveJourneyArea({ area: suggestedArea, journeyAreaId: ja.id, sequence: seq });
    setShowNewAreaModal(false);
    setSuggestedArea(null);
    await loadJourney();
    Alert.alert('Area Reused', `Using existing area: ${suggestedArea.name}`);
  };

  const handleEnterFares = () => {
    if (journeyAreas.length < 2) {
      Alert.alert('Not Ready', 'Need at least 2 areas to set fares.');
      return;
    }
    const initialFares: Record<string, string> = {};
    JourneyFareRepository.getByJourney(journey!.id).then(existingFares => {
      for (const fare of existingFares) {
        initialFares[`${fare.from_journey_area_id}-${fare.to_journey_area_id}`] = String(fare.amount);
      }
      setFareAmounts(initialFares);
      setShowFareModal(true);
    }).catch(() => {
      setFareAmounts(initialFares);
      setShowFareModal(true);
    });
  };

  const handleSaveFares = async () => {
    if (!journey) return;
    for (let i = 0; i < journeyAreas.length; i++) {
      for (let j = i + 1; j < journeyAreas.length; j++) {
        const key = `${journeyAreas[i].id}-${journeyAreas[j].id}`;
        const amount = parseFloat(fareAmounts[key] || '0');
        if (amount > 0) {
          await JourneyFareRepository.upsert(journey.id, journeyAreas[i].id, journeyAreas[j].id, amount);
        }
      }
    }
    setShowFareModal(false);
    Alert.alert('Fares Saved', 'Journey fares have been updated.');
  };

  const handleFinishJourney = () => {
    Alert.alert('Finish Journey', 'Complete this journey? You can reopen it later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (!journey) return;
          if (locationSub.current) {
            locationSub.current.remove();
            locationSub.current = null;
          }
          setIsTracking(false);
          const lastArea = journeyAreas.length > 0 ? journeyAreas[journeyAreas.length - 1] : null;
          await JourneyRepository.updateStatus(journey.id, 'completed', lastArea?.area_id || undefined);
          resetMapping();
          setActiveJourney(null);
          setActiveJourneyArea(null);
          router.replace('/(tabs)/');
        },
      },
    ]);
  };

  const refreshStops = async () => {
    const allStops: Stop[] = [];
    for (const ja of journeyAreas) {
      const areaStops = await StopRepository.findByArea(ja.area_id);
      allStops.push(...areaStops);
    }
    setStops(allStops);
  };

  const existingTrackPoints = trackPoints.map(tp => ({
    latitude: tp.latitude,
    longitude: tp.longitude,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{journey?.name || 'Journey'}</Text>
          <Text style={styles.headerArea} numberOfLines={1}>
            {activeJourneyArea ? activeJourneyArea.area.name : 'No area'}
          </Text>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        followsUserLocation
        initialRegion={{
          latitude: currentLocation?.latitude || 5.6037,
          longitude: currentLocation?.longitude || -0.1870,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {areaPolygons.map((ap) => (
          <Polygon
            key={ap.areaId}
            coordinates={ap.polygon}
            fillColor="rgba(37, 99, 235, 0.15)"
            strokeColor="#2563EB"
            strokeWidth={2}
          />
        ))}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.label}
            description={`Radius: ${stop.radius}m`}
            pinColor="#059669"
          />
        ))}
        {existingTrackPoints.length > 1 && (
          <Polyline
            coordinates={existingTrackPoints}
            strokeColor="#2563EB"
            strokeWidth={3}
          />
        )}
      </MapView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleAddStop}>
          <Text style={styles.actionBtnText}>Add Stop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleNewArea}>
          <Text style={styles.actionBtnText}>New Area</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleEnterFares}>
          <Text style={styles.actionBtnText}>Fares</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnDanger} onPress={handleFinishJourney}>
          <Text style={styles.actionBtnTextDanger}>Finish</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showNewAreaModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Area</Text>
            {suggestedArea ? (
              <>
                <Text style={styles.modalText}>Existing area found: <Text style={styles.bold}>{suggestedArea.name}</Text></Text>
                <TouchableOpacity style={styles.modalButton} onPress={handleUseSuggestedArea}>
                  <Text style={styles.modalButtonText}>Use "{suggestedArea.name}"</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setSuggestedArea(null)}>
                  <Text style={styles.modalButtonTextSecondary}>Create New Area Instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>Enter a name for the new area at your current location.</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAreaName}
                  onChangeText={setNewAreaName}
                  placeholder="Area name (e.g. Kejetia)"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.modalButton, !newAreaName.trim() && { opacity: 0.5 }]}
                  onPress={handleCreateArea}
                  disabled={!newAreaName.trim()}
                >
                  <Text style={styles.modalButtonText}>Create Area</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowNewAreaModal(false); setSuggestedArea(null); setNewAreaName(''); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Fares</Text>
            <ScrollView style={styles.fareScroll}>
              {journeyAreas.map((jaFrom, i) =>
                journeyAreas.slice(i + 1).map((jaTo) => {
                  const key = `${jaFrom.id}-${jaTo.id}`;
                  const areaFrom = areas.find(a => a.id === jaFrom.area_id);
                  const areaTo = areas.find(a => a.id === jaTo.area_id);
                  return (
                    <View key={key} style={styles.fareRow}>
                      <Text style={styles.fareLabel}>{areaFrom?.name || '?'} → {areaTo?.name || '?'}</Text>
                      <TextInput
                        style={styles.fareInput}
                        value={fareAmounts[key] || ''}
                        onChangeText={(v) => setFareAmounts(prev => ({ ...prev, [key]: v }))}
                        placeholder="GHS 0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalButton} onPress={handleSaveFares}>
              <Text style={styles.modalButtonText}>Save Fares</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowFareModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStopModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Stop</Text>
            <Text style={styles.modalText}>Enter a label for this stop at your current location.</Text>
            <TextInput
              style={styles.modalInput}
              value={stopLabel}
              onChangeText={setStopLabel}
              placeholder="Stop label (e.g. Main Station)"
              placeholderTextColor="#9CA3AF"
              autoFocus
              onSubmitEditing={handleCreateStopFromModal}
            />
            <TouchableOpacity
              style={[styles.modalButton, !stopLabel.trim() && { opacity: 0.5 }]}
              onPress={handleCreateStopFromModal}
              disabled={!stopLabel.trim()}
            >
              <Text style={styles.modalButtonText}>Add Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowStopModal(false); setStopLabel(''); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { color: '#2563EB', fontSize: 16, fontWeight: '500', marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerArea: { fontSize: 13, color: '#6B7280' },
  map: { flex: 1 },
  actionBar: {
    flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  actionBtn: {
    flex: 1, backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionBtnDanger: {
    flex: 1, backgroundColor: '#DC2626', paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  actionBtnTextDanger: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalText: { fontSize: 15, color: '#374151', marginBottom: 16 },
  bold: { fontWeight: '700' },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 16, color: '#111827',
  },
  modalButton: {
    backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 8,
  },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 8,
  },
  modalButtonTextSecondary: { color: '#2563EB', fontWeight: '600', fontSize: 16 },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: '#6B7280', fontSize: 15 },
  fareScroll: { maxHeight: 300 },
  fareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  fareLabel: { fontSize: 14, color: '#374151', flex: 1 },
  fareInput: {
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#D1D5DB', width: 100, textAlign: 'right', color: '#111827',
  },
});
