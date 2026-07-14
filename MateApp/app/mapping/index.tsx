import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Polygon,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { FareLevelPicker } from "../../components/FareLevelPicker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Location from "expo-location";
import { BottomSheet, Host, RNHostView } from "@expo/ui";
import { Ionicons } from "@expo/vector-icons";

import {
  JourneyRepository,
  AreaRepository,
  StopRepository,
  AreaStopRepository,
  JourneyAreaRepository,
  JourneyFareRepository,
  AreaFareLevelRepository,
  TrackPointRepository,
} from "../../adapters/index";
import {
  GeometryService,
  LatLng,
  reverseGeocode,
  autocomplete,
  useJourneyStore,
  useMappingStore,
  useSettingsStore,
  Journey,
  Area,
  Stop,
  JourneyArea as JA,
  TrackPoint,
  FareLevel,
} from "@mateapp/core";
import type { AutocompleteSuggestion } from "@mateapp/core";

export default function MappingScreen() {
  const router = useRouter();
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const trackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const {
    activeJourney,
    activeJourneyArea,
    setActiveJourney,
    setActiveJourneyArea,
    setIsTracking,
  } = useJourneyStore();
  const {
    currentLocation,
    trackPoints,
    trackSequence,
    setCurrentLocation,
    addTrackPoint,
    setTrackPoints,
    setTrackSequence,
    setIsRecording,
    isRecording,
    reset: resetMapping,
  } = useMappingStore();
  const { gpsInterval, minDistance } = useSettingsStore();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyAreas, setJourneyAreas] = useState<JA[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaPolygons, setAreaPolygons] = useState<
    { areaId: string; polygon: LatLng[] }[]
  >([]);
  const [showNewAreaModal, setShowNewAreaModal] = useState(false);
  const [showFareModal, setShowFareModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [selectedAreaFareLevelId, setSelectedAreaFareLevelId] = useState<
    string | null
  >(null);
  const [journeyAreaFareLevels, setJourneyAreaFareLevels] = useState<
    FareLevel[]
  >([]);
  const [creatingArea, setCreatingArea] = useState(false);
  const [stopLabel, setStopLabel] = useState("");
  const [selectedFareLevelId, setSelectedFareLevelId] = useState<string | null>(
    null,
  );
  const [fareLevelSelections, setFareLevelSelections] = useState<
    Record<string, string>
  >({});
  const [allJourneyLevels, setAllJourneyLevels] = useState<FareLevel[]>([]);
  const [suggestedArea, setSuggestedArea] = useState<Area | null>(null);
  const [suggestedAreaJourneys, setSuggestedAreaJourneys] = useState<
    { id: string; name: string }[]
  >([]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [areaFareLevels, setAreaFareLevels] = useState<FareLevel[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const [stopSuggestions, setStopSuggestions] = useState<
    AutocompleteSuggestion[]
  >([]);
  const areaAutocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stopAutocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const loadJourney = useCallback(async () => {
    if (!journeyId) return;
    const j = await JourneyRepository.getById(journeyId);
    if (!j) return;
    setJourney(j);
    setActiveJourney(j);
    const jas = await JourneyAreaRepository.getByJourney(j.id);
    setJourneyAreas(jas);

    const allAreas: Area[] = [];
    const seenStops = new Set<string>();
    const allStops: Stop[] = [];
    const allPolygons: { areaId: string; polygon: LatLng[] }[] = [];
    for (const ja of jas) {
      const area = await AreaRepository.getById(ja.area_id);
      if (area) {
        allAreas.push(area);
        if (area.polygon) {
          allPolygons.push({
            areaId: area.id,
            polygon: GeometryService.polygonFromJson(area.polygon),
          });
        }
        const areaStops = await StopRepository.findByArea(area.id);
        for (const s of areaStops) {
          if (!seenStops.has(s.id)) {
            seenStops.add(s.id);
            allStops.push(s);
          }
        }
      }
      if (ja.sequence === jas.length) {
        setActiveJourneyArea({
          area: area!,
          journeyAreaId: ja.id,
          sequence: ja.sequence,
        });
      }
    }
    setAreas(allAreas);
    setStops(allStops);
    setAreaPolygons(allPolygons);

    const tps = await TrackPointRepository.getByJourney(j.id);
    const maxSeq = tps.length > 0 ? Math.max(...tps.map((t) => t.sequence)) : 0;
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
    }, [loadJourney]),
  );

  // Gap #1: Auto-create first area when mapping starts with no areas
  useEffect(() => {
    if (
      !initialLoadDone ||
      !journey ||
      journeyAreas.length > 0 ||
      !currentLocation
    )
      return;
    setNewAreaName("");
    setSelectedAreaFareLevelId(null);
    setSuggestedArea(null);
    reverseGeocode(
      currentLocation.latitude,
      currentLocation.longitude,
    ).then((street) => {
      if (street) setNewAreaName(street);
    });
    const timer = setTimeout(() => setShowNewAreaModal(true), 500);
    return () => clearTimeout(timer);
  }, [initialLoadDone, journey?.id, journeyAreas.length, currentLocation]);

  useEffect(() => {
    if (!journey) return;
    (async () => {
      const granted = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Location permission is required for mapping.",
        );
        return;
      }
      if (locationSub.current) {
        locationSub.current.remove();
      }
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: minDistance,
          timeInterval: gpsInterval,
        },
        async (pos) => {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          const prev = lastLocationRef.current;
          if (
            !prev ||
            Math.abs(loc.latitude - prev.lat) > 0.00002 ||
            Math.abs(loc.longitude - prev.lng) > 0.00002
          ) {
            lastLocationRef.current = { lat: loc.latitude, lng: loc.longitude };
            setCurrentLocation(loc);
          }
          setGpsAccuracy(pos.coords.accuracy || null);
          if (journey && isRecording) {
            const seq = await TrackPointRepository.getMaxSequence(journey.id);
            const currentJA =
              journeyAreas.length > 0
                ? journeyAreas[journeyAreas.length - 1]
                : null;
            await TrackPointRepository.create(
              journey.id,
              currentJA?.id || null,
              seq + 1,
              loc.latitude,
              loc.longitude,
            );
            setTrackSequence(seq + 1);
          }
        },
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
      Alert.alert("Error", "No active area. Create or select an area first.");
      return;
    }
    const existingStops = await StopRepository.findByRadius(
      currentLocation.latitude,
      currentLocation.longitude,
      50,
    );
    if (existingStops.length > 0) {
      const existing = existingStops[0];
      const existingAreaStop = await AreaStopRepository.getByAreaAndStop(
        activeJourneyArea.area.id,
        existing.id,
      );
      if (existingAreaStop) {
        Alert.alert(
          "Stop Exists",
          `Stop "${existing.label}" already exists in this area.`,
        );
        return;
      }
      const linkedAreas = await AreaStopRepository.getByStop(existing.id);
      const areaIds = [...new Set(linkedAreas.map((a) => a.area_id))];
      const areaNames: string[] = [];
      const journeyNames: string[] = [];
      for (const aid of areaIds) {
        const a = await AreaRepository.getById(aid);
        if (a) areaNames.push(a.name);
      }
      // Find which journeys these areas belong to
      const allJourneys = await JourneyRepository.getAll();
      for (const aj of allJourneys) {
        const jas = await JourneyAreaRepository.getByJourney(aj.id);
        const matchedAreas = jas.filter((ja) => areaIds.includes(ja.area_id));
        if (matchedAreas.length > 0 && !journeyNames.includes(aj.name)) {
          journeyNames.push(aj.name);
        }
      }
      const otherAreas = areaNames.filter(
        (n) => n !== activeJourneyArea.area.name,
      );
      const journeyInfo =
        journeyNames.length > 0
          ? `\n\nJourneys using this stop: ${journeyNames.join(", ")}`
          : "";
      const message =
        otherAreas.length > 0
          ? `Stop "${existing.label}" is already used in: ${otherAreas.join(", ")}.${journeyInfo}\n\nLink it to ${activeJourneyArea.area.name} too?`
          : `Link stop "${existing.label}" to this area?${journeyInfo}`;

      Alert.alert("Reuse Stop", message, [
        { text: "Cancel", style: "cancel" },
        ...(journeyNames.length > 0
          ? [
              {
                text: "View Journeys",
                onPress: () => router.push("/(tabs)/journeys"),
              },
            ]
          : []),
        {
          text: "Link",
          onPress: async () => {
            const areaLevels = await AreaFareLevelRepository.getByArea(
              activeJourneyArea.area.id,
            );
            await AreaStopRepository.create(
              activeJourneyArea.area.id,
              existing.id,
              areaLevels[0]?.id,
            );
            Alert.alert(
              "Stop Reused",
              `Stop "${existing.label}" linked to ${activeJourneyArea.area.name}`,
            );
            await refreshStops();
          },
        },
      ]);
      return;
    }
    // Gap #2: Load fare levels for current area
    const levels = await AreaFareLevelRepository.getByArea(
      activeJourneyArea.area.id,
    );
    setAreaFareLevels(levels);
    setSelectedFareLevelId(levels.length > 0 ? levels[0].id : null);
    setStopLabel("");
    setShowStopModal(true);
    if (currentLocation) {
      const street = await reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude,
      );
      if (street) {
        setStopLabel(street);
      }
    }
  };

  const handleCreateStopFromModal = async () => {
    const label = stopLabel.trim();
    if (!label) return;
    setShowStopModal(false);
    await createStop(label, selectedFareLevelId);
  };

  const createStop = async (label: string, fareLevelId: string | null) => {
    if (!currentLocation || !activeJourneyArea) return;
    const nextSeq = stops.length > 0 ? Math.max(...stops.map((s) => s.seq)) + 1 : 0;
    const stop = await StopRepository.create(
      label,
      currentLocation.latitude,
      currentLocation.longitude,
      undefined,
      nextSeq,
    );
    // Gap #2: Pass fare level when creating area-stop link
    await AreaStopRepository.create(
      activeJourneyArea.area.id,
      stop.id,
      fareLevelId || undefined,
    );
    await updateAreaPolygon(activeJourneyArea.area.id);
    await refreshStops();
    Alert.alert(
      "Stop Created",
      `Stop "${label}" added to ${activeJourneyArea.area.name}`,
    );
  };

  const updateAreaPolygon = async (areaId: string) => {
    const areaStops = await StopRepository.findByArea(areaId);
    if (areaStops.length >= 3) {
      const points: LatLng[] = areaStops.map((s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
      }));
      const hull = GeometryService.polygonFromStops(points);
      if (hull.length >= 4) {
        await AreaRepository.updatePolygon(
          areaId,
          GeometryService.polygonToJson(hull),
        );
      }
    }
  };

  // Gap #3: Enforce fare entry before new area
  const handleNewArea = async () => {
    if (!currentLocation) {
      Alert.alert("Error", "GPS location not available.");
      return;
    }
    proceedToAreaCreation();
  };

  const proceedToAreaCreation = async () => {
    if (journey) {
      const jfl = await AreaFareLevelRepository.getByJourney(journey.id);
      setJourneyAreaFareLevels(jfl);
      setSelectedAreaFareLevelId(null);
    }
    const areasWithPolygons = await AreaRepository.getAllWithPolygons();
    for (const area of areasWithPolygons) {
      if (area.polygon) {
        const polygon = GeometryService.polygonFromJson(area.polygon);
        if (GeometryService.pointInPolygon(currentLocation!, polygon)) {
          setSuggestedArea(area);
          const allJ = await JourneyRepository.getAll();
          const result: { id: string; name: string }[] = [];
          for (const aj of allJ) {
            const jas = await JourneyAreaRepository.getByJourney(aj.id);
            if (jas.some((ja) => ja.area_id === area.id)) {
              result.push({ id: aj.id, name: aj.name });
            }
          }
          setSuggestedAreaJourneys(result);
          setShowNewAreaModal(true);
          return;
        }
      }
    }
    setSuggestedArea(null);
    setShowNewAreaModal(true);
    if (currentLocation) {
      const street = await reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude,
      );
      if (street && !newAreaName) {
        setNewAreaName(street);
      }
    }
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
        Alert.alert("Error", "Enter an area name.");
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
    const existingStops = await StopRepository.findByRadius(
      currentLocation.latitude,
      currentLocation.longitude,
      50,
    );
    let stop: Stop;
    if (existingStops.length > 0) {
      stop = existingStops[0];
    } else {
      const nextSeq = stops.length > 0 ? Math.max(...stops.map((s) => s.seq)) + 1 : 0;
      stop = await StopRepository.create(
        suggestedArea ? `${area.name} Stop` : `${name || area.name} Stop`,
        currentLocation.latitude,
        currentLocation.longitude,
        undefined,
        nextSeq,
      );
    }
    // Create or reuse fare level for this area
    let fareLevel = null;
    const existingLevels = await AreaFareLevelRepository.getByArea(area.id);
    if (selectedAreaFareLevelId) {
      const alreadyLinked = existingLevels.find(
        (l) => l.id === selectedAreaFareLevelId,
      );
      if (!alreadyLinked) {
        await AreaFareLevelRepository.linkToArea(
          area.id,
          selectedAreaFareLevelId,
        );
      }
      fareLevel = { id: selectedAreaFareLevelId } as FareLevel;
    } else if (existingLevels.length > 0) {
      fareLevel = existingLevels[0];
    } else {
      Alert.alert(
        "Fare Level Required",
        "Please select or create a fare level for this area.",
      );
      setCreatingArea(false);
      return;
    }
    // Check if already linked, if not link with fare level
    const existingLink = await AreaStopRepository.getByAreaAndStop(
      area.id,
      stop.id,
    );
    if (!existingLink) {
      await AreaStopRepository.create(area.id, stop.id, fareLevel?.id);
    }
    await updateAreaPolygon(area.id);

    setActiveJourneyArea({ area, journeyAreaId: ja.id, sequence: seq });
    await JourneyRepository.updateStatus(journey.id, "draft");
    setShowNewAreaModal(false);
    setNewAreaName("");
    setSelectedAreaFareLevelId(null);
    setSuggestedArea(null);
    await loadJourney();
    setCreatingArea(false);
    Alert.alert("Area Created", `Now in area: ${area.name}`);
  };

  const handleUseSuggestedArea = async () => {
    if (!suggestedArea || !currentLocation || !journey) return;
    const seq = journeyAreas.length + 1;
    const ja = await JourneyAreaRepository.create(
      journey.id,
      suggestedArea.id,
      seq,
    );

    // Ensure journey fare levels exist and link to area
    const existingLevels = await AreaFareLevelRepository.getByArea(
      suggestedArea.id,
    );
    if (existingLevels.length === 0) {
      const journeyLevels = await AreaFareLevelRepository.getByJourney(
        journey.id,
      );
      if (journeyLevels.length > 0) {
        for (const lvl of journeyLevels) {
          await AreaFareLevelRepository.linkToArea(suggestedArea.id, lvl.id);
        }
      } else {
        const fl = await AreaFareLevelRepository.create(
          journey.id,
          "Minimum",
          0,
          0,
        );
        await AreaFareLevelRepository.linkToArea(suggestedArea.id, fl.id);
      }
    }

    const existingStops = await StopRepository.findByRadius(
      currentLocation.latitude,
      currentLocation.longitude,
      50,
    );
    if (existingStops.length === 0) {
      const nextSeq = stops.length > 0 ? Math.max(...stops.map((s) => s.seq)) + 1 : 0;
      const stop = await StopRepository.create(
        `${suggestedArea.name} Stop`,
        currentLocation.latitude,
        currentLocation.longitude,
        undefined,
        nextSeq,
      );
      const levels = await AreaFareLevelRepository.getByArea(suggestedArea.id);
      await AreaStopRepository.create(suggestedArea.id, stop.id, levels[0]?.id);
    }
    setActiveJourneyArea({
      area: suggestedArea,
      journeyAreaId: ja.id,
      sequence: seq,
    });
    setShowNewAreaModal(false);
    setSuggestedArea(null);
    setSuggestedAreaJourneys([]);
    setSelectedAreaFareLevelId(null);
    await loadJourney();
    Alert.alert("Area Reused", `Using existing area: ${suggestedArea.name}`);
  };

  const handleEnterFares = async (afterSave?: () => void) => {
    if (journeyAreas.length < 2) {
      Alert.alert("Not Ready", "Need at least 2 areas to set fares.");
      return;
    }
    try {
      const [existingFares, levels] = await Promise.all([
        JourneyFareRepository.getByJourney(journey!.id),
        AreaFareLevelRepository.getByJourney(journey!.id),
      ]);
      const initial: Record<string, string> = {};
      for (const fare of existingFares) {
        initial[`${fare.from_journey_area_id}-${fare.to_journey_area_id}`] =
          fare.fare_level_id;
      }
      setFareLevelSelections(initial);
      setAllJourneyLevels(levels);
      setShowFareModal(true);
      if (afterSave) {
        (handleSaveFares as any)._afterSave = afterSave;
      }
    } catch {
      setFareLevelSelections({});
      setAllJourneyLevels([]);
      setShowFareModal(true);
      if (afterSave) {
        (handleSaveFares as any)._afterSave = afterSave;
      }
    }
  };

  const handleSaveFares = async () => {
    if (!journey) return;
    for (let i = 0; i < journeyAreas.length; i++) {
      for (let j = i + 1; j < journeyAreas.length; j++) {
        const key = `${journeyAreas[i].id}-${journeyAreas[j].id}`;
        const flId = fareLevelSelections[key];
        if (flId) {
          await JourneyFareRepository.upsert(
            journey.id,
            journeyAreas[i].id,
            journeyAreas[j].id,
            flId,
          );
        }
      }
    }
    setShowFareModal(false);
    const afterSave = (handleSaveFares as any)._afterSave;
    (handleSaveFares as any)._afterSave = null;
    if (afterSave) {
      afterSave();
    }
    Alert.alert("Fares Saved", "Journey fares have been updated.");
  };

  // Gap #9: Minimum 2 areas required
  const handleFinishJourney = () => {
    if (journeyAreas.length < 2) {
      Alert.alert(
        "Cannot Complete",
        "A journey must have at least 2 areas before it can be completed.",
      );
      return;
    }
    Alert.alert(
      "Finish Journey",
      "Complete this journey? You can reopen it later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            if (!journey) return;
            if (locationSub.current) {
              locationSub.current.remove();
              locationSub.current = null;
            }
            setIsTracking(false);
            setIsRecording(false);
            const lastArea =
              journeyAreas.length > 0
                ? journeyAreas[journeyAreas.length - 1]
                : null;
            await JourneyRepository.updateStatus(
              journey.id,
              "completed",
              lastArea?.area_id || undefined,
            );
            resetMapping();
            setActiveJourney(null);
            setActiveJourneyArea(null);
            router.replace("/(tabs)/");
          },
        },
      ],
    );
  };

  // Gap #4: Pause/Resume mapping
  const handlePauseResume = () => {
    if (isRecording) {
      setIsRecording(false);
      Alert.alert(
        "Mapping Paused",
        "GPS tracking paused. Tap Resume to continue.",
      );
    } else {
      setIsRecording(true);
    }
  };

  const refreshStops = async () => {
    const seen = new Set<string>();
    const allStops: Stop[] = [];
    for (const ja of journeyAreas) {
      const areaStops = await StopRepository.findByArea(ja.area_id);
      for (const s of areaStops) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          allStops.push(s);
        }
      }
    }
    setStops(allStops);
  };

  const existingTrackPoints = trackPoints.map((tp) => ({
    latitude: tp.latitude,
    longitude: tp.longitude,
  }));
  const handleDismissAreaModal = () => {
    setShowNewAreaModal(false);
    setSuggestedArea(null);
    setSuggestedAreaJourneys([]);
    setNewAreaName("");
    setSelectedAreaFareLevelId(null);
    setCreatingArea(false);
  };
  const handleDismissStopModal = () => {
    setShowStopModal(false);
    setStopLabel("");
  };

  const handleSwitchArea = (ja: JA, area: Area) => {
    setActiveJourneyArea({ area, journeyAreaId: ja.id, sequence: ja.sequence });
    setShowAreaPicker(false);
  };

  const handleAreaNameChange = (text: string) => {
    setNewAreaName(text);
    if (areaAutocompleteTimer.current)
      clearTimeout(areaAutocompleteTimer.current);
    if (text.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    areaAutocompleteTimer.current = setTimeout(async () => {
      if (!currentLocation) return;
      const suggestions = await autocomplete(
        text,
        currentLocation.latitude,
        currentLocation.longitude,
      );
      setAreaSuggestions(suggestions);
    }, 300);
  };

  const handleStopLabelChange = (text: string) => {
    setStopLabel(text);
    if (stopAutocompleteTimer.current)
      clearTimeout(stopAutocompleteTimer.current);
    if (text.length < 2) {
      setStopSuggestions([]);
      return;
    }
    stopAutocompleteTimer.current = setTimeout(async () => {
      if (!currentLocation) return;
      const suggestions = await autocomplete(
        text,
        currentLocation.latitude,
        currentLocation.longitude,
      );
      setStopSuggestions(suggestions);
    }, 300);
  };

  const areaSheetContent = useMemo(
    () => (
      <ScrollView
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.modalTitle}>
          {journeyAreas.length === 0 ? "Create First Area" : "New Area"}
        </Text>
        {journeyAreas.length === 0 && (
          <Text style={styles.modalHint}>
            Start by naming the area at your current location.
          </Text>
        )}
        {suggestedArea ? (
          <>
            <Text style={styles.modalText}>
              Existing area found:{" "}
              <Text style={styles.bold}>{suggestedArea.name}</Text>
            </Text>
            {suggestedAreaJourneys.length > 0 && (
              <Text style={styles.modalText}>
                Used in journeys: {suggestedAreaJourneys.map((j) => j.name).join(", ")}
              </Text>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleUseSuggestedArea}
            >
              <Text style={styles.modalButtonText}>
                Use "{suggestedArea.name}"
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setSuggestedArea(null)}
            >
              <Text style={styles.modalButtonTextSecondary}>
                Create New Area Instead
              </Text>
            </TouchableOpacity>
            {suggestedAreaJourneys.map((j) => (
              <TouchableOpacity
                key={j.id}
                style={styles.modalCancel}
                onPress={() => {
                  handleDismissAreaModal();
                  router.push({
                    pathname: "/mapping",
                    params: { journeyId: j.id },
                  });
                }}
              >
                <Text style={styles.modalCancelText}>View "{j.name}"</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.modalText}>
              {journeyAreas.length === 0
                ? "Enter a name for your first area. A stop will be created automatically at your GPS location."
                : "Enter a name for the new area at your current location."}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newAreaName}
              onChangeText={handleAreaNameChange}
              onBlur={() => {
                if (areaAutocompleteTimer.current)
                  clearTimeout(areaAutocompleteTimer.current);
                setAreaSuggestions([]);
              }}
              placeholder="Area name (e.g. Kejetia)"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            {areaSuggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {areaSuggestions.map((s, i) => (
                  <TouchableOpacity
                    key={s.placeId || `area-${i}`}
                    style={styles.suggestionItem}
                    onPress={() => {
                      if (areaAutocompleteTimer.current)
                        clearTimeout(areaAutocompleteTimer.current);
                      setNewAreaName(s.primaryText);
                      setAreaSuggestions([]);
                    }}
                  >
                    <Text
                      style={styles.suggestionPrimary}
                      numberOfLines={1}
                    >
                      {s.primaryText}
                    </Text>
                    <Text
                      style={styles.suggestionSecondary}
                      numberOfLines={1}
                    >
                      {s.secondaryText}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.modalLabel}>Fare Level</Text>
            <FareLevelPicker
              key={journeyAreaFareLevels.length}
              fareLevels={journeyAreaFareLevels}
              selectedId={selectedAreaFareLevelId}
              onSelect={setSelectedAreaFareLevelId}
              onCreateNew={async (amount) => {
                if (!journey) return;
                const label = `GHS ${amount.toFixed(2)}`;
                const levels = await AreaFareLevelRepository.getByJourney(
                  journey.id,
                );
                const nextOrder =
                  levels.length > 0
                    ? Math.max(...levels.map((l) => l.order_no)) + 1
                    : 0;
                const fl = await AreaFareLevelRepository.create(
                  journey.id,
                  label,
                  nextOrder,
                  amount,
                );
                setJourneyAreaFareLevels((prev) => [...prev, fl]);
                setSelectedAreaFareLevelId(fl.id);
              }}
            />
            <TouchableOpacity
              style={[
                styles.modalButton,
                (!newAreaName.trim() || creatingArea) && { opacity: 0.5 },
              ]}
              onPress={handleCreateArea}
              disabled={!newAreaName.trim() || creatingArea}
            >
              <Text style={styles.modalButtonText}>Create Area</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={styles.modalCancel}
          onPress={handleDismissAreaModal}
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    ),
    [
      journeyAreas.length,
      suggestedArea,
      suggestedAreaJourneys,
      newAreaName,
      selectedAreaFareLevelId,
      journeyAreaFareLevels,
      creatingArea,
      areaSuggestions,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Host style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.customHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons
                name={
                  Platform.OS === "ios" ? "chevron-back" : "arrow-back-outline"
                }
                size={24}
                color="black"
              />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {journey?.name || "Journey"}
              </Text>
              <TouchableOpacity
                style={styles.areaSwitcher}
                onPress={() => setShowAreaPicker(true)}
              >
                <Text style={styles.areaLabel} numberOfLines={1}>
                  {activeJourneyArea ? activeJourneyArea.area.name : "No area"}
                </Text>
                {journeyAreas.length > 1 && (
                  <Text style={styles.areaSwitcherArrow}>▼</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.headerRightGroup}>
              {isRecording && <View style={styles.recordingDot} />}
              {gpsAccuracy !== null && (
                <Text style={styles.gpsAccuracy}>
                  ±{gpsAccuracy.toFixed(1)}m
                </Text>
              )}
            </View>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            showsUserLocation
            initialRegion={{
              latitude: currentLocation?.latitude || 5.6037,
              longitude: currentLocation?.longitude || -0.187,
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
                coordinate={{
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                }}
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

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom || 0, 70) },
            ]}
          >
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleAddStop}
              >
                <Text style={styles.actionBtnText}>+ Add Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleNewArea}
              >
                <Text style={styles.actionBtnText}>+ New Area</Text>
              </TouchableOpacity>
              {journeyAreas.length >= 2 && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleEnterFares()}
                >
                  <Text style={styles.actionBtnText}>Fares</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtnDanger}
                onPress={handleFinishJourney}
              >
                <Text style={styles.actionBtnTextDanger}>End</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={handlePauseResume}
            >
              <Text style={styles.pauseBtnText}>
                {isRecording ? "Pause GPS" : "Resume GPS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <BottomSheet
          isPresented={showNewAreaModal}
          onDismiss={handleDismissAreaModal}
          snapPoints={["full"]}
        >
          <RNHostView>{areaSheetContent}</RNHostView>
        </BottomSheet>

        <BottomSheet
          isPresented={showFareModal}
          onDismiss={() => setShowFareModal(false)}
          snapPoints={["full"]}
        >
          <RNHostView>
            <View style={styles.sheetContent}>
              <Text style={styles.modalTitle}>Enter Fares</Text>
              <Text style={styles.modalText}>
                Select a fare level for each area pair.
              </Text>
              <ScrollView
                style={styles.fareScroll}
                keyboardShouldPersistTaps="handled"
              >
                {journeyAreas.map((jaFrom, i) =>
                  journeyAreas.slice(i + 1).map((jaTo) => {
                    const key = `${jaFrom.id}-${jaTo.id}`;
                    const areaFrom = areas.find((a) => a.id === jaFrom.area_id);
                    const areaTo = areas.find((a) => a.id === jaTo.area_id);
                    return (
                      <View key={key} style={styles.fareRow}>
                        <Text style={styles.fareLabel}>
                          {areaFrom?.name || "?"} → {areaTo?.name || "?"}
                        </Text>
                        <FareLevelPicker
                          fareLevels={allJourneyLevels}
                          selectedId={fareLevelSelections[key] || null}
                          onSelect={(flId) =>
                            setFareLevelSelections((prev) => ({
                              ...prev,
                              [key]: flId || "",
                            }))
                          }
                          onCreateNew={async (amount) => {
                            if (!journey) return;
                            const label = `GHS ${amount.toFixed(2)}`;
                            const lvls =
                              await AreaFareLevelRepository.getByJourney(
                                journey.id,
                              );
                            const nextOrder =
                              lvls.length > 0
                                ? Math.max(...lvls.map((l) => l.order_no)) + 1
                                : 0;
                            const fl = await AreaFareLevelRepository.create(
                              journey.id,
                              label,
                              nextOrder,
                              amount,
                            );
                            setAllJourneyLevels((prev) => [...prev, fl]);
                            setFareLevelSelections((prev) => ({
                              ...prev,
                              [key]: fl.id,
                            }));
                          }}
                        />
                      </View>
                    );
                  }),
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSaveFares}
              >
                <Text style={styles.modalButtonText}>Save Fares</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowFareModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </RNHostView>
        </BottomSheet>

        <BottomSheet
          isPresented={showStopModal}
          onDismiss={handleDismissStopModal}
          snapPoints={["full"]}
        >
          <RNHostView>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Add Stop</Text>
              <Text style={styles.modalText}>
                Enter a label for this stop at your current location.
              </Text>
              <Text style={styles.modalLabel}>Stop Label</Text>
              <TextInput
                style={styles.modalInput}
                value={stopLabel}
                onChangeText={handleStopLabelChange}
                onBlur={() => {
                  if (stopAutocompleteTimer.current)
                    clearTimeout(stopAutocompleteTimer.current);
                  setStopSuggestions([]);
                }}
                placeholder="e.g. Main Station"
                placeholderTextColor="#9CA3AF"
                autoFocus
                onSubmitEditing={handleCreateStopFromModal}
              />
              {stopSuggestions.length > 0 && (
                <View style={styles.suggestionsList}>
                  {stopSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={s.placeId || `stop-${i}`}
                      style={styles.suggestionItem}
                      onPress={() => {
                        if (stopAutocompleteTimer.current)
                          clearTimeout(stopAutocompleteTimer.current);
                        setStopLabel(s.primaryText);
                        setStopSuggestions([]);
                      }}
                    >
                      <Text
                        style={styles.suggestionPrimary}
                        numberOfLines={1}
                      >
                        {s.primaryText}
                      </Text>
                      <Text
                        style={styles.suggestionSecondary}
                        numberOfLines={1}
                      >
                        {s.secondaryText}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.modalLabel}>Fare Level</Text>
              <FareLevelPicker
                fareLevels={areaFareLevels}
                selectedId={selectedFareLevelId}
                onSelect={setSelectedFareLevelId}
                onCreateNew={async (amount) => {
                  if (!journey || !activeJourneyArea) return;
                  const label = `GHS ${amount.toFixed(2)}`;
                  const levels = await AreaFareLevelRepository.getByJourney(
                    journey.id,
                  );
                  const nextOrder =
                    levels.length > 0
                      ? Math.max(...levels.map((l) => l.order_no)) + 1
                      : 0;
                  const fl = await AreaFareLevelRepository.create(
                    journey.id,
                    label,
                    nextOrder,
                    amount,
                  );
                  await AreaFareLevelRepository.linkToArea(
                    activeJourneyArea.area.id,
                    fl.id,
                  );
                  const updated = await AreaFareLevelRepository.getByArea(
                    activeJourneyArea.area.id,
                  );
                  setAreaFareLevels(updated);
                  setSelectedFareLevelId(fl.id);
                }}
              />
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  !stopLabel.trim() && { opacity: 0.5 },
                ]}
                onPress={handleCreateStopFromModal}
                disabled={!stopLabel.trim()}
              >
                <Text style={styles.modalButtonText}>Add Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={handleDismissStopModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </RNHostView>
        </BottomSheet>

        <BottomSheet
          isPresented={showAreaPicker}
          onDismiss={() => setShowAreaPicker(false)}
          snapPoints={["half"]}
        >
          <RNHostView>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.modalTitle}>Switch Area</Text>
              {journeyAreas.map((ja) => {
                const area = areas.find((a) => a.id === ja.area_id);
                const isActive = activeJourneyArea?.area.id === area?.id;
                return (
                  <TouchableOpacity
                    key={ja.id}
                    style={[
                      styles.areaOption,
                      isActive && styles.areaOptionActive,
                    ]}
                    onPress={() => area && handleSwitchArea(ja, area)}
                  >
                    <Text
                      style={[
                        styles.areaOptionLabel,
                        isActive && styles.areaOptionLabelActive,
                      ]}
                    >
                      {ja.sequence}. {area?.name || "?"}
                    </Text>
                    {isActive && <Text style={styles.areaOptionCheck}>●</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </RNHostView>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    backgroundColor: "#E5E7EB",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  headerRightGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  areaLabel: { fontSize: 12, color: "#6B7280" },
  areaSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingVertical: 4,
  },
  areaSwitcherArrow: { fontSize: 8, color: "#9CA3AF", marginTop: 1 },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
  },
  gpsAccuracy: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  areaOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  areaOptionActive: { backgroundColor: "#EBF5FF" },
  areaOptionLabel: { fontSize: 15, color: "#374151" },
  areaOptionLabelActive: { color: "#2563EB", fontWeight: "600" },
  areaOptionCheck: { fontSize: 12, color: "#2563EB" },
  map: { flex: 1 },
  actionBar: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  actionBtnDanger: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnTextDanger: { color: "#fff", fontWeight: "600", fontSize: 13 },
  bottomBar: { backgroundColor: "#fff" },
  pauseBtn: {
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#F3F4F6",
    minWidth: 200,
  },
  pauseBtnText: { color: "#6B7280", fontWeight: "600", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  modalHint: { fontSize: 13, color: "#2563EB", marginBottom: 12 },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 8,
  },
  modalText: { fontSize: 15, color: "#374151", marginBottom: 16 },
  bold: { fontWeight: "700" },
  modalInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginBottom: 16,
    color: "#111827",
  },
  modalButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  modalButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalButtonSecondary: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  modalButtonTextSecondary: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 16,
  },
  modalCancel: { alignItems: "center", paddingVertical: 10 },
  modalCancelText: { color: "#6B7280", fontSize: 15 },
  fareScroll: { maxHeight: 300 },
  fareRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  fareLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  pickerWrapper: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginBottom: 12,
    overflow: "hidden",
  },
  fareLevelChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  fareLevelChipSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EBF5FF",
  },
  fareLevelChipText: { fontSize: 14, color: "#374151" },
  fareLevelChipTextSelected: { color: "#2563EB", fontWeight: "600" },
  newFareRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  newFareBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  newFareBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  newFareLink: { paddingVertical: 8, alignSelf: "flex-start" },
  newFareLinkText: { color: "#2563EB", fontWeight: "600", fontSize: 14 },
  sheetContent: {
    padding: 24,
    gap: 8,
  },
  suggestionsList: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginTop: -12,
    marginBottom: 12,
    maxHeight: 200,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  suggestionSecondary: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
