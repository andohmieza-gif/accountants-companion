export const CHAT_STUDY_CONTEXT_KEY = "accountants-companion-chat-study-context";

const MILESTONE_SNAPSHOT_KEY = "accountants-companion-milestone-snapshot-v1";

export type TopicStat = { correct: number; total: number };

export type MilestoneSnapshot = {
  totalQuizzes: number;
  totalFlashcardCards: number;
  caseStudyCompleted: number;
  bestStreak: number;
  gradedTotal: number;
  studyDayStreak: number;
};

export function persistChatStudyContext(payload: {
  topic: string;
  area: string;
  standards: string;
}) {
  try {
    const line = `Last study focus on this device: ${payload.topic} (${payload.area}). Standards setting: ${payload.standards}.`;
    localStorage.setItem(CHAT_STUDY_CONTEXT_KEY, line);
  } catch {
    /* ignore */
  }
}

export function readChatStudyContext(): string | null {
  try {
    const s = localStorage.getItem(CHAT_STUDY_CONTEXT_KEY);
    return s && s.trim().length > 0 ? s.trim() : null;
  } catch {
    return null;
  }
}

export function weakTopicsFromStats(
  topicStats: Record<string, TopicStat>,
  opts?: { minAttempts?: number; limit?: number }
): { topic: string; accuracy: number; total: number }[] {
  const minAttempts = opts?.minAttempts ?? 3;
  const limit = opts?.limit ?? 4;
  const rows = Object.entries(topicStats)
    .map(([topic, v]) => ({
      topic,
      total: v.total,
      accuracy: v.total > 0 ? v.correct / v.total : 0,
    }))
    .filter((r) => r.total >= minAttempts)
    .sort((a, b) => a.accuracy - b.accuracy);
  return rows.slice(0, limit);
}

function loadMilestoneSnapshot(): MilestoneSnapshot | null {
  try {
    const raw = localStorage.getItem(MILESTONE_SNAPSHOT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MilestoneSnapshot>;
    if (typeof p.totalQuizzes !== "number") return null;
    return {
      totalQuizzes: p.totalQuizzes,
      totalFlashcardCards: typeof p.totalFlashcardCards === "number" ? p.totalFlashcardCards : 0,
      caseStudyCompleted: typeof p.caseStudyCompleted === "number" ? p.caseStudyCompleted : 0,
      bestStreak: typeof p.bestStreak === "number" ? p.bestStreak : 0,
      gradedTotal: typeof p.gradedTotal === "number" ? p.gradedTotal : 0,
      studyDayStreak: typeof p.studyDayStreak === "number" ? p.studyDayStreak : 0,
    };
  } catch {
    return null;
  }
}

function saveMilestoneSnapshot(s: MilestoneSnapshot) {
  try {
    localStorage.setItem(MILESTONE_SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Call when stats change; returns at most one new milestone line, then saves snapshot. */
export function consumeMilestoneToasts(
  stats: {
    totalQuizzes: number;
    totalFlashcards: number;
    caseStudyCompleted: number;
    bestStreak: number;
    totalQuestions: number;
    caseStudyQuestionCount: number;
  },
  studyDayStreak: number
): string | null {
  const next: MilestoneSnapshot = {
    totalQuizzes: stats.totalQuizzes,
    totalFlashcardCards: stats.totalFlashcards,
    caseStudyCompleted: stats.caseStudyCompleted,
    bestStreak: stats.bestStreak,
    gradedTotal: stats.totalQuestions + stats.caseStudyQuestionCount,
    studyDayStreak,
  };

  const prev = loadMilestoneSnapshot();
  const msgs: string[] = [];
  if (prev) {
    if (stats.totalQuizzes >= 1 && prev.totalQuizzes < 1) msgs.push("First quiz in the books.");
    if (stats.totalQuizzes >= 10 && prev.totalQuizzes < 10) msgs.push("Ten quizzes. That is real momentum.");
    if (stats.caseStudyCompleted >= 1 && prev.caseStudyCompleted < 1) msgs.push("First case study cleared.");
    if (stats.bestStreak >= 5 && prev.bestStreak < 5) msgs.push("Five in a row. Hot streak.");
    if (stats.bestStreak >= 10 && prev.bestStreak < 10) msgs.push("Ten-answer streak. Unstoppable.");
    if (stats.totalFlashcards >= 50 && prev.totalFlashcardCards < 50) msgs.push("50 flashcards reviewed. Keep stacking reps.");
    if (next.gradedTotal >= 100 && prev.gradedTotal < 100) msgs.push("100 graded answers tracked. Scoreboard energy.");
    if (studyDayStreak >= 7 && prev.studyDayStreak < 7) msgs.push("One week of study days. Routine wins.");
  }
  saveMilestoneSnapshot(next);
  return msgs[0] ?? null;
}
