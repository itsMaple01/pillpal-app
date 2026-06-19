const MANILA_TZ = 'Asia/Manila';

function parseMedicationTime(timeStr) {
  const t = (timeStr || '').trim();
  if (!t) return null;

  const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = parseInt(m12[2], 10);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return { hour: hour % 24, minute: minute % 60, label: t };
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    return {
      hour: parseInt(m24[1], 10) % 24,
      minute: parseInt(m24[2], 10) % 60,
      label: t,
    };
  }

  return null;
}

function getManilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type)?.value ?? '0';
  const hour = parseInt(get('hour'), 10) % 24;
  const minute = parseInt(get('minute'), 10) % 60;
  const second = parseInt(get('second'), 10) % 60;
  const today = `${get('year')}-${get('month')}-${get('day')}`;

  return {
    today,
    hour,
    minute,
    second,
    nowMinutes: hour * 60 + minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function manilaScheduledTimestamp(today, hour, minute) {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${today} ${h}:${m}:00`;
}

function isPastTwoHourWindow(scheduledAtUtcMs) {
  return Date.now() - scheduledAtUtcMs > 2 * 60 * 60 * 1000;
}

/** Convert Manila local datetime string to UTC epoch ms. */
function manilaLocalToUtcMs(today, hour, minute) {
  const iso = `${today}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`;
  return new Date(iso).getTime();
}

/** Calendar date YYYY-MM-DD in Asia/Manila for a Date or ISO string. */
function toManilaDateString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

module.exports = {
  MANILA_TZ,
  parseMedicationTime,
  getManilaNow,
  manilaScheduledTimestamp,
  isPastTwoHourWindow,
  manilaLocalToUtcMs,
  toManilaDateString,
};
