import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import { theme } from '@/lib/theme';
import type { PatientMedication } from '@/types/medication';
import {
  syncInventoryWithMeds,
  adjustInventoryQuantity,
  refillInventoryItem,
  type InventoryItem,
} from '@/lib/medicationInventory';

interface Props {
  visible: boolean;
  uid: string;
  medications: PatientMedication[];
  focusMedId?: string | null;
  onClose: () => void;
}

export default function MedicationInventoryModal({
  visible,
  uid,
  medications,
  focusMedId,
  onClose,
}: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMed, setShowAddMed] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedUnit, setNewMedUnit] = useState('tablets');
  const [newMedQty, setNewMedQty] = useState('30');
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    syncInventoryWithMeds(uid, medications)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [visible, uid, medications]);

  const changeQty = async (id: string, delta: number) => {
    const next = await adjustInventoryQuantity(uid, id, delta);
    setItems(next);
  };

  const refill = async (id: string) => {
    const next = await refillInventoryItem(uid, id, 30);
    setItems(next);
  };

  const setDirectQty = async (id: string, qty: number) => {
    const updatedItems = items.map(item =>
      item.medicationId === id ? { ...item, quantity: Math.max(0, qty) } : item
    );
    setItems(updatedItems);
    // Save to AsyncStorage
    const { saveInventory } = await import('@/lib/medicationInventory');
    await saveInventory(uid, updatedItems);
  };

  const addCustomMedication = async () => {
    if (!newMedName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a medication name.');
      } else {
        Alert.alert('Required', 'Please enter a medication name.');
      }
      return;
    }

    const newItem: InventoryItem = {
      medicationId: `custom_${Date.now()}`,
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || 'As prescribed',
      quantity: parseInt(newMedQty, 10) || 30,
      unit: newMedUnit,
      lowThreshold: 5,
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    
    // Save to AsyncStorage
    const { saveInventory } = await import('@/lib/medicationInventory');
    await saveInventory(uid, updatedItems);

    // Reset form
    setNewMedName('');
    setNewMedDosage('');
    setNewMedQty('30');
    setShowAddMed(false);
  };

  const lowCount = items.filter(i => i.quantity <= i.lowThreshold).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <AppLogo size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>Inventory</Text>
              <Text style={s.title}>Medication supply</Text>
              <Text style={s.sub}>Track what you have left at home</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <AppIcon name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {lowCount > 0 && (
            <View style={s.warnBar}>
              <AppIcon name="warning-outline" size={18} color="#e65100" />
              <Text style={s.warnText}>{lowCount} medication{lowCount > 1 ? 's' : ''} running low</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={theme.green} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
              {items.length === 0 ? (
                <Text style={s.empty}>Add medications first to track inventory.</Text>
              ) : (
                items.map(item => {
                  const low = item.quantity <= item.lowThreshold;
                  const focused = item.medicationId === focusMedId;
                  const isEditing = editingQtyId === item.medicationId;
                  return (
                    <View
                      key={item.medicationId}
                      style={[s.row, low && s.rowLow, focused && s.rowFocus]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.medName}>{item.name}</Text>
                        <Text style={s.medSub}>{item.dosage}</Text>
                        <Text style={[s.stockLabel, low && { color: '#e65100' }]}>
                          {low ? 'Low stock' : 'In stock'} · {item.unit}
                        </Text>
                      </View>
                      <View style={s.qtyCol}>
                        {isEditing ? (
                          <View style={s.editQtyRow}>
                            <TextInput
                              style={s.qtyInput}
                              value={editingQtyValue}
                              onChangeText={setEditingQtyValue}
                              keyboardType="number-pad"
                              autoFocus
                              onSubmitEditing={() => {
                                const qty = parseInt(editingQtyValue, 10);
                                if (!isNaN(qty)) {
                                  setDirectQty(item.medicationId, qty);
                                }
                                setEditingQtyId(null);
                                setEditingQtyValue('');
                              }}
                              onBlur={() => {
                                setEditingQtyId(null);
                                setEditingQtyValue('');
                              }}
                            />
                            <TouchableOpacity
                              style={s.saveQtyBtn}
                              onPress={() => {
                                const qty = parseInt(editingQtyValue, 10);
                                if (!isNaN(qty)) {
                                  setDirectQty(item.medicationId, qty);
                                }
                                setEditingQtyId(null);
                                setEditingQtyValue('');
                              }}
                            >
                              <Text style={s.saveQtyText}>✓</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity onPress={() => {
                              setEditingQtyId(item.medicationId);
                              setEditingQtyValue(item.quantity.toString());
                            }}>
                              <Text style={s.qtyNum}>{item.quantity}</Text>
                            </TouchableOpacity>
                            <View style={s.stepper}>
                              <TouchableOpacity style={s.stepBtn} onPress={() => changeQty(item.medicationId, -1)}>
                                <Text style={s.stepBtnText}>−</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={s.stepBtn} onPress={() => changeQty(item.medicationId, 1)}>
                                <Text style={s.stepBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={s.refillBtn} onPress={() => refill(item.medicationId)}>
                              <AppIcon name="refresh-outline" size={14} color="#fff" />
                              <Text style={s.refillText}>Refill +30</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}

              {/* Add custom medication button */}
              <TouchableOpacity style={s.addCustomBtn} onPress={() => setShowAddMed(!showAddMed)}>
                <AppIcon name="add-circle-outline" size={20} color={theme.green} />
                <Text style={s.addCustomText}>Add medication not on schedule</Text>
              </TouchableOpacity>

              {showAddMed && (
                <View style={s.addCustomForm}>
                  <View style={s.formField}>
                    <Text style={s.formLabel}>Medication Name *</Text>
                    <TextInput
                      style={s.formInput}
                      placeholder="e.g., Vitamin D"
                      placeholderTextColor="#c0c0c0"
                      value={newMedName}
                      onChangeText={setNewMedName}
                    />
                  </View>
                  <View style={s.formField}>
                    <Text style={s.formLabel}>Dosage</Text>
                    <TextInput
                      style={s.formInput}
                      placeholder="e.g., 1000 IU"
                      placeholderTextColor="#c0c0c0"
                      value={newMedDosage}
                      onChangeText={setNewMedDosage}
                    />
                  </View>
                  <View style={s.formRow}>
                    <View style={[s.formField, { flex: 1 }]}>
                      <Text style={s.formLabel}>Initial Qty</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="30"
                        placeholderTextColor="#c0c0c0"
                        value={newMedQty}
                        onChangeText={setNewMedQty}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={[s.formField, { flex: 1 }]}>
                      <Text style={s.formLabel}>Unit</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="tablets"
                        placeholderTextColor="#c0c0c0"
                        value={newMedUnit}
                        onChangeText={setNewMedUnit}
                      />
                    </View>
                  </View>
                  <TouchableOpacity style={s.addMedSubmitBtn} onPress={addCustomMedication}>
                    <Text style={s.addMedSubmitText}>Add to Inventory</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 40, 22, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '88%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.greenLight,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: theme.green, letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 },
  sub: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  warnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff3e0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warnText: { fontSize: 13, fontWeight: '700', color: '#e65100' },
  list: { maxHeight: 360, paddingHorizontal: 16, paddingVertical: 12 },
  empty: { textAlign: 'center', color: theme.textMuted, paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
    backgroundColor: theme.surface,
  },
  rowLow: { borderColor: '#ffcc80', backgroundColor: '#fffaf5' },
  rowFocus: { borderColor: theme.green, borderWidth: 2 },
  medName: { fontSize: 15, fontWeight: '800', color: theme.text },
  medSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  stockLabel: { fontSize: 11, fontWeight: '700', color: theme.green, marginTop: 6 },
  qtyCol: { alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  stepBtnText: { fontSize: 18, fontWeight: '800', color: theme.green },
  qtyNum: { fontSize: 20, fontWeight: '900', color: theme.text, minWidth: 36, textAlign: 'center' },
  refillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  doneBtn: {
    margin: 16,
    backgroundColor: theme.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  editQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyInput: {
    width: 60,
    height: 36,
    borderWidth: 1.5,
    borderColor: theme.green,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  saveQtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveQtyText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.green,
    borderStyle: 'dashed',
    backgroundColor: theme.greenLight,
    marginTop: 8,
  },
  addCustomText: { fontSize: 14, fontWeight: '700', color: theme.green },
  addCustomForm: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    gap: 12,
  },
  formField: { gap: 6 },
  formLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  formInput: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  formRow: { flexDirection: 'row', gap: 12 },
  addMedSubmitBtn: {
    backgroundColor: theme.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addMedSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
