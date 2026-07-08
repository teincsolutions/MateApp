import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BottomSheet, Host, RNHostView } from '@expo/ui';

import { JourneyRepository, AreaRepository, StopRepository, AreaStopRepository, JourneyAreaRepository, JourneyFareRepository, AreaFareLevelRepository, TrackPointRepository } from '../../adapters/index';
import { GeometryService, LatLng, useJourneyStore, useMappingStore, useSettingsStore, Journey, Area, Stop, JourneyArea as JA, TrackPoint, FareLevel } from '@mateapp/core';

export default function MappingScreen() {
  const router = useRouter();
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const trackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { activeJourney, activeJourneyArea, setActiveJourney, setActiveJourneyArea, setIsTracking } = useJourneyStore();
  const { currentLocation, trackPoints, trackSequence, setCurrentLocation, addTrackPoint, setTrackPoints, setTrackSequence, setIsRecording, isRecording, reset: resetMapping } = useMappingStore();
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
  const [newAreaFare, setNewAreaFare] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);
  const [stopLabel, setStopLabel] = useState('');
  const [selectedFareLevelId, setSelectedFareLevelId] = useState<string | null>(null);
  const [fareAmounts, setFareAmounts] = useState<Record<string, string>>({});
  const [suggestedArea, setSuggestedArea] = useState<Area | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [pendingAreaBeforeFares, setPendingAreaBeforeFares] = useState<Area | false>(false);
  const [areaFareLevels, setAreaFareLevels] = useState<FareLevel[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

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
    setTrackPoints(tps);
    setIsTracking(true);
    setIsRecording(true);
    setInitialLoadDone(true);
  }, [journeyId]);

  useFocusEffect(
    useCallback(() => {
      loadJourney();
      return () => {
        if (locationSub.current) {
          locationSub.current.remove();
          locationSub.current = null;
        }
        if (trackIntervalRef.current) {
          clearInterval(trackIntervalRef.current);
          trackIntervalRef.current = null;
        }
      };
    }, [loadJourney])
  );

  // Gap #1: Auto-create first area when mapping starts with no areas
  useEffect(() => {
    if (!initialLoadDone || !journey || journeyAreas.length > 0 || !currentLocation) return;
    setNewAreaName('');
    setNewAreaFare('');
    setSuggestedArea(null);
    const timer = setTimeout(() => setShowNewAreaModal(true), 500);
    return () => clearTimeout(timer);
  }, [initialLoadDone, journey?.id, journeyAreas.length, currentLocation]);

  useEffect(() => {
    if (!journey) return;
    (async () => {
      const granted = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Location permission is required for mapping.');
        return;
      }
      if (locationSub.current) {
        locationSub.current.remove();
      }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: minDistance, timeInterval: gpsInterval },
        async (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCurrentLocation(loc);
          setGpsAccuracy(pos.coords.accuracy || null);
          if (journey && isRecording) {
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
  }, [journey?.id, gpsInterval, minDistance, isRecording]);

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
    // Gap #2: Load fare levels for current area
    const levels = await AreaFareLevelRepository.getByArea(activeJourneyArea.area.id);
    setAreaFareLevels(levels);
    setSelectedFareLevelId(levels.length > 0 ? levels[0].id : null);
    setStopLabel('');
    setShowStopModal(true);
  };

  const handleCreateStopFromModal = async () => {
    const label = stopLabel.trim();
    if (!label) return;
    setShowStopModal(false);
    await createStop(label, selectedFareLevelId);
  };

  const createStop = async (label: string, fareLevelId: string | null) => {
    if (!currentLocation || !activeJourneyArea) return;
    const stop = await StopRepository.create(label, currentLocation.latitude, currentLocation.longitude);
    // Gap #2: Pass fare level when creating area-stop link
    await AreaStopRepository.create(activeJourneyArea.area.id, stop.id, fareLevelId || undefined);
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

  // Gap #3: Enforce fare entry before new area
  const handleNewArea = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'GPS location not available.');
      return;
    }
    // Enforce: if journey areas exist, prompt fares first
    if (journeyAreas.length >= 1 && activeJourneyArea) {
      const pendingCheck = async () => {
        if (journeyAreas.length < 2) {
          // First new area — no fares needed yet
          return proceedToAreaCreation();
        }
        // Check if fares exist from all previous areas to the pending new area
        // Open fare modal first, then after saving, proceed
        setPendingAreaBeforeFares(null as any);
        handleEnterFares(() => proceedToAreaCreation());
      };
      pendingCheck();
      return;
    }
    proceedToAreaCreation();
  };

  const proceedToAreaCreation = async () => {
    const areasWithPolygons = await AreaRepository.getAllWithPolygons();
    for (const area of areasWithPolygons) {
      if (area.polygon) {
        const polygon = GeometryService.polygonFromJson(area.polygon);
        if (GeometryService.pointInPolygon(currentLocation!, polygon)) {
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
    if (!currentLocation || !journey || creatingArea) return;
    setCreatingArea(true);
    const name = newAreaName.trim();
    let area: Area;

    // Gap #1: First stop auto-created at current GPS
    if (suggestedArea) {
      area = suggestedArea;
    } else {
      if (!name) {
        Alert.alert('Error', 'Enter an area name.');
        setCreatingArea(false);
        return;
      }
      const existing = await AreaRepository.getByName(name);
      if (existing) {
        area = existing;
      } else {
        area = await AreaRepository.create(name);
      }
    }

    const seq = journeyAreas.length + 1;
    const ja = await JourneyAreaRepository.create(journey.id, area.id, seq);

    // Auto-create first stop at current GPS (business rule AR-001)
    const existingStops = await StopRepository.findByRadius(currentLocation.latitude, currentLocation.longitude, 50);
    let stop: Stop;
    if (existingStops.length > 0) {
      stop = existingStops[0];
    } else {
      stop = await StopRepository.create(
        suggestedArea ? `${area.name} Stop` : `${name || area.name} Stop`,
        currentLocation.latitude,
        currentLocation.longitude
      );
    }
    // Create or reuse fare level for this area
    let fareLevel = null;
    const existingLevels = await AreaFareLevelRepository.getByArea(area.id);
    if (existingLevels.length === 0) {
      const amount = parseFloat(newAreaFare) || 0;
      // Check if any journey-level fare matches this amount
      const journeyLevels = await AreaFareLevelRepository.getByJourney(journey.id);
      const existing = journeyLevels.find(l => Math.abs(l.amount - amount) < 0.01);
      if (existing) {
        await AreaFareLevelRepository.linkToArea(area.id, existing.id);
        fareLevel = existing;
      } else {
        const label = amount > 0 ? `GHS ${amount.toFixed(2)}` : 'Minimum';
        fareLevel = await AreaFareLevelRepository.create(journey.id, label, 0, amount);
        await AreaFareLevelRepository.linkToArea(area.id, fareLevel.id);
      }
    } else {
      fareLevel = existingLevels[0];
    }
    // Check if already linked, if not link with fare level
    const existingLink = await AreaStopRepository.getByAreaAndStop(area.id, stop.id);
    if (!existingLink) {
      await AreaStopRepository.create(area.id, stop.id, fareLevel?.id);
    }
    await updateAreaPolygon(area.id);

    setActiveJourneyArea({ area, journeyAreaId: ja.id, sequence: seq });
    await JourneyRepository.updateStatus(journey.id, 'draft');
    setShowNewAreaModal(false);
    setNewAreaName('');
    setNewAreaFare('');
    setSuggestedArea(null);
    setPendingAreaBeforeFares(false);

    await loadJourney();
    setCreatingArea(false);
    Alert.alert('Area Created', `Now in area: ${area.name}`);
  };

  const handleUseSuggestedArea = async () => {
    if (!suggestedArea || !currentLocation || !journey) return;
    const seq = journeyAreas.length + 1;
    const ja = await JourneyAreaRepository.create(journey.id, suggestedArea.id, seq);

    // Ensure journey fare levels exist and link to area
    const existingLevels = await AreaFareLevelRepository.getByArea(suggestedArea.id);
    if (existingLevels.length === 0) {
      const journeyLevels = await AreaFareLevelRepository.getByJourney(journey.id);
      if (journeyLevels.length > 0) {
        for (const lvl of journeyLevels) {
          await AreaFareLevelRepository.linkToArea(suggestedArea.id, lvl.id);
        }
      } else {
        const fl = await AreaFareLevelRepository.create(journey.id, 'Minimum', 0, 0);
        await AreaFareLevelRepository.linkToArea(suggestedArea.id, fl.id);
      }
    }

    const existingStops = await StopRepository.findByRadius(currentLocation.latitude, currentLocation.longitude, 50);
    if (existingStops.length === 0) {
      const stop = await StopRepository.create(`${suggestedArea.name} Stop`, currentLocation.latitude, currentLocation.longitude);
      const levels = await AreaFareLevelRepository.getByArea(suggestedArea.id);
      await AreaStopRepository.create(suggestedArea.id, stop.id, levels[0]?.id);
    }
    setActiveJourneyArea({ area: suggestedArea, journeyAreaId: ja.id, sequence: seq });
    setShowNewAreaModal(false);
    setSuggestedArea(null);
    setNewAreaFare('');
    setPendingAreaBeforeFares(false);
    await loadJourney();
    Alert.alert('Area Reused', `Using existing area: ${suggestedArea.name}`);
  };

  const handleEnterFares = (afterSave?: () => void) => {
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
      if (afterSave) {
        (handleSaveFares as any)._afterSave = afterSave;
      }
    }).catch(() => {
      setFareAmounts(initialFares);
      setShowFareModal(true);
      if (afterSave) {
        (handleSaveFares as any)._afterSave = afterSave;
      }
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
    const afterSave = (handleSaveFares as any)._afterSave;
    (handleSaveFares as any)._afterSave = null;
    if (afterSave) {
      afterSave();
    }
    Alert.alert('Fares Saved', 'Journey fares have been updated.');
  };

  // Gap #9: Minimum 2 areas required
  const handleFinishJourney = () => {
    if (journeyAreas.length < 2) {
      Alert.alert('Cannot Complete', 'A journey must have at least 2 areas before it can be completed.');
      return;
    }
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
          setIsRecording(false);
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

  // Gap #4: Pause/Resume mapping
  const handlePauseResume = () => {
    if (isRecording) {
      setIsRecording(false);
      Alert.alert('Mapping Paused', 'GPS tracking paused. Tap Resume to continue.');
    } else {
      setIsRecording(true);
    }
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

  const handleDismissAreaModal = () => { setShowNewAreaModal(false); setSuggestedArea(null); setNewAreaName(''); setNewAreaFare(''); setCreatingArea(false); };
  const handleDismissStopModal = () => { setShowStopModal(false); setStopLabel(''); };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Host style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backBtn}>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle} numberOfLines={1}>{journey?.name || 'Journey'}</Text>
                {isRecording && <View style={styles.recordingDot} />}
              </View>
              <View style={styles.headerSubRow}>
                <Text style={styles.headerArea} numberOfLines={1}>
                  {activeJourneyArea ? activeJourneyArea.area.name : 'No area'}
                </Text>
                {gpsAccuracy !== null && (
                  <Text style={styles.gpsAccuracy}>±{gpsAccuracy.toFixed(1)}m</Text>
                )}
              </View>
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
              <Polygon key={ap.areaId} coordinates={ap.polygon} fillColor="rgba(37, 99, 235, 0.15)" strokeColor="#2563EB" strokeWidth={2} />
            ))}
            {stops.map((stop) => (
              <Marker key={stop.id} coordinate={{ latitude: stop.latitude, longitude: stop.longitude }} title={stop.label} description={`Radius: ${stop.radius}m`} pinColor="#059669" />
            ))}
            {existingTrackPoints.length > 1 && (
              <Polyline coordinates={existingTrackPoints} strokeColor="#2563EB" strokeWidth={3} />
            )}
          </MapView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom || 0, 70) }]}>
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleAddStop}>
              <Text style={styles.actionBtnText}>+ Add Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleNewArea}>
              <Text style={styles.actionBtnText}>+ New Area</Text>
            </TouchableOpacity>
            {journeyAreas.length >= 2 && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEnterFares()}>
                <Text style={styles.actionBtnText}>Fares</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtnDanger} onPress={handleFinishJourney}>
              <Text style={styles.actionBtnTextDanger}>End</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.pauseBtn} onPress={handlePauseResume}>
            <Text style={styles.pauseBtnText}>{isRecording ? 'Pause GPS' : 'Resume GPS'}</Text>
          </TouchableOpacity>
        </View>
        </View>

        <BottomSheet isPresented={showNewAreaModal} onDismiss={handleDismissAreaModal} snapPoints={['full']}>
          <RNHostView>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{journeyAreas.length === 0 ? 'Create First Area' : 'New Area'}</Text>
              {journeyAreas.length === 0 && <Text style={styles.modalHint}>Start by naming the area at your current location.</Text>}
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
                  <Text style={styles.modalText}>{journeyAreas.length === 0 ? 'Enter a name for your first area. A stop will be created automatically at your GPS location.' : 'Enter a name for the new area at your current location.'}</Text>
                  <TextInput style={styles.modalInput} value={newAreaName} onChangeText={setNewAreaName} placeholder="Area name (e.g. Kejetia)" placeholderTextColor="#9CA3AF" autoFocus />
                  <Text style={styles.modalLabel}>Minimum Fare (GHS)</Text>
                  <TextInput style={styles.modalInput} value={newAreaFare} onChangeText={setNewAreaFare} placeholder="0.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
                  <TouchableOpacity style={[styles.modalButton, (!newAreaName.trim() || creatingArea) && { opacity: 0.5 }]} onPress={handleCreateArea} disabled={!newAreaName.trim() || creatingArea}>
                    <Text style={styles.modalButtonText}>Create Area</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.modalCancel} onPress={handleDismissAreaModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </RNHostView>
        </BottomSheet>

        <BottomSheet isPresented={showFareModal} onDismiss={() => setShowFareModal(false)} snapPoints={['full']}>
          <RNHostView>
            <View style={styles.sheetContent}>
              <Text style={styles.modalTitle}>Enter Fares</Text>
              <Text style={styles.modalText}>Set inter-area fares. Fares are bidirectional.</Text>
              <ScrollView style={styles.fareScroll}>
                {journeyAreas.map((jaFrom, i) =>
                  journeyAreas.slice(i + 1).map((jaTo) => {
                    const key = `${jaFrom.id}-${jaTo.id}`;
                    const areaFrom = areas.find(a => a.id === jaFrom.area_id);
                    const areaTo = areas.find(a => a.id === jaTo.area_id);
                    return (
                      <View key={key} style={styles.fareRow}>
                        <Text style={styles.fareLabel}>{areaFrom?.name || '?'} → {areaTo?.name || '?'}</Text>
                        <TextInput style={styles.fareInput} value={fareAmounts[key] || ''} onChangeText={(v) => setFareAmounts(prev => ({ ...prev, [key]: v }))} placeholder="GHS 0.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
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
          </RNHostView>
        </BottomSheet>

        <BottomSheet isPresented={showStopModal} onDismiss={handleDismissStopModal} snapPoints={['full']}>
          <RNHostView>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add Stop</Text>
              <Text style={styles.modalText}>Enter a label for this stop at your current location.</Text>
              <Text style={styles.modalLabel}>Stop Label</Text>
              <TextInput style={styles.modalInput} value={stopLabel} onChangeText={setStopLabel} placeholder="e.g. Main Station" placeholderTextColor="#9CA3AF" autoFocus onSubmitEditing={handleCreateStopFromModal} />
              {areaFareLevels.length > 0 && (
                <>
                  <Text style={styles.modalLabel}>Fare Level</Text>
                  <View style={styles.fareLevelList}>
                    {areaFareLevels.map((fl) => (
                      <TouchableOpacity key={fl.id} style={[styles.fareLevelChip, selectedFareLevelId === fl.id && styles.fareLevelChipSelected]} onPress={() => setSelectedFareLevelId(fl.id)}>
                        <Text style={[styles.fareLevelChipText, selectedFareLevelId === fl.id && styles.fareLevelChipTextSelected]}>{fl.label} — GHS {fl.amount.toFixed(2)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity style={[styles.modalButton, !stopLabel.trim() && { opacity: 0.5 }]} onPress={handleCreateStopFromModal} disabled={!stopLabel.trim()}>
                <Text style={styles.modalButtonText}>Add Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={handleDismissStopModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </RNHostView>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { color: '#2563EB', fontSize: 16, fontWeight: '500', marginRight: 12 },
  headerInfo: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  recordingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626',
  },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  headerArea: { fontSize: 13, color: '#6B7280', flex: 1 },
  gpsAccuracy: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  map: { flex: 1 },
  actionBar: {
    flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1, backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  actionBtnDanger: {
    flex: 1, backgroundColor: '#DC2626', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTextDanger: { color: '#fff', fontWeight: '600', fontSize: 13 },
  bottomBar: { backgroundColor: '#fff' },
  pauseBtn: {
    marginTop: 8, marginHorizontal: 12, marginBottom: 4,
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    alignItems: 'center', alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    minWidth: 200,
  },
  pauseBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalHint: { fontSize: 13, color: '#2563EB', marginBottom: 12 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
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
  fareLevelList: { marginBottom: 16, gap: 6 },
  fareLevelChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
  },
  fareLevelChipSelected: {
    borderColor: '#2563EB', backgroundColor: '#EBF5FF',
  },
  fareLevelChipText: { fontSize: 14, color: '#374151' },
  fareLevelChipTextSelected: { color: '#2563EB', fontWeight: '600' },
  sheetContent: {
    padding: 24,
    gap: 8,
  },
});
