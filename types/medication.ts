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
  missed?: boolean;
  late?: boolean;
  doseStatus?: 'taken' | 'late' | 'missed' | 'upcoming' | 'pending';
  takenAt?: string | null;
  // Inventory tracking
  currentStock?: number;
  refillThreshold?: number;
  lastRefillDate?: string;
  // Prescription details
  prescriptionNumber?: string;
  doctorName?: string;
  pharmacyName?: string;
  // Instructions
  instructions?: string;
  takeWithFood?: boolean;
  // Multiple dosing times (comma-separated)
  additionalTimes?: string[];
}
