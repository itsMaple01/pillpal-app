import axios from 'axios';
import { getUser, getUserByEmail, syncUser } from '@/api/index';

export type UserRole = 'patient' | 'caretaker';

function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

/** Load role from API; fall back to email lookup and migrate firebase_uid if needed. */
export async function resolveUserRole(
  uid: string,
  email: string | null | undefined,
): Promise<UserRole | null> {
  try {
    const res = await getUser(uid);
    const role = res.data?.role;
    if (role === 'patient' || role === 'caretaker') return role;
  } catch (err) {
    if (isNetworkError(err)) return null;
    if (!axios.isAxiosError(err) || err.response?.status !== 404) {
      throw err;
    }
  }

  const normalizedEmail = email?.trim();
  if (!normalizedEmail) return null;

  try {
    const res = await getUserByEmail(normalizedEmail);
    const row = res.data;
    const role = row?.role;
    if (role !== 'patient' && role !== 'caretaker') return null;

    if (row.firebase_uid !== uid) {
      try {
        await syncUser({
          firebase_uid: uid,
          email: normalizedEmail,
          role,
          full_name: row.full_name ?? undefined,
          age: row.age ?? undefined,
          health_condition: row.health_condition ?? undefined,
        });
      } catch (syncErr) {
        if (!isNetworkError(syncErr)) throw syncErr;
      }
    }
    return role;
  } catch (err) {
    if (isNetworkError(err)) return null;
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}
