/** Linear scan — validation and sequential analytics. */

export function validateEmail(email: string): boolean {
  const t = email.trim();
  if (!t) return false;
  return /\S+@\S+\.\S+/.test(t);
}

export function validateAge(age: string | number): boolean {
  const n = typeof age === 'number' ? age : parseInt(String(age).trim(), 10);
  return Number.isFinite(n) && n >= 1 && n <= 120;
}

export function validateMedicationName(name: string): boolean {
  const t = name.trim();
  return t.length >= 1 && t.length <= 120;
}

/** Sequential pass over adherence rows (linear analytics). */
export function computeCompliancePercent(taken: number, total: number): number {
  if (total <= 0) return 0;
  let pct = 0;
  for (let i = 0; i < total; i++) {
    if (i < taken) pct += 100 / total;
  }
  return Math.round(pct);
}
