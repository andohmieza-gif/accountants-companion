const SRS_KEY = "accountants-companion-flashcard-srs-v1";

type CardFace = { front: string };

type SrsCard = { due: number; intervalDays: number; ease: number };
type SrsStore = Record<string, Record<string, SrsCard>>;

function loadStore(): SrsStore {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" ? (p as SrsStore) : {};
  } catch {
    return {};
  }
}

function saveStore(s: SrsStore) {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function hashFront(front: string): string {
  let h = 0;
  for (let i = 0; i < front.length; i++) h = (Math.imul(31, h) + front.charCodeAt(i)) | 0;
  return `h${h}`;
}

/** Due cards and shorter intervals sort first so the deck feels like light spaced review. */
export function sortFlashcardsForReview<T extends CardFace>(topic: string, cards: T[]): T[] {
  const store = loadStore();
  const topicStore = store[topic] ?? {};
  const now = Date.now();
  return [...cards].sort((a: T, b: T) => {
    const da = topicStore[hashFront(a.front)]?.due ?? 0;
    const db = topicStore[hashFront(b.front)]?.due ?? 0;
    const overdueA = da <= now ? 0 : 1;
    const overdueB = db <= now ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    return da - db;
  });
}

export function recordFlashcardReview(topic: string, front: string, again: boolean) {
  const store = loadStore();
  if (!store[topic]) store[topic] = {};
  const h = hashFront(front);
  const prev = store[topic][h] ?? { due: 0, intervalDays: 0, ease: 2.35 };
  const now = Date.now();
  if (again) {
    store[topic][h] = {
      due: now + 45_000,
      intervalDays: 0,
      ease: Math.max(1.25, prev.ease - 0.18),
    };
  } else {
    const nextDays =
      prev.intervalDays <= 0 ? 1 : Math.max(1, Math.round(prev.intervalDays * prev.ease));
    store[topic][h] = {
      due: now + nextDays * 86_400_000,
      intervalDays: nextDays,
      ease: prev.ease + 0.04,
    };
  }
  saveStore(store);
}
