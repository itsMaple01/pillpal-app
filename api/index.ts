import axios from 'axios';

const API_BASE = 'http://192.168.1.52:3001';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Users
export const syncUser = (data: {
  firebase_uid: string;
  email: string;
  role: string;
  full_name?: string;
  age?: number;
}) => api.post('/api/users/sync', data);

export const getUser = (uid: string) =>
  api.get(`/api/users/${uid}`);

// Medications
export const getMedications = (patient_uid: string) =>
  api.get(`/api/medications/${patient_uid}`);

export const addMedication = (data: {
  patient_uid: string;
  name: string;
  dosage?: string;
  frequency?: string;
  program?: string;
  start_date?: string;
  end_date?: string;
}) => api.post('/api/medications', data);

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