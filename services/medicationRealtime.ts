import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getMedications } from '@/api/index';
import { db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check if db is initialized
if (!db) {
  console.error('Firebase db not initialized in medicationRealtime service');
}
import { cacheMedications, getCachedMedications } from '@/lib/offline/store';
import type { PatientMedication } from '@/types/medication';
import { getDoseDisplayStatus } from '@/lib/doseStatus';

const LAST_DATE_KEY = 'gabayra:last_medication_date';

/** Check if the date has changed since last medication check */
async function hasDateChanged(): Promise<boolean> {
  const today = new Date().toDateString();
  const lastDate = await AsyncStorage.getItem(LAST_DATE_KEY);
  if (lastDate !== today) {
    await AsyncStorage.setItem(LAST_DATE_KEY, today);
    return true;
  }
  return false;
}

/** Map DB rows to client medication objects (shared by realtime hook and schedule loader). */
export async function mapMedicationRows(rows: unknown[]): Promise<PatientMedication[]> {
  const dateChanged = await hasDateChanged();
  return rows.map((row: any) => {
    const time = row.time ?? row.program ?? '';
    const taken = row.taken ?? false;
    const takenAt = row.taken_at ?? null;
    const resetTaken = dateChanged ? false : taken;
    const doseStatus = getDoseDisplayStatus(time, resetTaken, takenAt);
    return {
      id: String(row.id),
      name: row.name ?? '',
      dosage: row.dosage ?? 'As prescribed',
      frequency: row.frequency ?? '',
      time,
      taken: resetTaken,
      firestoreId: row.firestore_id ?? undefined,
      suspended: row.suspended ?? false,
      notify_enabled: row.notify_enabled !== false,
      missed: doseStatus === 'missed',
      late: doseStatus === 'late',
      doseStatus,
      takenAt,
      currentStock: row.current_stock ?? undefined,
      refillThreshold: row.refill_threshold ?? undefined,
    };
  });
}

let firestoreRealtimeEnabled = true;

/**
 * Loads medications from the API (with offline cache), optionally listens to
 * Firestore `reminders` when permissions allow.
 */
export function subscribePatientMedications(
  patientUid: string,
  onUpdate: (medications: PatientMedication[]) => void,
): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const pull = async () => {
    try {
      const res = await getMedications(patientUid);
      const rows: unknown[] = Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
      const mapped = await mapMedicationRows(rows);
      await cacheMedications(patientUid, mapped);
      onUpdate(mapped);
    } catch {
      const cached = await getCachedMedications(patientUid);
      if (cached) onUpdate(cached);
    }
  };

  pull();

  if (!firestoreRealtimeEnabled || !db) {
    return () => {
      if (debounce) clearTimeout(debounce);
    };
  }

  const q = query(collection(db, 'reminders'), where('uid', '==', patientUid));
  const unsub = onSnapshot(
    q,
    () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(pull, 280);
    },
    err => {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'permission-denied' || String(err).includes('permission')) {
        firestoreRealtimeEnabled = false;
      }
    },
  );

  return () => {
    unsub();
    if (debounce) clearTimeout(debounce);
  };
}
