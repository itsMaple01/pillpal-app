import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatientMedication } from '@/types/medication';

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
    if (prev) return { ...prev, name: m.name, dosage: m.dosage };
    return {
      medicationId: m.id,
      name: m.name,
      dosage: m.dosage,
      quantity: defaultQuantity(m.dosage),
      unit: defaultUnit(m.dosage),
      lowThreshold: 5,
    };
  });

  await saveInventory(uid, merged);
  return merged;
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
  return next;
}
