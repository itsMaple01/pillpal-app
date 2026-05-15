import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribePatientMedications } from '@/services/medicationRealtime';
import type { PatientMedication } from '@/types/medication';

/**
 * Real-time sync for caregiver dashboards: listens for patient activity
 * and per-patient medication changes (Firestore reminders → API pull).
 */
export function subscribeCaretakerOverview(
  patientUids: string[],
  handlers: {
    onOverviewChange: () => void;
    onPatientMeds?: (patientUid: string, meds: PatientMedication[]) => void;
  },
): () => void {
  const unsubs: (() => void)[] = [];
  let overviewDebounce: ReturnType<typeof setTimeout> | undefined;

  const notifyOverview = () => {
    if (overviewDebounce) clearTimeout(overviewDebounce);
    overviewDebounce = setTimeout(() => handlers.onOverviewChange(), 280);
  };

  const unique = [...new Set(patientUids.filter(Boolean))];

  for (const patientUid of unique) {
    unsubs.push(
      onSnapshot(
        doc(db, 'patient_activity', patientUid),
        () => notifyOverview(),
        err => console.warn('patient_activity snapshot:', err),
      ),
    );

    if (handlers.onPatientMeds) {
      unsubs.push(
        subscribePatientMedications(patientUid, meds => {
          handlers.onPatientMeds!(patientUid, meds);
        }),
      );
    }
  }

  return () => {
    unsubs.forEach(u => u());
    if (overviewDebounce) clearTimeout(overviewDebounce);
  };
}
