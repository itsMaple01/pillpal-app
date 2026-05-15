import { fuzzyMatches } from '@/utils/algorithms/dynamic';

export interface SearchablePatient {
  id?: string;
  firebase_uid: string;
  full_name?: string | null;
  email?: string | null;
  age?: number | null;
}

/** Fuzzy + exact patient search (name, email, ID, age). */
export function patientMatchesSearch(patient: SearchablePatient, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;

  const qLower = q.toLowerCase();
  const name = (patient.full_name ?? '').trim();
  const email = (patient.email ?? '').trim();
  const uid = patient.firebase_uid ?? '';
  const numericId = String(patient.id ?? '').trim();

  if (name.toLowerCase().includes(qLower)) return true;
  if (email.toLowerCase().includes(qLower)) return true;
  if (uid.toLowerCase().includes(qLower)) return true;
  if (numericId && numericId.includes(q)) return true;

  const ageStr = patient.age != null ? String(patient.age) : '';
  if (ageStr && ageStr === q.replace(/\D/g, '')) return true;
  if (ageStr && qLower === `age ${ageStr}`) return true;

  if (fuzzyMatches(q, name) || fuzzyMatches(q, email)) return true;

  return false;
}
