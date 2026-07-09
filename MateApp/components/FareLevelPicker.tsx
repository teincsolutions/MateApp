import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { FareLevel } from '@mateapp/core';

interface Props {
  fareLevels: FareLevel[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: (amount: number) => Promise<void>;
}

export function FareLevelPicker({ fareLevels, selectedId, onSelect, onCreateNew }: Props) {
  const [open, setOpen] = useState(false);
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
  };

  return (
    <View>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selectedLevel ? styles.triggerText : styles.triggerPlaceholder}>
          {selectedLevel ? `${selectedLevel.label} — GHS ${selectedLevel.amount.toFixed(2)}` : 'Select fare level...'}
        </Text>
        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          <TouchableOpacity
            style={styles.option}
            onPress={() => { onSelect(null); setOpen(false); }}
          >
            <Text style={[styles.optionText, !selectedId && styles.activeOptionText]}>None</Text>
          </TouchableOpacity>

          <ScrollView style={styles.listScroll} bounces={false} keyboardShouldPersistTaps="handled">
            {fareLevels.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.option}
                onPress={() => { onSelect(item.id); setOpen(false); }}
              >
                <Text style={[styles.optionText, selectedId === item.id && styles.activeOptionText]}>
                  {item.label} — GHS {item.amount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
              <TouchableOpacity onPress={() => setShowInput(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newLink} onPress={() => setShowInput(true)}>
              <Text style={styles.newLinkText}>+ Create New</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  dropdown: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 16, overflow: 'hidden',
  },
  listScroll: { maxHeight: 180 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionText: { fontSize: 15, color: '#374151' },
  activeOptionText: { color: '#2563EB', fontWeight: '600' },
  newRow: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12 },
  newInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#D1D5DB', color: '#111827',
  },
  newBtn: {
    backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelText: { color: '#6B7280', fontSize: 14 },
  newLink: { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  newLinkText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
});
