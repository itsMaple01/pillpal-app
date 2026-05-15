/** Shared medication shape for patient UI and realtime sync. */
export interface PatientMedication {
  id: string;
  firestoreId?: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  taken: boolean;
  suspended?: boolean;
  notify_enabled?: boolean;
}
