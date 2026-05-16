import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getMedications } from '@/api/index';
import { db } from '@/lib/firebase';
import { cacheMedications, getCachedMedications } from '@/lib/offline/store';
import type { PatientMedication } from '@/types/medication';

/** Map DB rows to client medication objects (shared by realtime hook and schedule loader). */
export function mapMedicationRows(rows: unknown[]): PatientMedication[] {
  return rows.map((row: any) => ({
    id: String(row.id),
    name: row.name ?? '',
    dosage: row.dosage ?? 'As prescribed',
    frequency: row.frequency ?? '',
    time: row.time ?? row.program ?? '',
    taken: row.taken ?? false,
    firestoreId: row.firestore_id ?? undefined,
    suspended: row.suspended ?? false,
    notify_enabled: row.notify_enabled !== false,
  }));
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
      const mapped = mapMedicationRows(rows);
      await cacheMedications(patientUid, mapped);
      onUpdate(mapped);
    } catch {
      const cached = await getCachedMedications(patientUid);
      if (cached) onUpdate(cached);
    }
  };

  pull();

  if (!firestoreRealtimeEnabled) {
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
