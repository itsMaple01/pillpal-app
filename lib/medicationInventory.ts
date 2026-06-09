import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatientMedication } from '@/types/medication';
import { updateMedicationInventory } from '@/api/index';

export interface InventoryItem {
  medicationId: string;
  name: string;
  dosage: string;
  quantity: number;
  unit: string;
  lowThreshold: number;
  lastRefillAt?: string;
}

const key = (uid: string) => `gabayra:inventory:${uid}`;

function defaultUnit(dosage: string): string {
  const d = dosage.toLowerCase();
  if (d.includes('ml')) return 'ml';
  if (d.includes('mg')) return 'doses';
  if (d.includes('tablet')) return 'tablets';
  return 'units';
}

function defaultQuantity(dosage: string): number {
  const m = dosage.match(/(\d+)/);
  return m ? Math.max(30, parseInt(m[1], 10) * 10) : 30;
}

export async function loadInventory(uid: string): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveInventory(uid: string, items: InventoryItem[]): Promise<void> {
  await AsyncStorage.setItem(key(uid), JSON.stringify(items));
}

/** Merge API medications with stored inventory (creates rows for new meds). */
export async function syncInventoryWithMeds(
  uid: string,
  meds: PatientMedication[],
): Promise<InventoryItem[]> {
  const existing = await loadInventory(uid);
  const byId = new Map(existing.map(i => [i.medicationId, i]));

  const merged: InventoryItem[] = meds.map(m => {
    const prev = byId.get(m.id);
    const quantity = m.currentStock ?? prev?.quantity ?? defaultQuantity(m.dosage);
    const lowThreshold = m.refillThreshold ?? prev?.lowThreshold ?? 5;
    if (prev) {
      return { ...prev, name: m.name, dosage: m.dosage, quantity, lowThreshold };
    }
    return {
      medicationId: m.id,
      name: m.name,
      dosage: m.dosage,
      quantity,
      unit: defaultUnit(m.dosage),
      lowThreshold,
    };
  });

  await saveInventory(uid, merged);
  return merged;
}

async function persistInventoryToApi(medicationId: string, quantity: number, lowThreshold: number) {
  const id = parseInt(medicationId, 10);
  if (Number.isNaN(id)) return;
  try {
    await updateMedicationInventory(id, {
      current_stock: quantity,
      refill_threshold: lowThreshold,
    });
  } catch (err) {
    console.error('[inventory] API save failed:', err);
  }
}

export async function saveInventoryItem(
  uid: string,
  medicationId: string,
  patch: { quantity?: number; lowThreshold?: number },
  currentItems: InventoryItem[],
): Promise<InventoryItem[]> {
  const next = currentItems.map(i =>
    i.medicationId === medicationId
      ? {
          ...i,
          quantity: patch.quantity ?? i.quantity,
          lowThreshold: patch.lowThreshold ?? i.lowThreshold,
        }
      : i,
  );
  await saveInventory(uid, next);
  const item = next.find(i => i.medicationId === medicationId);
  if (item) {
    await persistInventoryToApi(item.medicationId, item.quantity, item.lowThreshold);
  }
  return next;
}

export async function adjustInventoryQuantity(
  uid: string,
  medicationId: string,
  delta: number,
): Promise<InventoryItem[]> {
  const items = await loadInventory(uid);
  const next = items.map(i =>
    i.medicationId === medicationId
      ? { ...i, quantity: Math.max(0, i.quantity + delta) }
      : i,
  );
  await saveInventory(uid, next);
  const item = next.find(i => i.medicationId === medicationId);
  if (item) {
    await persistInventoryToApi(item.medicationId, item.quantity, item.lowThreshold);
  }
  return next;
}

export async function refillInventoryItem(
  uid: string,
  medicationId: string,
  amount = 30,
): Promise<InventoryItem[]> {
  const items = await loadInventory(uid);
  const next = items.map(i =>
    i.medicationId === medicationId
      ? {
          ...i,
          quantity: i.quantity + amount,
          lastRefillAt: new Date().toISOString(),
        }
      : i,
  );
  await saveInventory(uid, next);
  const item = next.find(i => i.medicationId === medicationId);
  if (item) {
    await persistInventoryToApi(item.medicationId, item.quantity, item.lowThreshold);
  }
  return next;
}
