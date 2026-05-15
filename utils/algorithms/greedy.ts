/** Greedy — pick earliest safe local reminder slot without backtracking. */

export interface TimeSlot {
  hour: number;
  minute: number;
}

const DEFAULT_SLOTS: TimeSlot[] = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
];

function toMinutes({ hour, minute }: TimeSlot): number {
  return hour * 60 + minute;
}

function format12h(slot: TimeSlot): string {
  let h = slot.hour % 12;
  if (h === 0) h = 12;
  const mm = String(slot.minute).padStart(2, '0');
  const ap = slot.hour >= 12 ? 'PM' : 'AM';
  return `${String(h).padStart(2, '0')}:${mm} ${ap}`;
}

/**
 * Greedy earliest slot at or after `now` that is not within `bufferMinutes`
 * of any occupied slot.
 */
export function pickEarliestReminderSlot(
  occupied: TimeSlot[],
  now = new Date(),
  bufferMinutes = 30,
): string {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const blocked = occupied.map(toMinutes);

  const candidates = [...DEFAULT_SLOTS].sort((a, b) => toMinutes(a) - toMinutes(b));

  for (const slot of candidates) {
    const sm = toMinutes(slot);
    if (sm < nowMin) continue;
    const conflict = blocked.some(b => Math.abs(b - sm) < bufferMinutes);
    if (!conflict) return format12h(slot);
  }

  for (const slot of candidates) {
    const sm = toMinutes(slot);
    const conflict = blocked.some(b => Math.abs(b - sm) < bufferMinutes);
    if (!conflict) return format12h(slot);
  }

  return format12h(candidates[0]);
}

export function parseTimeSlot(timeStr: string): TimeSlot | null {
  const m = (timeStr || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && hour !== 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}
