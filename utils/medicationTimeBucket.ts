export type DayPart = 'Morning' | 'Afternoon' | 'Evening';

export interface ParsedMedicationTime {
  hour: number;
  minute: number;
  label: string;
}

/** Parse "08:30 AM", "14:30", "8:00 PM" into 24h hour + display label. */
export function parseMedicationTime(timeStr: string): ParsedMedicationTime | null {
  const t = (timeStr || '').trim();
  if (!t) return null;

  const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return {
      hour: hour % 24,
      minute: minute % 60,
      label: `${m12[1].padStart(2, '0')}:${m12[2]} ${ap}`,
    };
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    const hour = parseInt(m24[1], 10) % 24;
    const minute = parseInt(m24[2], 10) % 60;
    const h12 = hour % 12 || 12;
    const ap = hour >= 12 ? 'PM' : 'AM';
    return {
      hour,
      minute,
      label: `${String(h12).padStart(2, '0')}:${m24[2]} ${ap}`,
    };
  }

  return null;
}

/** Buckets a medication time into Morning / Afternoon / Evening. */
export function medicationTimeBucket(timeStr: string): DayPart | null {
  const parsed = parseMedicationTime(timeStr);
  if (!parsed) return null;
  const h = parsed.hour;

  // Early morning (12am–4:59am) grouped with Morning, not Evening
  if (h < 5 || (h >= 5 && h < 12)) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  return 'Evening';
}
