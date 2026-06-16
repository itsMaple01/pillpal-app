import { parseMedicationTime } from '@/utils/medicationTimeBucket';

export type DoseDisplayStatus = 'taken' | 'late' | 'missed' | 'upcoming' | 'pending';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function scheduledDateToday(timeStr: string): Date | null {
  const parsed = parseMedicationTime(timeStr);
  if (!parsed) return null;
  const scheduled = new Date();
  scheduled.setHours(parsed.hour, parsed.minute, 0, 0);
  return scheduled;
}

/** Clinical dose status: on-time within 2h, late after 2h, missed if 2h+ past with no action. */
export function getDoseDisplayStatus(
  timeStr: string,
  taken: boolean,
  takenAt?: string | Date | null,
): DoseDisplayStatus {
  const scheduled = scheduledDateToday(timeStr);
  if (!scheduled) return 'pending';

  const now = new Date();

  if (taken || takenAt) {
    const takenTime = takenAt ? new Date(takenAt) : now;
    if (takenTime.getTime() - scheduled.getTime() > TWO_HOURS_MS) return 'late';
    return 'taken';
  }

  if (now < scheduled) return 'upcoming';

  if (now.getTime() - scheduled.getTime() > TWO_HOURS_MS) return 'missed';
  return 'pending';
}

export function isMedicationMissed(
  timeStr: string,
  taken: boolean,
  takenAt?: string | Date | null,
): boolean {
  return getDoseDisplayStatus(timeStr, taken, takenAt) === 'missed';
}

export const DOSE_STATUS_COLORS: Record<DoseDisplayStatus, string> = {
  taken: '#2d7a3a',
  late: '#f9a825',
  missed: '#c62828',
  upcoming: '#bdbdbd',
  pending: '#9e9e9e',
};

export const DOSE_STATUS_ICONS: Record<DoseDisplayStatus, string> = {
  taken: 'checkmark-circle',
  late: 'time-outline',
  missed: 'close-circle',
  upcoming: 'ellipse-outline',
  pending: 'ellipse-outline',
};

export function getDoseStatusLabel(status: DoseDisplayStatus): string {
  switch (status) {
    case 'taken':
      return 'Taken';
    case 'late':
      return 'Late';
    case 'missed':
      return 'Missed';
    case 'upcoming':
      return 'Pending';
    case 'pending':
      return 'Pending';
    default:
      return 'Pending';
  }
}

export function resolveMedDoseStatus(med: {
  time: string;
  taken: boolean;
  missed?: boolean;
  late?: boolean;
  doseStatus?: DoseDisplayStatus;
  takenAt?: string | null;
}): DoseDisplayStatus {
  if (med.doseStatus) return med.doseStatus;
  return getDoseDisplayStatus(med.time, med.taken, med.takenAt);
}
