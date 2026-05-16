import axios from 'axios';
import { getApiBaseUrl } from '@/lib/apiConfig';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 25000,
});

// Users
export const syncUser = (data: {
  firebase_uid: string;
  email: string;
  role: string;
  full_name?: string;
  age?: number;
  health_condition?: string | null;
}) => api.post('/api/users/sync', data);

export const getUser = (uid: string) =>
  api.get(`/api/users/${uid}`);

export const updateUserProfile = (
  uid: string,
  body: { firebase_uid: string; full_name: string; age: number; health_condition?: string | null },
) => api.put(`/api/users/${uid}/profile`, body);

export const updateLinkedPatientProfile = (
  patientUid: string,
  body: { caretaker_uid: string; full_name?: string; age?: number; health_condition?: string | null },
) => api.put(`/api/users/${patientUid}/linked-profile`, body);

export const saveExpoPushToken = (uid: string, expo_push_token: string | null) =>
  api.patch(`/api/users/${uid}/push-token`, { expo_push_token });

export const setMedicationTaken = (id: number, taken: boolean) =>
  api.patch(`/api/medications/${id}/taken`, { taken });

export const updateMedication = (
  id: number,
  body: {
    name: string;
    dosage?: string;
    frequency?: string;
    time?: string;
    end_date?: string | null;
    suspended?: boolean;
    notify_enabled?: boolean;
  },
) => api.put(`/api/medications/${id}`, body);

export const refillMedication = (id: number) =>
  api.post(`/api/medications/${id}/refill`, {});

export const createLinkRequest = (body: { patient_uid: string; caretaker_email: string }) =>
  api.post('/api/linking/request', body);

export const getIncomingLinkRequests = (caretaker_uid: string) =>
  api.get(`/api/linking/incoming/${caretaker_uid}`);

export const acceptLinkRequest = (id: number, caretaker_uid: string) =>
  api.post(`/api/linking/request/${id}/accept`, { caretaker_uid });

export const rejectLinkRequest = (id: number, body: { caretaker_uid?: string; patient_uid?: string }) =>
  api.post(`/api/linking/request/${id}/reject`, body);

export const caregiverLinkRequest = (body: { caretaker_uid: string; patient_email: string }) =>
  api.post('/api/linking/caregiver-request', body);

export const getPatientIncomingLinkRequests = (patient_uid: string) =>
  api.get(`/api/linking/incoming-patient/${patient_uid}`);

export const acceptLinkRequestAsPatient = (id: number, patient_uid: string) =>
  api.post(`/api/linking/request/${id}/accept-by-patient`, { patient_uid });

export const generatePatientLinkCode = (patient_uid: string) =>
  api.post('/api/linking/code/generate', { patient_uid });

export const redeemPatientLinkCode = (caretaker_uid: string, code: string) =>
  api.post('/api/linking/code/redeem', { caretaker_uid, code });

export const getMedications = (patient_uid: string) =>
  api.get(`/api/medications/${patient_uid}`);

export const setMedicationFirestoreId = (id: number, firestore_id: string) =>
  api.patch(`/api/medications/${id}/firestore-id`, { firestore_id });

export const addMedication = (data: {
  // Accept either field name so callers don't break
  patient_uid?: string;
  firebase_uid?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  time?: string;       // ← added: used by PatientDashboard
  program?: string;
  start_date?: string;
  end_date?: string;
}) => {
  // Normalise: backend expects patient_uid
  const payload = {
    ...data,
    patient_uid: data.patient_uid ?? data.firebase_uid,
  };
  delete payload.firebase_uid;          // don't send both
  return api.post('/api/medications', payload);
};

export const deleteMedication = (id: number) =>
  api.delete(`/api/medications/${id}`);

// Doses
export const getTodayDoses = (patient_uid: string) =>
  api.get(`/api/doses/${patient_uid}/today`);

export const markDoseTaken = (id: number) =>
  api.patch(`/api/doses/${id}/take`);

// Patients (caretaker)
export const getLinkedPatients = (caretaker_uid: string) =>
  api.get(`/api/patients/${caretaker_uid}`);

export const linkPatient = (data: {
  caretaker_uid: string;
  patient_uid: string;
}) => api.post('/api/patients/link', data);

// Add this to your api/index.ts

export const getUserByEmail = (email: string) =>
  api.get(`/api/users/by-email/${encodeURIComponent(email)}`);

export const sendPatientReminder = (body: {
  caretaker_uid: string;
  patient_uid: string;
  message?: string;
}) => api.post('/api/reminders/send', body);