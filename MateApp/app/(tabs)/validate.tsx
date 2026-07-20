import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { validateFare } from '../../adapters/index';
import { ValidationResult } from '@mateapp/core';

export default function ValidateScreen() {
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickingLocation, setPickingLocation] = useState<'pickup' | 'dest' | null>(null);

  const handlePickLocation = async (type: 'pickup' | 'dest') => {
    setPickingLocation(type);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (type === 'pickup') {
        setPickupLat(pos.coords.latitude.toFixed(6));
        setPickupLng(pos.coords.longitude.toFixed(6));
      } else {
        setDestLat(pos.coords.latitude.toFixed(6));
        setDestLng(pos.coords.longitude.toFixed(6));
      }
    } catch {}
    setPickingLocation(null);
  };

  const handleValidate = async () => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
      return;
    }

    setLoading(true);
    const res = await validateFare(pLat, pLng, dLat, dLng);
    setResult(res);
    setLoading(false);
  };

  const canValidate = pickupLat && pickupLng && destLat && destLng;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Validate Fare</Text>
        <Text style={styles.subtitle}>Enter pickup and destination coordinates or use current location.</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Pickup Location</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => handlePickLocation('pickup')} disabled={pickingLocation !== null}>
            {pickingLocation === 'pickup' ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <Text style={styles.locationBtnText}>Use Current</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.coordRow}>
          <TextInput style={styles.coordInput} value={pickupLat} onChangeText={setPickupLat} placeholder="Latitude" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" />
          <TextInput style={styles.coordInput} value={pickupLng} onChangeText={setPickupLng} placeholder="Longitude" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Destination</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => handlePickLocation('dest')} disabled={pickingLocation !== null}>
            {pickingLocation === 'dest' ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <Text style={styles.locationBtnText}>Use Current</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.coordRow}>
          <TextInput style={styles.coordInput} value={destLat} onChangeText={setDestLat} placeholder="Latitude" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" />
          <TextInput style={styles.coordInput} value={destLng} onChangeText={setDestLng} placeholder="Longitude" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" />
        </View>

        <TouchableOpacity style={[styles.button, !canValidate && styles.buttonDisabled]} onPress={handleValidate} disabled={!canValidate || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Validate</Text>}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <View style={[styles.statusBadge, result.status === 'success' ? styles.statusSuccess : styles.statusFail]}>
              <Text style={styles.statusText}>
                {result.status === 'success' ? 'Success' : result.status === 'journey_not_found' ? 'Journey Not Found' : 'Unknown'}
              </Text>
            </View>
            {result.journey && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Journey</Text>
                <Text style={styles.resultValue}>{result.journey.name}</Text>
              </View>
            )}
            {result.pickupStop && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Pickup Stop</Text>
                <Text style={styles.resultValue}>{result.pickupStop.label}{result.estimatedPickup ? ' (estimated)' : ''}</Text>
              </View>
            )}
            {result.pickupArea && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Pickup Area</Text>
                <Text style={styles.resultValue}>{result.pickupArea.name}</Text>
              </View>
            )}
            {result.destStop && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Dest Stop</Text>
                <Text style={styles.resultValue}>{result.destStop.label}{result.estimatedDest ? ' (estimated)' : ''}</Text>
              </View>
            )}
            {result.destArea && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Dest Area</Text>
                <Text style={styles.resultValue}>{result.destArea.name}</Text>
              </View>
            )}
            {result.fare !== null && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Fare</Text>
                <Text style={styles.fareValue}>GHS {result.fare.toFixed(2)}</Text>
              </View>
            )}
            {result.fareType && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Fare Type</Text>
                <Text style={styles.resultValue}>{result.fareType === 'journey' ? 'Inter-Area' : 'Intra-Area'}</Text>
              </View>
            )}
            <View style={[styles.resultRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.resultLabel}>Message</Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  locationBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EBF5FF' },
  locationBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  coordRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  coordInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#D1D5DB', color: '#111827',
  },
  button: {
    backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 16,
  },
  statusSuccess: { backgroundColor: '#D1FAE5' },
  statusFail: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  resultLabel: { fontSize: 14, color: '#6B7280' },
  resultValue: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },
  resultMessage: { fontSize: 14, fontWeight: '500', color: '#374151', flex: 1, textAlign: 'right' },
  fareValue: { fontSize: 18, fontWeight: '700', color: '#059669', flex: 1, textAlign: 'right' },
});
