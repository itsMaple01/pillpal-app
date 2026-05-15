/** Dynamic programming — edit distance for fuzzy patient search. */

export function levenshteinDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/** Normalized similarity 0–1 (1 = exact). */
export function fuzzySimilarity(a: string, b: string): number {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return 0;
  if (x.toLowerCase() === y.toLowerCase()) return 1;
  const maxLen = Math.max(x.length, y.length);
  const dist = levenshteinDistance(x, y);
  return Math.max(0, 1 - dist / maxLen);
}

export function fuzzyMatches(query: string, target: string, threshold = 0.55): boolean {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (!q) return true;
  if (!t) return false;
  if (t.includes(q)) return true;
  return fuzzySimilarity(q, t) >= threshold;
}
