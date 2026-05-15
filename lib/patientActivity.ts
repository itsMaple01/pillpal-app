import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Notify linked caregivers / other devices that patient data changed. */
export async function bumpPatientActivity(
  patientUid: string,
  type: 'medication_update' | 'medication_taken' | 'profile_update' = 'medication_update',
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'patient_activity', patientUid),
      { type, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn('patient_activity bump failed:', e);
  }
}
