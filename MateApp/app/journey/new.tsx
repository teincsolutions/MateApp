import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JourneyRepository } from '../../adapters/index';

export default function NewJourneyScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    const journey = await JourneyRepository.create(trimmed);
    setLoading(false);
    router.replace({ pathname: '/mapping/index', params: { journeyId: journey.id } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>New Journey</Text>
        <Text style={styles.label}>Journey Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Kejetia ↔ Suame"
          placeholderTextColor="#9CA3AF"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleStart}
        />
        <TouchableOpacity
          style={[styles.button, (!name.trim() || loading) && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={!name.trim() || loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Start Journey'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 32, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 17, color: '#111827',
    borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#6B7280', fontSize: 15 },
});
