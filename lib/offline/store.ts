import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatientMedication } from '@/types/medication';

const PREFIX = 'pillpal:offline:';

export interface PatientSummary {
  id: string;
  firebase_uid: string;
  full_name: string;
  email: string;
  age: number;
  missed_doses: number;
  compliance: number;
  link_status: string;
  health_condition?: string;
}

export type OfflineMutation =
  | { id: string; type: 'medication_taken'; medicationId: number; taken: boolean; patientUid: string }
  | { id: string; type: 'link_redeem'; caretakerUid: string; code: string };

const medsKey = (uid: string) => `${PREFIX}meds:${uid}`;
const patientsKey = (uid: string) => `${PREFIX}patients:${uid}`;
const queueKey = `${PREFIX}mutation-queue`;

export async function cacheMedications(patientUid: string, meds: PatientMedication[]): Promise<void> {
  await AsyncStorage.setItem(medsKey(patientUid), JSON.stringify(meds));
}

export async function getCachedMedications(patientUid: string): Promise<PatientMedication[] | null> {
  const raw = await AsyncStorage.getItem(medsKey(patientUid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientMedication[];
  } catch {
    return null;
  }
}

export async function cachePatients(caretakerUid: string, patients: PatientSummary[]): Promise<void> {
  await AsyncStorage.setItem(patientsKey(caretakerUid), JSON.stringify(patients));
}

export async function getCachedPatients(caretakerUid: string): Promise<PatientSummary[] | null> {
  const raw = await AsyncStorage.getItem(patientsKey(caretakerUid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatientSummary[];
  } catch {
    return null;
  }
}

export async function enqueueMutation(mutation: OfflineMutation): Promise<void> {
  const raw = await AsyncStorage.getItem(queueKey);
  const queue: OfflineMutation[] = raw ? JSON.parse(raw) : [];
  queue.push(mutation);
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}

export async function getMutationQueue(): Promise<OfflineMutation[]> {
  const raw = await AsyncStorage.getItem(queueKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineMutation[];
  } catch {
    return [];
  }
}

export async function setMutationQueue(queue: OfflineMutation[]): Promise<void> {
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}
