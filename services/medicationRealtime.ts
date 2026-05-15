import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getMedications } from '@/api/index';
import { db } from '@/lib/firebase';
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

/**
 * Loads medications from the API, then keeps them in sync when Firestore
 * `reminders` change for this patient (e.g. another device or the caregiver view).
 */
export function subscribePatientMedications(
  patientUid: string,
  onUpdate: (medications: PatientMedication[]) => void,
): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const pull = () => {
    getMedications(patientUid)
      .then(res => {
        const rows: unknown[] = Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
        onUpdate(mapMedicationRows(rows));
      })
      .catch(err => console.error('getMedications failed:', err));
  };

  pull();

  const q = query(collection(db, 'reminders'), where('uid', '==', patientUid));
  const unsub = onSnapshot(
    q,
    () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(pull, 280);
    },
    err => console.error('reminders snapshot error:', err),
  );

  return () => {
    unsub();
    if (debounce) clearTimeout(debounce);
  };
}
