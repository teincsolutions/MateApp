import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { FareLevel } from '@mateapp/core';

interface Props {
  fareLevels: FareLevel[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: (amount: number) => Promise<void>;
}

export function FareLevelPicker({ fareLevels, selectedId, onSelect, onCreateNew }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedLevel = fareLevels.find(fl => fl.id === selectedId);

  const handleCreate = async () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setCreating(true);
    await onCreateNew(amt);
    setCreating(false);
    setShowInput(false);
    setAmount('');
    setShowPicker(false);
  };

  return (
    <View>
      <TouchableOpacity style={styles.trigger} onPress={() => setShowPicker(true)}>
        <Text style={selectedLevel ? styles.triggerText : styles.triggerPlaceholder}>
          {selectedLevel ? `${selectedLevel.label} — GHS ${selectedLevel.amount.toFixed(2)}` : 'Select fare level...'}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.backdrop} onPress={() => setShowPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Fare Level</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={styles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.option, !selectedId && styles.optionSelected]}
            onPress={() => { onSelect(null); setShowPicker(false); }}
          >
            <Text style={[styles.optionText, !selectedId && styles.optionTextSelected]}>None</Text>
          </TouchableOpacity>

          <FlatList
            data={fareLevels}
            keyExtractor={fl => fl.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, selectedId === item.id && styles.optionSelected]}
                onPress={() => { onSelect(item.id); setShowPicker(false); }}
              >
                <Text style={[styles.optionText, selectedId === item.id && styles.optionTextSelected]}>
                  {item.label} — GHS {item.amount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}
          />

          {showInput ? (
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount (GHS)"
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <TouchableOpacity style={styles.newBtn} onPress={handleCreate} disabled={creating}>
                <Text style={styles.newBtnText}>{creating ? '...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newLink} onPress={() => setShowInput(true)}>
              <Text style={styles.newLinkText}>+ Create New</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB',
    padding: 14, marginBottom: 8,
  },
  triggerText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  triggerPlaceholder: { fontSize: 15, color: '#9CA3AF' },
  arrow: { fontSize: 10, color: '#9CA3AF' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  doneBtn: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  option: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionSelected: { backgroundColor: '#EBF5FF' },
  optionText: { fontSize: 15, color: '#374151' },
  optionTextSelected: { color: '#2563EB', fontWeight: '600' },
  newRow: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 },
  newInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#D1D5DB', color: '#111827',
  },
  newBtn: {
    backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  newLink: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  newLinkText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
});
