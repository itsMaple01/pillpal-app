import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getMedications } from '@/api/index';
import { db } from '@/lib/firebase';
import { cacheMedications, getCachedMedications } from '@/lib/offline/store';
import type { PatientMedication } from '@/types/medication';
import { parseMedicationTime } from '@/utils/medicationTimeBucket';

/** Check if a medication time has passed (considered missed if 30+ minutes past). */
function isMedicationMissed(timeStr: string, taken: boolean): boolean {
  if (taken) return false;
  const parsed = parseMedicationTime(timeStr);
  if (!parsed) return false;
  
  const now = new Date();
  const medTime = new Date();
  medTime.setHours(parsed.hour, parsed.minute, 0, 0);
  
  // If medication time is tomorrow, not missed yet
  if (medTime > now) {
    medTime.setDate(medTime.getDate() - 1);
  }
  
  // Check if 30+ minutes have passed since medication time
  const diffMs = now.getTime() - medTime.getTime();
  const diffMins = diffMs / (1000 * 60);
  return diffMins >= 30;
}

/** Map DB rows to client medication objects (shared by realtime hook and schedule loader). */
export function mapMedicationRows(rows: unknown[]): PatientMedication[] {
  return rows.map((row: any) => {
    const time = row.time ?? row.program ?? '';
    const taken = row.taken ?? false;
    return {
      id: String(row.id),
      name: row.name ?? '',
      dosage: row.dosage ?? 'As prescribed',
      frequency: row.frequency ?? '',
      time,
      taken,
      firestoreId: row.firestore_id ?? undefined,
      suspended: row.suspended ?? false,
      notify_enabled: row.notify_enabled !== false,
      missed: isMedicationMissed(time, taken),
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
