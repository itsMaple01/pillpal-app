import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  ActivityIndicator, TextInput, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppIcon from '@/components/AppIcon';
import PatientSearchBar from '@/components/PatientSearchBar';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';
import type { PatientMedication } from '@/types/medication';
import {
  loadInventory,
  syncInventoryWithMeds,
  adjustInventoryQuantity,
  refillInventoryItem,
  saveInventoryItem,
  saveInventory,
  type InventoryItem,
} from '@/lib/medicationInventory';

interface Props {
  visible: boolean;
  uid: string;
  patientName?: string;
  medications: PatientMedication[];
  focusMedId?: string | null;
  onClose: () => void;
}

export default function MedicationInventoryScreen({
  visible,
  uid,
  patientName,
  medications,
  focusMedId,
  onClose,
}: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddScreen, setShowAddScreen] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedUnit, setNewMedUnit] = useState('tablets');
  const [newMedQty, setNewMedQty] = useState('30');
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const loadedForSession = useRef(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const merged = await syncInventoryWithMeds(uid, medications);
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }, [uid, medications]);

  useEffect(() => {
    if (!visible) {
      loadedForSession.current = false;
      setSearch('');
      setShowAddScreen(false);
      return;
    }
    if (!loadedForSession.current) {
      loadedForSession.current = true;
      loadItems();
    }
  }, [visible, loadItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) || i.dosage.toLowerCase().includes(q),
    );
  }, [items, search]);

  const changeQty = async (id: string, delta: number) => {
    const next = await adjustInventoryQuantity(uid, id, delta);
    setItems(next);
  };

  const refill = async (id: string) => {
    const next = await refillInventoryItem(uid, id, 30);
    setItems(next);
  };

  const setDirectQty = async (id: string, qty: number) => {
    const next = await saveInventoryItem(uid, id, { quantity: Math.max(0, qty) }, items);
    setItems(next);
  };

  const openAddScreen = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setNewMedName(item.name);
      setNewMedDosage(item.dosage);
      setNewMedUnit(item.unit);
      setNewMedQty(String(item.quantity));
    } else {
      setEditingItem(null);
      setNewMedName('');
      setNewMedDosage('');
      setNewMedUnit('tablets');
      setNewMedQty('30');
    }
    setShowAddScreen(true);
  };

  const closeAddScreen = () => {
    setShowAddScreen(false);
    setEditingItem(null);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedQty('30');
  };

  const submitAddOrEdit = async () => {
    if (!newMedName.trim()) {
      const msg = 'Please enter a medication name.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Required', msg);
      return;
    }

    if (editingItem) {
      const updatedItems = items.map(item =>
        item.medicationId === editingItem.medicationId
          ? {
              ...item,
              name: newMedName.trim(),
              dosage: newMedDosage.trim() || 'As prescribed',
              quantity: parseInt(newMedQty, 10) || item.quantity,
              unit: newMedUnit,
            }
          : item,
      );
      setItems(updatedItems);
      await saveInventory(uid, updatedItems);
    } else {
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
      await saveInventory(uid, updatedItems);
    }
    closeAddScreen();
  };

  const deleteItem = async (id: string) => {
    const runDelete = async () => {
      const updatedItems = items.filter(item => item.medicationId !== id);
      setItems(updatedItems);
      await saveInventory(uid, updatedItems);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this medication from inventory?')) await runDelete();
      return;
    }

    Alert.alert('Delete medication', 'Remove this medication from inventory?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  const lowCount = items.filter(i => i.quantity <= i.lowThreshold).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        {showAddScreen ? (
          <>
            <View style={s.header}>
              <TouchableOpacity onPress={closeAddScreen} style={s.backBtn}>
                <AppIcon name="arrow-back" size={24} color={theme.green} />
              </TouchableOpacity>
              <Text style={s.headerTitle}>
                {editingItem ? 'Edit medication' : 'Add medication'}
              </Text>
              <View style={s.backBtnSpacer} />
            </View>
            <ScrollView contentContainerStyle={s.addForm} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Medication name *</Text>
              <TextInput
                style={s.fieldInput}
                placeholder="e.g., Vitamin D"
                value={newMedName}
                onChangeText={setNewMedName}
              />
              <Text style={s.fieldLabel}>Dosage</Text>
              <TextInput
                style={s.fieldInput}
                placeholder="e.g., 1000 IU"
                value={newMedDosage}
                onChangeText={setNewMedDosage}
              />
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Quantity</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={newMedQty}
                    onChangeText={setNewMedQty}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Unit</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={newMedUnit}
                    onChangeText={setNewMedUnit}
                  />
                </View>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={submitAddOrEdit}>
                <Text style={s.primaryBtnText}>
                  {editingItem ? 'Save changes' : 'Add to inventory'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        ) : (
          <>
            <View style={s.header}>
              <TouchableOpacity onPress={onClose} style={s.backBtn}>
                <AppIcon name="arrow-back" size={24} color={theme.green} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle}>Medication inventory</Text>
                {patientName ? <Text style={s.headerSub}>{patientName}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => openAddScreen()} style={s.addIconBtn}>
                <AppIcon name="add" size={26} color={theme.green} />
              </TouchableOpacity>
            </View>

            <View style={s.searchWrap}>
              <PatientSearchBar value={search} onChangeText={setSearch} placeholder="Search medications..." />
            </View>

            {lowCount > 0 && (
              <View style={s.warnBar}>
                <AppIcon name="warning-outline" size={18} color="#e65100" />
                <Text style={s.warnText}>{lowCount} medication{lowCount > 1 ? 's' : ''} running low</Text>
              </View>
            )}

            {loading ? (
              <ActivityIndicator color={theme.green} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
                {filteredItems.length === 0 ? (
                  <Text style={s.empty}>
                    {search ? 'No medications match your search.' : 'No inventory items yet.'}
                  </Text>
                ) : (
                  filteredItems.map(item => {
                    const low = item.quantity <= item.lowThreshold;
                    const focused = item.medicationId === focusMedId;
                    const isEditing = editingQtyId === item.medicationId;
                    return (
                      <View key={item.medicationId} style={[s.row, low && s.rowLow, focused && s.rowFocus]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.medName}>{item.name}</Text>
                          <Text style={s.medSub}>{item.dosage}</Text>
                          <Text style={[s.stockValue, low && s.stockValueLow]}>
                            {item.quantity} {item.unit}
                          </Text>
                          <Text style={s.thresholdText}>Refill below {item.lowThreshold}</Text>
                        </View>
                        <View style={s.qtyCol}>
                          {isEditing ? (
                            <TextInput
                              style={s.qtyInput}
                              value={editingQtyValue}
                              onChangeText={setEditingQtyValue}
                              keyboardType="number-pad"
                              autoFocus
                              onSubmitEditing={() => {
                                const qty = parseInt(editingQtyValue, 10);
                                if (!isNaN(qty)) setDirectQty(item.medicationId, qty);
                                setEditingQtyId(null);
                              }}
                            />
                          ) : (
                            <>
                              <TouchableOpacity
                                onPress={() => {
                                  setEditingQtyId(item.medicationId);
                                  setEditingQtyValue(String(item.quantity));
                                }}
                              >
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
                                <Text style={s.refillText}>Refill +30</Text>
                              </TouchableOpacity>
                            </>
                          )}
                          <View style={s.actionRow}>
                            <TouchableOpacity onPress={() => openAddScreen(item)}>
                              <AppIcon name="create-outline" size={18} color={theme.green} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteItem(item.medicationId)}>
                              <AppIcon name="trash-outline" size={18} color="#c62828" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: '#f4faf4',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.border,
  },
  backBtnSpacer: { width: 40 },
  addIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: TEXT.lg, fontWeight: '800', color: '#222' },
  headerSub: { fontSize: TEXT.sm, color: theme.textSecondary, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  warnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff3e0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warnText: { fontSize: 13, fontWeight: '700', color: '#e65100' },
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  empty: { textAlign: 'center', color: theme.textMuted, paddingVertical: 32 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#fff',
  },
  rowLow: { borderColor: '#ffcc80', backgroundColor: '#fffaf5' },
  rowFocus: { borderColor: theme.green, borderWidth: 2 },
  medName: { fontSize: 16, fontWeight: '800', color: theme.text },
  medSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  stockValue: { fontSize: 15, fontWeight: '800', color: theme.green, marginTop: 8 },
  stockValueLow: { color: '#e65100' },
  thresholdText: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  qtyCol: { alignItems: 'center', gap: 6 },
  stepper: { flexDirection: 'row', gap: 8 },
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
  qtyNum: { fontSize: 20, fontWeight: '900', color: theme.text },
  refillBtn: {
    backgroundColor: theme.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  qtyInput: {
    width: 64,
    height: 36,
    borderWidth: 1.5,
    borderColor: theme.green,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  addForm: { padding: 20, gap: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '800', color: '#555' },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: '#fafafa',
  },
  formRow: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    backgroundColor: theme.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
