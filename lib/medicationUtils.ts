import { parseMedicationTime } from '@/utils/medicationTimeBucket';

export function isMedicationMissed(timeStr: string, taken: boolean): boolean {
  if (taken) return false;
  const parsed = parseMedicationTime(timeStr);
  if (!parsed) return false;

  const now = new Date();
  const medTime = new Date();
  medTime.setHours(parsed.hour, parsed.minute, 0, 0);

  // If medication time hasn't passed yet today → not missed
  if (medTime > now) return false;

  // Only missed if 30+ minutes have passed today
  const diffMs = now.getTime() - medTime.getTime();
  const diffMins = diffMs / (1000 * 60);
  return diffMins >= 30;
}
