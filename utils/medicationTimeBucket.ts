export type DayPart = 'Morning' | 'Afternoon' | 'Evening';

/** Buckets a medication time string like "08:30 AM" or "14:30" into Morning / Afternoon / Evening. */
export function medicationTimeBucket(timeStr: string): DayPart {
  const t = (timeStr || '').trim();
  const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let h = 12;
  if (m12) {
    h = parseInt(m12[1], 10);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
  } else {
    const m24 = t.match(/^(\d{1,2}):(\d{2})/);
    if (m24) h = parseInt(m24[1], 10) % 24;
  }
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  return 'Evening';
}
