/** YYYY-MM-DD in local calendar (avoid UTC drift for "today"). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive calendar days with at least one study session, counting back from today (or from yesterday if today absent). */
export function computeStudyStreak(isoDayKeys: string[]): number {
  const set = new Set(isoDayKeys);
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!set.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = localDateKey(cursor);
    if (set.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function recordStudyDayInStorage(storageKey: string): string[] {
  try {
    const today = localDateKey(new Date());
    const raw = localStorage.getItem(storageKey);
    let days: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) days = parsed.filter((x): x is string => typeof x === "string");
    }
    if (!days.includes(today)) {
      days = [...days, today].slice(-400);
    }
    localStorage.setItem(storageKey, JSON.stringify(days));
    return days;
  } catch {
    return [];
  }
}

export function loadStudyDays(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * Map session focus text (exact topic name, "Drill: …", etc.) onto a picker label for quick-start.
 */
export function matchTopicFromFocus(focus: string | null | undefined, candidates: string[]): string | null {
  if (!focus || typeof focus !== "string") return null;
  let f = focus.trim().toLowerCase();
  if (!f) return null;
  f = f.replace(/^(drill|case)\s*:\s*/i, "").trim();

  const rows = candidates.map((c) => ({ c, l: c.toLowerCase() }));
  const exact = rows.find((x) => x.l === f);
  if (exact) return exact.c;

  const hits = rows.filter((x) => x.l.includes(f) || f.includes(x.l));
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].c;
  hits.sort((a, b) => b.l.length - a.l.length);
  return hits[0].c;
}
