import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Brain,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  RotateCcw,
  Loader2,
  Lightbulb,
  Trophy,
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  Flame,
  Zap,
  Target,
  Award,
  Volume2,
  VolumeX,
  Clock,
  BarChart3,
  Settings,
  Link2,
  Briefcase,
  PenLine,
  Copy,
  Crosshair,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computeStudyStreak,
  loadStudyDays,
  matchTopicFromFocus,
  recordStudyDayInStorage,
} from "@/lib/study-helpers";
import {
  getPromptById,
  JOURNAL_PRACTICE_PROMPTS,
  pickRandomPromptForTopic,
} from "@/lib/journal-practice";

// Storage key for study stats
const STUDY_STATS_KEY = "accountants-companion-study-stats";
const STUDY_SETTINGS_KEY = "accountants-companion-study-settings";
const CASE_DRAFT_KEY = "accountants-companion-case-draft";
const STUDY_ACTIVITY_KEY = "accountants-companion-study-activity";
const MATCH_BEST_TIME_KEY = "accountants-companion-match-best-times";
const STUDY_NAV_KEY = "accountants-companion-study-nav";
const JOURNAL_DRAFT_KEY = "accountants-companion-journal-draft";

type JournalDraftV1 = {
  v: 1;
  savedAt: number;
  memo: string;
  dateStr: string;
  entries: { account: string; debit: string; credit: string }[];
  promptId: string | null;
  exampleShown: boolean;
  showRules: boolean;
  caseHint: string | null;
  caseRefTitle: string | null;
};

const createEmptyJournalRows = (): { account: string; debit: string; credit: string }[] => [
  { account: "", debit: "", credit: "" },
  { account: "", debit: "", credit: "" },
];

type MatchPairCount = 4 | 6 | 8;

type Difficulty = "easy" | "medium" | "hard";
type StudyStats = {
  totalQuizzes: number;
  totalCorrect: number;
  totalQuestions: number;
  bestStreak: number;
  totalFlashcards: number;
  caseStudyCompleted: number;
  caseStudyCorrect: number;
  caseStudyQuestionCount: number;
  topicStats: Record<string, { correct: number; total: number }>;
};

type StudySettings = {
  soundEnabled: boolean;
  timedMode: boolean;
  difficulty: Difficulty;
  /** Quiz: learn with explanations; stats for that quiz are not saved. */
  quizPracticeMode: boolean;
  matchPairCount: MatchPairCount;
  matchTimedChallenge: boolean;
  caseFeedbackStyle: "coaching" | "exam";
};

const defaultStats: StudyStats = {
  totalQuizzes: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  bestStreak: 0,
  totalFlashcards: 0,
  caseStudyCompleted: 0,
  caseStudyCorrect: 0,
  caseStudyQuestionCount: 0,
  topicStats: {},
};

const defaultSettings: StudySettings = {
  soundEnabled: true,
  timedMode: false,
  difficulty: "medium",
  quizPracticeMode: false,
  matchPairCount: 6,
  matchTimedChallenge: false,
  caseFeedbackStyle: "coaching",
};

// Simple sound effects using Web Audio API
const playSound = (type: "correct" | "wrong" | "complete" | "tick", enabled: boolean) => {
  if (!enabled || typeof window === "undefined") return;
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case "correct":
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case "wrong":
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      case "complete":
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
          gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
          osc.start(audioContext.currentTime + i * 0.15);
          osc.stop(audioContext.currentTime + i * 0.15 + 0.3);
        });
        break;
      case "tick":
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
        break;
    }
  } catch (e) {
    // Silently fail if audio not supported
  }
};

const DIFFICULTY_CONFIG = {
  easy: { time: 45, label: "Easy", color: "text-emerald-500" },
  medium: { time: 30, label: "Medium", color: "text-amber-500" },
  hard: { time: 15, label: "Hard", color: "text-red-500" },
};

// Confetti: skips when user prefers reduced motion; `subtle` for small wins (e.g. journal balanced)
function Confetti({
  active,
  reducedMotion,
  subtle,
}: {
  active: boolean;
  reducedMotion?: boolean | null;
  subtle?: boolean;
}) {
  if (!active || reducedMotion) return null;

  const count = subtle ? 32 : 52;
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.45,
    duration: 0.85 + Math.random() * 1.1,
    color: ["#10b981", "#34d399", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#22d3ee"][
      Math.floor(Math.random() * 7)
    ],
    size: subtle ? 2 + Math.random() * 2 : 2.5 + Math.random() * 2.5,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -24, x: `${p.x}vw`, opacity: 1, scale: 1 }}
          animate={{
            y: "100vh",
            opacity: 0,
            scale: 0,
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
          className="absolute rounded-full shadow-sm"
          style={{ backgroundColor: p.color, width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}

function StudyAmbientLayer({ theme, reducedMotion }: { theme: "light" | "dark"; reducedMotion: boolean | null }) {
  if (reducedMotion) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      <motion.div
        aria-hidden
        className={cn(
          "absolute -left-[20%] -top-[30%] h-[min(24rem,55vh)] w-[min(24rem,55vw)] rounded-full blur-3xl",
          theme === "dark" ? "bg-emerald-500/12" : "bg-emerald-400/20"
        )}
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className={cn(
          "absolute -bottom-[25%] -right-[15%] h-[min(22rem,50vh)] w-[min(22rem,50vw)] rounded-full blur-3xl",
          theme === "dark" ? "bg-violet-500/10" : "bg-sky-400/18"
        )}
        animate={{ opacity: [0.25, 0.5, 0.25], scale: [1.05, 1, 1.05] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full blur-2xl",
          theme === "dark" ? "bg-cyan-500/8" : "bg-teal-300/15"
        )}
        animate={{ opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
    </div>
  );
}

type Tab = "quiz" | "casestudy" | "flashcards" | "match" | "journal";

type MatchTile = {
  id: string;
  pairId: number;
  side: "term" | "definition";
  text: string;
};

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
}

type CaseStudyQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type CaseStudyWrittenExercise = {
  role: string;
  prompt: string;
  outline: string[];
};

type CaseStudyPayload = {
  title: string;
  context: string;
  scenario: string;
  questions: CaseStudyQuestion[];
  practiceNotes: string;
  journalPractice?: string;
  discussionQuestions?: string[];
  writtenExercises?: CaseStudyWrittenExercise[];
};

type McqMistake = {
  qIndex: number;
  selected: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type CaseDraftV1 = {
  v: 1;
  savedAt: number;
  caseStudyTopic: string;
  caseStudyPhase: "mcq" | "written" | "results";
  caseStudyPayload: CaseStudyPayload;
  caseStudyQIndex: number;
  caseStudyScore: number;
  caseStudyWrittenText: string[];
  caseStudySelected: number | null;
  caseStudyShowResult: boolean;
  caseWrittenSelfScore?: (number | null)[];
};

type CaseStudyWrittenFeedbackSlot = {
  loading: boolean;
  text: string | null;
  error: string | null;
};

export interface StudyModeProps {
  theme: "light" | "dark";
}

const QUIZ_TOPICS = [
  { name: "Financial Statements", icon: "📊" },
  { name: "Revenue Recognition (ASC 606)", icon: "💰" },
  { name: "Leases (ASC 842)", icon: "🏢" },
  { name: "Depreciation Methods", icon: "📉" },
  { name: "Inventory Valuation", icon: "📦" },
  { name: "Bond Accounting", icon: "📜" },
  { name: "Cash Flow Statement", icon: "💵" },
  { name: "Audit Procedures", icon: "🔍" },
  { name: "Income Taxes (ASC 740)", icon: "🧾" },
  { name: "Fair Value (ASC 820)", icon: "⚖️" },
  { name: "Equity & Stock Compensation", icon: "📈" },
  { name: "Consolidations & Business Combinations", icon: "🤝" },
  { name: "Internal Control & Fraud Risk", icon: "🛡️" },
  { name: "Foreign Currency (ASC 830)", icon: "🌍" },
  { name: "Payroll & Employee Benefits", icon: "👥" },
  { name: "Property, Plant & Equipment", icon: "🏭" },
];

/** Applied scenarios: same themes as quiz, written as narrative case studies. */
const CASE_STUDY_TOPICS = QUIZ_TOPICS;

const FLASHCARD_TOPICS = [
  { name: "Basic Accounting Terms", icon: "📚" },
  { name: "Financial Ratios", icon: "📈" },
  { name: "Journal Entry Rules", icon: "✍️" },
  { name: "GAAP Principles", icon: "📋" },
  { name: "Audit Assertions", icon: "✅" },
  { name: "Financial Statement Line Items", icon: "📊" },
  { name: "Revenue Recognition (ASC 606)", icon: "💰" },
  { name: "Leases (ASC 842)", icon: "🏢" },
  { name: "Inventory & COGS", icon: "📦" },
  { name: "Fixed Assets & Depreciation", icon: "📉" },
  { name: "Income Taxes (ASC 740)", icon: "🧾" },
  { name: "Debt, Bonds & Interest", icon: "📜" },
  { name: "Cash Flow & Liquidity", icon: "💵" },
  { name: "Ethics & Professional Conduct", icon: "⚖️" },
];

/** Topics for Match mode (dedicated prompts so definitions are not trivial to pair). */
const MATCH_TOPICS = FLASHCARD_TOPICS;

function buildMatchTilesFromCards(cards: Flashcard[], pairCount: number): MatchTile[] {
  const n = Math.max(2, Math.min(pairCount, cards.length));
  const subset = cards.slice(0, n);
  const tiles: MatchTile[] = [];
  subset.forEach((card, i) => {
    tiles.push({
      id: `t-${i}-term`,
      pairId: i,
      side: "term",
      text: card.front,
    });
    tiles.push({
      id: `t-${i}-def`,
      pairId: i,
      side: "definition",
      text: card.back,
    });
  });
  return shuffleArray(tiles);
}

const QUIZ_LOADING_MESSAGES = [
  { text: "Brewing some brain teasers...", emoji: "🧪" },
  { text: "Consulting the accounting gods...", emoji: "🔮" },
  { text: "Making sure debits equal credits...", emoji: "⚖️" },
  { text: "Sharpening your pencils...", emoji: "✏️" },
  { text: "Counting beans (it's what we do)...", emoji: "🫘" },
  { text: "Balancing the trial balance...", emoji: "📊" },
  { text: "Double-checking for materiality...", emoji: "🔍" },
  { text: "Almost there, promise!", emoji: "🏃" },
  { text: "Waking up the number crunchers...", emoji: "🧮" },
  { text: "Recalculating depreciation...", emoji: "📉" },
  { text: "Checking if LIFO or FIFO...", emoji: "📦" },
  { text: "Auditing the question bank...", emoji: "🔎" },
  { text: "Running internal controls...", emoji: "🎛️" },
  { text: "Verifying account balances...", emoji: "✅" },
  { text: "Preparing your challenge...", emoji: "🎯" },
  { text: "This is gonna be good...", emoji: "😎" },
  { text: "Loading CPA-level difficulty...", emoji: "💪" },
  { text: "Calibrating brain cells...", emoji: "🧬" },
  { text: "Accruing more patience (and questions)...", emoji: "⏳" },
  { text: "Telling the spreadsheet it's definitely not 'just a phase'...", emoji: "📗" },
  { text: "Explaining to management why we can't 'just round'...", emoji: "🤷" },
  { text: "Convincing the trial balance to behave...", emoji: "🙏" },
  { text: "Rolling forward last year's jokes… I mean, workpapers…", emoji: "📎" },
  { text: "Materiality: low for this loader, high for your ego after a perfect score", emoji: "📏" },
  { text: "Asking the partner for sign-off (they're busy; we're still writing your quiz)", emoji: "✍️" },
  { text: "Capitalizing fun, expensing stress: GAAP says no, we say maybe", emoji: "😅" },
  { text: "Footnotes: there will be jokes. Substance over form.", emoji: "📝" },
  { text: "Impairment testing your attention span…", emoji: "🔋" },
  { text: "Reconciling you vs. the answer key (friendly fire)", emoji: "🤝" },
  { text: "Substantive procedures on procrastination… inconclusive", emoji: "🛋️" },
  { text: "Cash basis: how we pay for pizza. Accrual basis: how we study.", emoji: "🍕" },
  { text: "If debits and credits had a podcast, you'd be episode one", emoji: "🎙️" },
  { text: "Sampling your brain for relevant assertions…", emoji: "🧠" },
  { text: "Independence threat: we're rooting for you anyway", emoji: "🦸" },
  { text: "Work-in-progress: like inventory, but with questions", emoji: "🏭" },
  { text: "Tick-and-tie, but make it multiple choice", emoji: "✔️" },
  { text: "Going concern: you, after this quiz (you'll be fine)", emoji: "☕" },
];

const FLASHCARD_LOADING_MESSAGES = [
  { text: "Crafting knowledge nuggets...", emoji: "💎" },
  { text: "Condensing wisdom...", emoji: "📚" },
  { text: "Making things stick...", emoji: "🧠" },
  { text: "Preparing bite-sized brilliance...", emoji: "✨" },
  { text: "Folding paper virtually...", emoji: "📄" },
  { text: "Loading accounting wisdom...", emoji: "🦉" },
  { text: "Almost ready to flip!", emoji: "🃏" },
  { text: "Summarizing the textbook...", emoji: "📖" },
  { text: "Extracting key concepts...", emoji: "🔑" },
  { text: "Making memorization easier...", emoji: "🎓" },
  { text: "Distilling complex topics...", emoji: "⚗️" },
  { text: "Creating mental shortcuts...", emoji: "🛤️" },
  { text: "Packaging knowledge pills...", emoji: "💊" },
  { text: "Your brain will thank you...", emoji: "🙏" },
  { text: "Study smarter, not harder...", emoji: "🚀" },
  { text: "Flash! Ahh-ahh...", emoji: "⚡" },
  { text: "Compressing GAAP into snack size (do not eat the cards)", emoji: "🍿" },
  { text: "Front: term. Back: the thing you swear you knew yesterday", emoji: "🪞" },
  { text: "Turning paragraphs into punchy one-liners…", emoji: "🥊" },
  { text: "Memorize now, impress people at parties later (results may vary)", emoji: "🎉" },
  { text: "Spaced repetition called: it wants its royalties", emoji: "📞" },
  { text: "If flashcards were currency, you'd be rich soon", emoji: "💰" },
  { text: "Loading… like closing the books, but faster", emoji: "⏱️" },
  { text: "Your future self is already grateful (slightly smug)", emoji: "🦚" },
  { text: "Index cards wish they were this digital", emoji: "💳" },
  { text: "Mnemonics loading… or however you pronounce that", emoji: "🔤" },
  { text: "Flip phone era is over; flip cards era is now", emoji: "📱" },
  { text: "Cramming ethically (oxymoron, but we try)", emoji: "⚖️" },
  { text: "Synapses doing light cardio…", emoji: "🏃‍♀️" },
  { text: "TL;DR machine go brrr (politely)", emoji: "🤖" },
  { text: "Flashcards: the original stack overflow", emoji: "📚" },
  { text: "Still better than rereading chapter 12 for the fifth time", emoji: "😵" },
  { text: "Packaging dopamine with depreciation facts", emoji: "🎁" },
];

const MATCH_LOADING_MESSAGES = [
  { text: "Shuffling pairs like a deck of journal lines...", emoji: "🃏" },
  { text: "Making sure term doesn't marry term (awkward audit finding)", emoji: "💒" },
  { text: "Speed-dating definitions with concepts…", emoji: "💘" },
  { text: "Matching harder than bank rec on a Friday…", emoji: "🏦" },
  { text: "Linking like it's VLOOKUP but you're the formula", emoji: "🔗" },
  { text: "Pairs: not just for socks and audit samples", emoji: "🧦" },
  { text: "Tile entropy approaching maximum fun…", emoji: "🎲" },
  { text: "Reconciling left brain with right brain…", emoji: "🧠" },
  { text: "Almost ready: stretch those click fingers", emoji: "🖱️" },
  { text: "If this were Excel, we'd merge cells (we won't)", emoji: "📗" },
  { text: "Building bridges between words and meanings…", emoji: "🌉" },
  { text: "Control match: design effective, operation hilarious", emoji: "🎮" },
  { text: "Two columns enter, one truth leaves", emoji: "🥊" },
  { text: "Memorization meets memory game…", emoji: "🧩" },
];

const CASE_STUDY_LOADING_MESSAGES = [
  { text: "Drafting a realistic client situation...", emoji: "📋" },
  { text: "Building facts you can reason from...", emoji: "🏗️" },
  { text: "What would the controller do?", emoji: "🤔" },
  { text: "Grounding the case in U.S. GAAP...", emoji: "⚖️" },
  { text: "Almost ready to read...", emoji: "📖" },
  { text: "Sharpening professional judgment...", emoji: "🎯" },
  { text: "Checking materiality (metaphorically)...", emoji: "🔍" },
  { text: "This one could happen on the job...", emoji: "💼" },
  { text: "Inventing a company that definitely isn't your employer…", emoji: "🏢" },
  { text: "Adding drama (the professional kind)", emoji: "🎭" },
  { text: "Client says 'it's immaterial'; we say 'nice try'", emoji: "🍿" },
  { text: "Watering the facts until they grow into a narrative", emoji: "🌱" },
  { text: "Related parties: fictional, but the stress is real", emoji: "👯" },
  { text: "Writing the memo you'd actually want to read", emoji: "✍️" },
  { text: "Simulating busy season without the overtime", emoji: "🌙" },
  { text: "Professional skepticism: loading… 47%", emoji: "🧐" },
  { text: "If this were a PDF, it'd be 40 pages. You're welcome.", emoji: "📎" },
  { text: "Escalating issues… to the next loading message", emoji: "📣" },
  { text: "Substantive procedures on storytelling…", emoji: "📚" },
  { text: "Management representation letter: 'we're fun' (unsigned)", emoji: "😇" },
  { text: "Risk assessment: you might actually learn something", emoji: "⚠️" },
  { text: "Workpaper W-1: Witty banter (required field)", emoji: "🗂️" },
  { text: "Confirming cash… just kidding, we're still writing the case", emoji: "💵" },
  { text: "The engagement letter said 'reasonable assurance.' We added jokes", emoji: "📜" },
  { text: "Brain-friendly font, soul-crushing standards", emoji: "🔤" },
];

const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function StudyMode({ theme }: StudyModeProps) {
  const [studySection, setStudySection] = useState<"practice" | "case" | "journal">("practice");
  const [drillTab, setDrillTab] = useState<"quiz" | "flashcards" | "match">("quiz");

  const activeTab: Tab =
    studySection === "case"
      ? "casestudy"
      : studySection === "journal"
      ? "journal"
      : drillTab;

  const goToTab = useCallback((tab: Tab) => {
    if (tab === "casestudy") {
      setStudySection("case");
      return;
    }
    if (tab === "journal") {
      setStudySection("journal");
      return;
    }
    setStudySection("practice");
    setDrillTab(tab);
  }, []);

  const goToJournalFromDrill = useCallback(
    (topic: string) => {
      const p = pickRandomPromptForTopic(topic);
      setJournalCaseHint(null);
      setJournalCaseRefTitle(null);
      setJournalPromptId(p.id);
      setJournalExampleRevealed(false);
      setJournalEntries(createEmptyJournalRows());
      setJournalMemo(`Drill: ${topic}`);
      setJournalDateStr("");
      setSessionFocusTopic(topic);
      goToTab("journal");
    },
    [goToTab]
  );

  const [quizTopic, setQuizTopic] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeRanOut, setTimeRanOut] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [shuffledQuizMsgs, setShuffledQuizMsgs] = useState(QUIZ_LOADING_MESSAGES);
  const [shuffledFlashcardMsgs, setShuffledFlashcardMsgs] = useState(FLASHCARD_LOADING_MESSAGES);
  const [shuffledMatchMsgs, setShuffledMatchMsgs] = useState(MATCH_LOADING_MESSAGES);
  const [shuffledCaseStudyMsgs, setShuffledCaseStudyMsgs] = useState(CASE_STUDY_LOADING_MESSAGES);
  const [streak, setStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const [flashcardTopic, setFlashcardTopic] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const [matchTopic, setMatchTopic] = useState<string | null>(null);
  const [matchTiles, setMatchTiles] = useState<MatchTile[]>([]);
  const [matchMatched, setMatchMatched] = useState<Set<number>>(() => new Set());
  const [matchSelectedId, setMatchSelectedId] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchComplete, setMatchComplete] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [caseStudyTopic, setCaseStudyTopic] = useState<string | null>(null);
  const [caseStudyPayload, setCaseStudyPayload] = useState<CaseStudyPayload | null>(null);
  const [caseStudyLoading, setCaseStudyLoading] = useState(false);
  const [caseStudyError, setCaseStudyError] = useState<string | null>(null);
  const [caseStudyQIndex, setCaseStudyQIndex] = useState(0);
  const [caseStudySelected, setCaseStudySelected] = useState<number | null>(null);
  const [caseStudyShowResult, setCaseStudyShowResult] = useState(false);
  const [caseStudyPhase, setCaseStudyPhase] = useState<"mcq" | "written" | "results">("mcq");
  const [caseStudyScore, setCaseStudyScore] = useState(0);
  const [caseStudyWrittenText, setCaseStudyWrittenText] = useState<string[]>([]);
  const [caseStudyOutlineVisible, setCaseStudyOutlineVisible] = useState<boolean[]>([]);
  const [caseStudyFeedback, setCaseStudyFeedback] = useState<CaseStudyWrittenFeedbackSlot[]>([]);

  // New features state
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [settings, setSettings] = useState<StudySettings>(defaultSettings);
  const [stats, setStats] = useState<StudyStats>(defaultStats);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [maxStreak, setMaxStreak] = useState(0);
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [quizMistakes, setQuizMistakes] = useState<McqMistake[]>([]);
  const [caseMcqMistakes, setCaseMcqMistakes] = useState<McqMistake[]>([]);
  const [journalCaseHint, setJournalCaseHint] = useState<string | null>(null);
  const [journalCaseRefTitle, setJournalCaseRefTitle] = useState<string | null>(null);
  const [journalMemo, setJournalMemo] = useState("");
  const [journalDateStr, setJournalDateStr] = useState("");
  const [journalPromptId, setJournalPromptId] = useState<string | null>(null);
  const [journalShowRules, setJournalShowRules] = useState(false);
  const [journalExampleRevealed, setJournalExampleRevealed] = useState(false);
  const [journalHydrated, setJournalHydrated] = useState(false);
  const [journalCopied, setJournalCopied] = useState(false);
  const [journalEntries, setJournalEntries] = useState(createEmptyJournalRows);
  const [caseScenarioOpen, setCaseScenarioOpen] = useState(true);
  const [caseWrittenSelfScore, setCaseWrittenSelfScore] = useState<(number | null)[]>([]);
  const [flashcardHardQueue, setFlashcardHardQueue] = useState<number[]>([]);
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [matchCombo, setMatchCombo] = useState(0);
  const [matchBestSession, setMatchBestSession] = useState<number | null>(null);
  const [pendingCaseDraft, setPendingCaseDraft] = useState<CaseDraftV1 | null>(null);
  /** Last topic the learner explicitly started (quiz, case, cards, or match). */
  const [sessionFocusTopic, setSessionFocusTopic] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [journalConfetti, setJournalConfetti] = useState(false);

  const reduceMotion = useReducedMotion();
  const topicStagger = useMemo(() => {
    if (reduceMotion) {
      return {
        container: { hidden: {}, show: { transition: { staggerChildren: 0 } } } as const,
        item: { hidden: {}, show: {} } as const,
      };
    }
    return {
      container: {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.055, delayChildren: 0.06 },
        },
      } as const,
      item: {
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: "spring" as const, stiffness: 400, damping: 28 },
        },
      } as const,
    };
  }, [reduceMotion]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const matchTickRef = useRef<NodeJS.Timeout | null>(null);
  const caseDraftSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const skipFirstNavPersist = useRef(true);
  const journalBalancedRef = useRef(false);
  const journalConfettiTimerRef = useRef<number | null>(null);

  // Load settings and stats from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STUDY_SETTINGS_KEY);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings) as Partial<StudySettings>;
          const mpc = parsed.matchPairCount;
          const pairOk = mpc === 4 || mpc === 6 || mpc === 8;
          setSettings({
            ...defaultSettings,
            ...parsed,
            matchPairCount: pairOk ? mpc : defaultSettings.matchPairCount,
            caseFeedbackStyle:
              parsed.caseFeedbackStyle === "exam" ? "exam" : "coaching",
          });
        } catch {
          /* ignore */
        }
      }

      setStudyDays(loadStudyDays(STUDY_ACTIVITY_KEY));

      try {
        const navRaw = localStorage.getItem(STUDY_NAV_KEY);
        if (navRaw) {
          const nav = JSON.parse(navRaw) as { section?: string; drill?: string };
          if (nav.section === "case" || nav.section === "journal" || nav.section === "practice") {
            setStudySection(nav.section);
          }
          if (nav.drill === "quiz" || nav.drill === "flashcards" || nav.drill === "match") {
            setDrillTab(nav.drill);
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const draftRaw = localStorage.getItem(CASE_DRAFT_KEY);
        if (draftRaw) {
          const d = JSON.parse(draftRaw) as CaseDraftV1;
          if (d?.v === 1 && d.caseStudyPayload && Date.now() - d.savedAt < 30 * 60 * 60 * 1000) {
            setPendingCaseDraft(d);
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const jr = localStorage.getItem(JOURNAL_DRAFT_KEY);
        if (jr) {
          const d = JSON.parse(jr) as JournalDraftV1;
          if (d?.v === 1 && Array.isArray(d.entries) && d.entries.length >= 2) {
            setJournalMemo(typeof d.memo === "string" ? d.memo : "");
            setJournalDateStr(typeof d.dateStr === "string" ? d.dateStr : "");
            setJournalPromptId(typeof d.promptId === "string" ? d.promptId : null);
            setJournalExampleRevealed(d.exampleShown === true);
            setJournalShowRules(d.showRules === true);
            setJournalCaseHint(typeof d.caseHint === "string" ? d.caseHint : null);
            setJournalCaseRefTitle(typeof d.caseRefTitle === "string" ? d.caseRefTitle : null);
            setJournalEntries(
              d.entries.map((e) => ({
                account: typeof e.account === "string" ? e.account : "",
                debit: typeof e.debit === "string" ? e.debit : "",
                credit: typeof e.credit === "string" ? e.credit : "",
              }))
            );
          }
        }
      } catch {
        /* ignore */
      }

      const savedStats = localStorage.getItem(STUDY_STATS_KEY);
      if (savedStats) {
        try {
          const parsed = JSON.parse(savedStats) as Partial<StudyStats>;
          setStats({
            ...defaultStats,
            ...parsed,
            topicStats:
              parsed.topicStats && typeof parsed.topicStats === "object" ? parsed.topicStats : {},
          });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      // Ignore errors
    }
    setJournalHydrated(true);
  }, []);

  useEffect(() => {
    if (!journalHydrated) return;
    const t = window.setTimeout(() => {
      try {
        const draft: JournalDraftV1 = {
          v: 1,
          savedAt: Date.now(),
          memo: journalMemo,
          dateStr: journalDateStr,
          entries: journalEntries,
          promptId: journalPromptId,
          exampleShown: journalExampleRevealed,
          showRules: journalShowRules,
          caseHint: journalCaseHint,
          caseRefTitle: journalCaseRefTitle,
        };
        localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [
    journalHydrated,
    journalMemo,
    journalDateStr,
    journalEntries,
    journalPromptId,
    journalExampleRevealed,
    journalShowRules,
    journalCaseHint,
    journalCaseRefTitle,
  ]);

  useEffect(() => {
    if (skipFirstNavPersist.current) {
      skipFirstNavPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(
        STUDY_NAV_KEY,
        JSON.stringify({ section: studySection, drill: drillTab })
      );
    } catch {
      /* ignore */
    }
  }, [studySection, drillTab]);

  // Save settings to localStorage
  const updateSettings = (newSettings: Partial<StudySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(STUDY_SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Save stats to localStorage
  const updateStats = (newStats: Partial<StudyStats>) => {
    const updated = { ...stats, ...newStats };
    setStats(updated);
    try {
      localStorage.setItem(STUDY_STATS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Timer for timed mode
  useEffect(() => {
    if (!settings.timedMode || !quizTopic || showResult || loading || quizComplete) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const timeLimit = DIFFICULTY_CONFIG[settings.difficulty].time;
    setTimeLeft(timeLimit);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up
          if (selectedAnswer === null && !showResult) {
            playSound("wrong", settings.soundEnabled);
            setTimeRanOut(true);
            setShowResult(true);
            setStreak(0);
          }
          return null;
        }
        if (prev <= 5) {
          playSound("tick", settings.soundEnabled);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [settings.timedMode, settings.difficulty, quizTopic, currentQuestionIndex, showResult, loading, quizComplete]);

  // Shuffle and rotate loading messages (quiz, flashcards, match, or case study)
  useEffect(() => {
    if (!loading && !matchLoading && !caseStudyLoading) {
      setLoadingMsgIndex(0);
      return;
    }
    setShuffledQuizMsgs(shuffleArray(QUIZ_LOADING_MESSAGES));
    setShuffledFlashcardMsgs(shuffleArray(FLASHCARD_LOADING_MESSAGES));
    setShuffledMatchMsgs(shuffleArray(MATCH_LOADING_MESSAGES));
    setShuffledCaseStudyMsgs(shuffleArray(CASE_STUDY_LOADING_MESSAGES));

    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => i + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, matchLoading, caseStudyLoading]);

  useEffect(() => {
    if (!matchTopic || matchTiles.length === 0 || matchComplete || !settings.matchTimedChallenge) {
      if (matchTickRef.current) {
        clearInterval(matchTickRef.current);
        matchTickRef.current = null;
      }
      return;
    }
    matchTickRef.current = setInterval(() => setMatchElapsed((s) => s + 1), 1000);
    return () => {
      if (matchTickRef.current) {
        clearInterval(matchTickRef.current);
        matchTickRef.current = null;
      }
    };
  }, [matchTopic, matchTiles.length, matchComplete, settings.matchTimedChallenge]);

  const [isFlipped, setIsFlipped] = useState(false);

  const fetchQuiz = useCallback(async (topic: string) => {
    setLoading(true);
    setSessionFocusTopic(topic);
    setQuizTopic(topic);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);
    setQuizMistakes([]);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data.questions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlashcards = useCallback(async (topic: string) => {
    setLoading(true);
    setSessionFocusTopic(topic);
    setFlashcardTopic(topic);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setFlashcardHardQueue([]);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMatchRound = useCallback(
    async (topic: string) => {
      setMatchLoading(true);
      setSessionFocusTopic(topic);
      setMatchTopic(topic);
      setMatchTiles([]);
      setMatchMatched(new Set());
      setMatchSelectedId(null);
      setMatchComplete(false);
      setMatchError(null);
      setMatchElapsed(0);
      setMatchCombo(0);

      const want = settings.matchPairCount;
      try {
        const bestRaw = localStorage.getItem(MATCH_BEST_TIME_KEY);
        const bestMap = bestRaw ? (JSON.parse(bestRaw) as Record<string, number>) : {};
        const key = `${topic}:${want}`;
        setMatchBestSession(typeof bestMap[key] === "number" ? bestMap[key] : null);
      } catch {
        setMatchBestSession(null);
      }

      try {
        const res = await fetch("/api/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, forMatch: true }),
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const cards: Flashcard[] = data.flashcards || [];
        const need = Math.min(want, cards.length);
        if (cards.length < 2 || need < 2) {
          setMatchError("Need at least 2 pairs worth of cards. Try another topic.");
          return;
        }
        setMatchTiles(buildMatchTilesFromCards(cards, want));
      } catch (e) {
        console.error(e);
        setMatchError("Could not load cards. Try again.");
      } finally {
        setMatchLoading(false);
      }
    },
    [settings.matchPairCount]
  );

  const fetchCaseStudy = useCallback(
    async (topic: string, continuation?: { title: string; scenario: string; context: string }) => {
      setCaseStudyLoading(true);
      setCaseStudyError(null);
      setSessionFocusTopic(topic);
      setCaseStudyTopic(topic);
      setCaseStudyPayload(null);
      setCaseStudyQIndex(0);
      setCaseStudySelected(null);
      setCaseStudyShowResult(false);
      setCaseStudyPhase("mcq");
      setCaseStudyScore(0);
      setCaseStudyWrittenText([]);
      setCaseStudyOutlineVisible([]);
      setCaseStudyFeedback([]);
      setCaseMcqMistakes([]);
      setCaseWrittenSelfScore([]);
      setCaseScenarioOpen(true);
      try {
        localStorage.removeItem(CASE_DRAFT_KEY);
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/case-study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            continuation ? { topic, continuationFrom: continuation } : { topic }
          ),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCaseStudyError(typeof data.error === "string" ? data.error : "Could not load case study.");
          return;
        }
        const payload = data as CaseStudyPayload;
        if (!payload?.scenario || !Array.isArray(payload.questions) || payload.questions.length < 3) {
          setCaseStudyError("Invalid response. Try again.");
          return;
        }
        setCaseStudyPayload(payload);
      } catch (e) {
        console.error(e);
        setCaseStudyError("Network error. Try again.");
      } finally {
        setCaseStudyLoading(false);
      }
    },
    []
  );

  const resetCaseStudy = () => {
    setCaseStudyTopic(null);
    setCaseStudyPayload(null);
    setCaseStudyError(null);
    setCaseStudyQIndex(0);
    setCaseStudySelected(null);
    setCaseStudyShowResult(false);
    setCaseStudyPhase("mcq");
    setCaseStudyScore(0);
    setCaseStudyWrittenText([]);
    setCaseStudyOutlineVisible([]);
    setCaseStudyFeedback([]);
    setCaseMcqMistakes([]);
    setCaseWrittenSelfScore([]);
    setCaseScenarioOpen(true);
    try {
      localStorage.removeItem(CASE_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const resumeCaseDraft = useCallback(() => {
    const d = pendingCaseDraft;
    if (!d) return;
    setCaseStudyTopic(d.caseStudyTopic);
    setCaseStudyPayload(d.caseStudyPayload);
    setCaseStudyPhase(d.caseStudyPhase);
    setCaseStudyQIndex(d.caseStudyQIndex);
    setCaseStudyScore(d.caseStudyScore);
    setCaseStudyWrittenText(d.caseStudyWrittenText);
    setCaseStudySelected(d.caseStudySelected);
    setCaseStudyShowResult(d.caseStudyShowResult);
    const ex = d.caseStudyPayload.writtenExercises ?? [];
    setCaseStudyOutlineVisible(ex.map(() => false));
    setCaseStudyFeedback(ex.map(() => ({ loading: false, text: null, error: null })));
    setCaseWrittenSelfScore(
      d.caseWrittenSelfScore && d.caseWrittenSelfScore.length === ex.length
        ? d.caseWrittenSelfScore
        : ex.map(() => null)
    );
    setCaseStudyError(null);
    setPendingCaseDraft(null);
    setSessionFocusTopic(d.caseStudyTopic);
    goToTab("casestudy");
  }, [pendingCaseDraft, goToTab]);

  useEffect(() => {
    if (!caseStudyPayload || !caseStudyTopic || caseStudyPhase === "results") return;
    if (caseDraftSaveTimer.current) clearTimeout(caseDraftSaveTimer.current);
    caseDraftSaveTimer.current = setTimeout(() => {
      const draft: CaseDraftV1 = {
        v: 1,
        savedAt: Date.now(),
        caseStudyTopic,
        caseStudyPhase,
        caseStudyPayload,
        caseStudyQIndex,
        caseStudyScore,
        caseStudyWrittenText,
        caseStudySelected,
        caseStudyShowResult,
        caseWrittenSelfScore,
      };
      try {
        localStorage.setItem(CASE_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (caseDraftSaveTimer.current) clearTimeout(caseDraftSaveTimer.current);
    };
  }, [
    caseStudyPayload,
    caseStudyTopic,
    caseStudyPhase,
    caseStudyQIndex,
    caseStudyScore,
    caseStudyWrittenText,
    caseStudySelected,
    caseStudyShowResult,
    caseWrittenSelfScore,
  ]);

  const handleCaseStudySelect = (index: number) => {
    if (caseStudyShowResult || !caseStudyPayload) return;
    const q = caseStudyPayload.questions[caseStudyQIndex];
    if (!q) return;
    setCaseStudySelected(index);
    setCaseStudyShowResult(true);
    if (index === q.correctIndex) {
      playSound("correct", settings.soundEnabled);
      setCaseStudyScore((s) => s + 1);
    } else {
      playSound("wrong", settings.soundEnabled);
      setCaseMcqMistakes((prev) => [
        ...prev,
        {
          qIndex: caseStudyQIndex,
          selected: index,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      ]);
    }
  };

  const finishCaseStudy = () => {
    if (!caseStudyPayload) return;
    playSound("complete", settings.soundEnabled);
    const topic = caseStudyTopic || "Unknown";
    const n = caseStudyPayload.questions.length;
    const topicStats = { ...stats.topicStats };
    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
    topicStats[topic].correct += caseStudyScore;
    topicStats[topic].total += n;
    updateStats({
      caseStudyCompleted: stats.caseStudyCompleted + 1,
      caseStudyCorrect: stats.caseStudyCorrect + caseStudyScore,
      caseStudyQuestionCount: stats.caseStudyQuestionCount + n,
      topicStats,
    });
    setStudyDays(recordStudyDayInStorage(STUDY_ACTIVITY_KEY));
    try {
      localStorage.removeItem(CASE_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setCaseStudyPhase("results");
  };

  const nextCaseStudyQuestion = () => {
    if (!caseStudyPayload) return;
    if (caseStudyQIndex < caseStudyPayload.questions.length - 1) {
      setCaseStudyQIndex((i) => i + 1);
      setCaseStudySelected(null);
      setCaseStudyShowResult(false);
    } else {
      setCaseStudyShowResult(false);
      setCaseStudySelected(null);
      const exercises = caseStudyPayload.writtenExercises;
      if (exercises && exercises.length > 0) {
        setCaseStudyWrittenText(exercises.map(() => ""));
        setCaseStudyOutlineVisible(exercises.map(() => false));
        setCaseStudyFeedback(
          exercises.map(() => ({ loading: false, text: null, error: null }))
        );
        setCaseWrittenSelfScore(exercises.map(() => null));
        setCaseStudyPhase("written");
      } else {
        finishCaseStudy();
      }
    }
  };

  const fetchCaseStudyWrittenFeedback = async (exerciseIndex: number) => {
    const payload = caseStudyPayload;
    const exercises = payload?.writtenExercises;
    if (!payload || !exercises?.[exerciseIndex]) return;
    const answer = caseStudyWrittenText[exerciseIndex]?.trim();
    if (!answer) return;

    setCaseStudyFeedback((prev) => {
      const next = [...prev];
      next[exerciseIndex] = { loading: true, text: null, error: null };
      return next;
    });

    try {
      const ex = exercises[exerciseIndex];
      const res = await fetch("/api/case-study-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseTitle: payload.title,
          scenario: payload.scenario.slice(0, 8000),
          exerciseRole: ex.role,
          exercisePrompt: ex.prompt,
          userAnswer: answer,
          modelOutline: ex.outline,
          style: settings.caseFeedbackStyle,
          selfRubricScore: caseWrittenSelfScore[exerciseIndex] ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCaseStudyFeedback((prev) => {
          const next = [...prev];
          next[exerciseIndex] = {
            loading: false,
            text: null,
            error: typeof data.error === "string" ? data.error : "Could not get feedback.",
          };
          return next;
        });
        return;
      }
      setCaseStudyFeedback((prev) => {
        const next = [...prev];
        next[exerciseIndex] = {
          loading: false,
          text: typeof data.feedback === "string" ? data.feedback : null,
          error: null,
        };
        return next;
      });
    } catch {
      setCaseStudyFeedback((prev) => {
        const next = [...prev];
        next[exerciseIndex] = {
          loading: false,
          text: null,
          error: "Network error.",
        };
        return next;
      });
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (showResult) return;
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(null);
    
    setSelectedAnswer(index);
    setShowResult(true);
    const qNow = quizQuestions[currentQuestionIndex];
    const isCorrect = index === qNow?.correctIndex;
    if (qNow && !isCorrect) {
      setQuizMistakes((prev) => [
        ...prev,
        {
          qIndex: currentQuestionIndex,
          selected: index,
          question: qNow.question,
          options: qNow.options,
          correctIndex: qNow.correctIndex,
          explanation: qNow.explanation,
        },
      ]);
    }
    if (isCorrect) {
      playSound("correct", settings.soundEnabled);
      setScore((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      // Confetti for streaks of 3+
      if (streak >= 2) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      }
    } else {
      playSound("wrong", settings.soundEnabled);
      setStreak(0);
    }
  };

  // Keyboard shortcuts for quiz
  useEffect(() => {
    const question = quizQuestions[currentQuestionIndex];
    if (activeTab !== "quiz" || !question || showResult || loading) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "1" && key <= "4") {
        const index = parseInt(key) - 1;
        if (index < question.options.length) {
          handleAnswerSelect(index);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, quizQuestions, currentQuestionIndex, showResult, loading]);

  // Space/Enter to continue after answer
  useEffect(() => {
    if (activeTab !== "quiz" || !showResult) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextQuestion();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, showResult]);

  // Keyboard shortcuts for case study
  useEffect(() => {
    const q = caseStudyPayload?.questions[caseStudyQIndex];
    if (
      activeTab !== "casestudy" ||
      !q ||
      caseStudyShowResult ||
      caseStudyLoading ||
      caseStudyPhase !== "mcq"
    )
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "1" && key <= "4") {
        const index = parseInt(key, 10) - 1;
        if (index < q.options.length) handleCaseStudySelect(index);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTab,
    caseStudyPayload,
    caseStudyQIndex,
    caseStudyShowResult,
    caseStudyLoading,
    caseStudyPhase,
  ]);

  useEffect(() => {
    if (activeTab !== "casestudy" || !caseStudyShowResult || caseStudyPhase !== "mcq") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextCaseStudyQuestion();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, caseStudyShowResult, caseStudyPhase]);

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeRanOut(false);
      // Reset timer for next question
      if (settings.timedMode) {
        setTimeLeft(DIFFICULTY_CONFIG[settings.difficulty].time);
      }
    } else {
      // Quiz complete
      playSound("complete", settings.soundEnabled);
      setQuizComplete(true);
      setStudyDays(recordStudyDayInStorage(STUDY_ACTIVITY_KEY));

      if (!settings.quizPracticeMode) {
        const topicStats = { ...stats.topicStats };
        const topic = quizTopic || "Unknown";
        if (!topicStats[topic]) {
          topicStats[topic] = { correct: 0, total: 0 };
        }
        topicStats[topic].correct += score;
        topicStats[topic].total += quizQuestions.length;

        updateStats({
          totalQuizzes: stats.totalQuizzes + 1,
          totalCorrect: stats.totalCorrect + score,
          totalQuestions: stats.totalQuestions + quizQuestions.length,
          bestStreak: Math.max(stats.bestStreak, maxStreak),
          topicStats,
        });
      }
    }
  };

  const resetQuiz = () => {
    setQuizTopic(null);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimeRanOut(false);
    setScore(0);
    setQuizComplete(false);
    setQuizMistakes([]);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const flashcardMarkAgain = () => {
    setFlashcardHardQueue((q) => (q.includes(currentCardIndex) ? q : [...q, currentCardIndex]));
    playSound("tick", settings.soundEnabled);
  };

  const advanceFlashcard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex((i) => i + 1);
      setIsFlipped(false);
      return;
    }
    if (flashcardHardQueue.length > 0) {
      const nextI = flashcardHardQueue[0];
      setFlashcardHardQueue((q) => q.slice(1));
      setCurrentCardIndex(nextI);
      setIsFlipped(false);
      return;
    }
    playSound("complete", settings.soundEnabled);
    updateStats({
      totalFlashcards: stats.totalFlashcards + flashcards.length,
    });
    setStudyDays(recordStudyDayInStorage(STUDY_ACTIVITY_KEY));
  };

  // Keyboard shortcuts for flashcards
  useEffect(() => {
    const card = flashcards[currentCardIndex];
    if (activeTab !== "flashcards" || !card || loading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advanceFlashcard();
      } else if (e.key === "ArrowLeft" && currentCardIndex > 0) {
        setCurrentCardIndex((i) => i - 1);
        setIsFlipped(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, flashcards, currentCardIndex, loading, flashcardHardQueue.length]);

  const parseJournalAmount = (s: string) => {
    const n = parseFloat(String(s).replace(/,/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const journalRowHasDebitAndCredit = (i: number) => {
    const e = journalEntries[i];
    if (!e) return false;
    const d = parseJournalAmount(e.debit);
    const c = parseJournalAmount(e.credit);
    return d > 0 && c > 0;
  };

  const addJournalRow = () => {
    setJournalEntries([...journalEntries, { account: "", debit: "", credit: "" }]);
  };

  const removeJournalRow = (index: number) => {
    if (journalEntries.length > 2) {
      setJournalEntries(journalEntries.filter((_, i) => i !== index));
    }
  };

  const clearJournal = () => {
    try {
      localStorage.removeItem(JOURNAL_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setJournalEntries(createEmptyJournalRows());
    setJournalMemo("");
    setJournalDateStr("");
    setJournalPromptId(null);
    setJournalExampleRevealed(false);
    setJournalShowRules(false);
    setJournalCaseHint(null);
    setJournalCaseRefTitle(null);
    setJournalCopied(false);
  };

  const updateJournalEntry = (index: number, field: "account" | "debit" | "credit", value: string) => {
    const updated = [...journalEntries];
    updated[index][field] = value;
    setJournalEntries(updated);
  };

  const formatJournalAmountBlur = (index: number, field: "debit" | "credit") => {
    setJournalEntries((prev) => {
      const next = [...prev];
      const raw = String(next[index][field]).replace(/,/g, "").trim();
      if (raw === "") {
        next[index] = { ...next[index], [field]: "" };
        return next;
      }
      const n = parseFloat(raw);
      if (Number.isNaN(n)) {
        next[index] = { ...next[index], [field]: "" };
        return next;
      }
      next[index] = { ...next[index], [field]: n.toFixed(2) };
      return next;
    });
  };

  const totalDebits = journalEntries.reduce((sum, e) => sum + parseJournalAmount(e.debit), 0);
  const totalCredits = journalEntries.reduce((sum, e) => sum + parseJournalAmount(e.credit), 0);
  const isBalanced = totalDebits > 0 && totalDebits === totalCredits;
  const journalHasInvalidRows = journalEntries.some((_, i) => journalRowHasDebitAndCredit(i));
  const activeJournalPrompt = getPromptById(journalPromptId);

  const copyJournalToClipboard = useCallback(async () => {
    const td = journalEntries.reduce((sum, e) => sum + parseJournalAmount(e.debit), 0);
    const tc = journalEntries.reduce((sum, e) => sum + parseJournalAmount(e.credit), 0);
    const lines: string[] = [];
    if (journalDateStr.trim()) lines.push(`Date: ${journalDateStr.trim()}`);
    if (journalMemo.trim()) lines.push(`Memo: ${journalMemo.trim()}`);
    if (lines.length) lines.push("");
    lines.push("Account\tDebit\tCredit");
    journalEntries.forEach((e) => {
      lines.push(`${e.account || "-"}\t${e.debit || ""}\t${e.credit || ""}`);
    });
    lines.push("");
    lines.push(`Totals\tDr ${td.toFixed(2)}\tCr ${tc.toFixed(2)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setJournalCopied(true);
      window.setTimeout(() => setJournalCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [journalDateStr, journalMemo, journalEntries]);

  const focusQuickQuizTopic = matchTopicFromFocus(sessionFocusTopic, QUIZ_TOPICS.map((t) => t.name));
  const focusQuickFlashTopic = matchTopicFromFocus(sessionFocusTopic, FLASHCARD_TOPICS.map((t) => t.name));
  const focusQuickMatchTopic = matchTopicFromFocus(sessionFocusTopic, MATCH_TOPICS.map((t) => t.name));

  useEffect(() => {
    const ok = isBalanced && !journalHasInvalidRows && activeTab === "journal";
    if (ok && !journalBalancedRef.current) {
      journalBalancedRef.current = true;
      if (!reduceMotion) setJournalConfetti(true);
      playSound("complete", settings.soundEnabled);
      if (journalConfettiTimerRef.current) window.clearTimeout(journalConfettiTimerRef.current);
      journalConfettiTimerRef.current = window.setTimeout(() => {
        setJournalConfetti(false);
        journalConfettiTimerRef.current = null;
      }, 2000);
    }
    if (!ok) journalBalancedRef.current = false;
    return () => {
      if (journalConfettiTimerRef.current) {
        window.clearTimeout(journalConfettiTimerRef.current);
        journalConfettiTimerRef.current = null;
      }
    };
  }, [
    isBalanced,
    journalHasInvalidRows,
    activeTab,
    reduceMotion,
    settings.soundEnabled,
  ]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const currentCard = flashcards[currentCardIndex];
  const currentCaseStudyQ = caseStudyPayload?.questions[caseStudyQIndex];
  const progressPercent = quizQuestions.length > 0 ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100 : 0;
  const caseStudyProgressPercent =
    caseStudyPayload && caseStudyPayload.questions.length > 0
      ? ((caseStudyQIndex + 1) / caseStudyPayload.questions.length) * 100
      : 0;

  const matchPairCount = matchTiles.length / 2;
  const gradedAnswerTotal = stats.totalQuestions + stats.caseStudyQuestionCount;
  const gradedAnswerCorrect = stats.totalCorrect + stats.caseStudyCorrect;
  const gradedAccuracyPct =
    gradedAnswerTotal > 0 ? Math.round((gradedAnswerCorrect / gradedAnswerTotal) * 100) : null;
  const studyStreak = computeStudyStreak(studyDays);

  const handleMatchTileClick = (tile: MatchTile) => {
    if (matchMatched.has(tile.pairId) || matchComplete) return;

    if (!matchSelectedId) {
      setMatchSelectedId(tile.id);
      return;
    }

    if (matchSelectedId === tile.id) {
      setMatchSelectedId(null);
      return;
    }

    const other = matchTiles.find((t) => t.id === matchSelectedId);
    if (!other) {
      setMatchSelectedId(tile.id);
      return;
    }

    const isPair =
      other.pairId === tile.pairId && other.side !== tile.side;

    if (isPair) {
      playSound("correct", settings.soundEnabled);
      setMatchCombo((c) => c + 1);
      const next = new Set(matchMatched);
      next.add(tile.pairId);
      setMatchMatched(next);
      setMatchSelectedId(null);
      if (matchPairCount > 0 && next.size >= matchPairCount) {
        playSound("complete", settings.soundEnabled);
        setMatchComplete(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
        setStudyDays(recordStudyDayInStorage(STUDY_ACTIVITY_KEY));
        if (settings.matchTimedChallenge && matchTopic) {
          const t = matchElapsed;
          try {
            const raw = localStorage.getItem(MATCH_BEST_TIME_KEY);
            const map: Record<string, number> = raw ? JSON.parse(raw) : {};
            const key = `${matchTopic}:${settings.matchPairCount}`;
            if (typeof map[key] !== "number" || t < map[key]) {
              map[key] = t;
              localStorage.setItem(MATCH_BEST_TIME_KEY, JSON.stringify(map));
            }
            setMatchBestSession(map[key] ?? t);
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      playSound("wrong", settings.soundEnabled);
      setMatchCombo(0);
      setMatchSelectedId(null);
    }
  };

  const resetMatchRound = () => {
    setMatchTopic(null);
    setMatchTiles([]);
    setMatchMatched(new Set());
    setMatchSelectedId(null);
    setMatchComplete(false);
    setMatchError(null);
    setMatchElapsed(0);
    setMatchCombo(0);
  };

  return (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border shadow-xl ring-1 sm:rounded-[1.35rem]",
              theme === "dark"
                ? "border-white/10 bg-background/80 shadow-black/50 ring-white/[0.06] backdrop-blur-2xl"
                : "border-border/55 bg-card/92 shadow-emerald-950/[0.07] ring-black/[0.05] backdrop-blur-2xl"
            )}
          >
            <StudyAmbientLayer theme={theme} reducedMotion={reduceMotion} />
            {/* Header */}
            <div
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-between border-b px-4 py-3.5 sm:px-6 sm:py-4",
                theme === "dark"
                  ? "border-white/5 bg-gradient-to-r from-emerald-950/15 via-transparent to-sky-950/10"
                  : "border-border/45 bg-gradient-to-r from-emerald-50/40 via-transparent to-sky-50/35"
              )}
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm",
                    theme === "dark"
                      ? "bg-gradient-to-br from-emerald-500/25 to-sky-600/15 ring-1 ring-white/10"
                      : "bg-gradient-to-br from-emerald-500/20 to-sky-500/15 ring-1 ring-emerald-800/10"
                  )}
                >
                  <BookOpen
                    className={cn(
                      "h-5 w-5",
                      theme === "dark" ? "text-emerald-200" : "text-emerald-900"
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Study
                  </p>
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    Study Mode
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Master accounting concepts</span>
                    {gradedAccuracyPct !== null ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                          theme === "dark" ? "bg-white/10 text-emerald-100" : "bg-emerald-100/90 text-emerald-900"
                        )}
                        title="Your accuracy on saved quizzes and case study multiple choice. Practice mode does not count."
                      >
                        {gradedAccuracyPct}% correct
                      </span>
                    ) : null}
                    {studyStreak > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/14 px-2 py-0.5 text-[10px] font-semibold text-orange-800 dark:text-orange-200">
                        <Flame className="h-3 w-3" aria-hidden />
                        {studyStreak}d streak
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-0.5 rounded-xl border p-0.5 shadow-sm",
                  theme === "dark" ? "border-white/10 bg-black/20" : "border-border/50 bg-background/70"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowStats(!showStats);
                    setShowSettings(false);
                    setShowShortcuts(false);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    showStats
                      ? theme === "dark"
                        ? "bg-white/10 text-foreground shadow-inner"
                        : "bg-white text-foreground shadow-sm ring-1 ring-border/40"
                      : "text-muted-foreground hover:bg-background/90 hover:text-foreground"
                  )}
                  title="View Stats"
                  aria-pressed={showStats}
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowShortcuts((s) => !s);
                    setShowStats(false);
                    setShowSettings(false);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    showShortcuts
                      ? theme === "dark"
                        ? "bg-white/10 text-foreground shadow-inner"
                        : "bg-white text-foreground shadow-sm ring-1 ring-border/40"
                      : "text-muted-foreground hover:bg-background/90 hover:text-foreground"
                  )}
                  title="Keyboard shortcuts"
                  aria-pressed={showShortcuts}
                >
                  <Keyboard className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowStats(false);
                    setShowShortcuts(false);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    showSettings
                      ? theme === "dark"
                        ? "bg-white/10 text-foreground shadow-inner"
                        : "bg-white text-foreground shadow-sm ring-1 ring-border/40"
                      : "text-muted-foreground hover:bg-background/90 hover:text-foreground"
                  )}
                  title="Settings"
                  aria-pressed={showSettings}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showShortcuts ? (
                <motion.div
                  key="shortcuts"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "relative z-10 shrink-0 overflow-hidden border-b",
                    theme === "dark" ? "border-white/10 bg-black/25" : "border-border/40 bg-muted/40"
                  )}
                >
                  <div className="px-4 py-3 sm:px-6 sm:py-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                      Power shortcuts
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-black/20">
                        <p className="mb-2 text-xs font-semibold text-foreground">Quiz</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li>
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">1</kbd>-
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">4</kbd> pick
                            an answer
                          </li>
                          <li>
                            After reveal:{" "}
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>{" "}
                            or{" "}
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
                            next question
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-black/20">
                        <p className="mb-2 text-xs font-semibold text-foreground">Flashcards</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li>
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>{" "}
                            flip card
                          </li>
                          <li>
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">←</kbd>{" "}
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">→</kbd>{" "}
                            previous / next
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-black/20">
                        <p className="mb-2 text-xs font-semibold text-foreground">Case study (multiple choice)</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li>
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">1</kbd>-
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">4</kbd> select
                            choice
                          </li>
                          <li>
                            After feedback:{" "}
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>{" "}
                            continue
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-black/20">
                        <p className="mb-2 text-xs font-semibold text-foreground">Match</p>
                        <p className="text-xs text-muted-foreground">
                          Click a term, then its definition. Streaks and timers (if on) track in the header.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Settings/Stats Panel - Only one shows at a time */}
            <AnimatePresence mode="wait">
              {showSettings && (
                <motion.div
                  key="settings"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 shrink-0 overflow-x-hidden border-b border-border/40 bg-muted/20 dark:bg-black/20"
                >
                  <div className="px-4 py-3 sm:px-6 sm:py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Preferences
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex min-w-0 items-center gap-3">
                          {settings.soundEnabled ? <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" /> : <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="text-sm">Sound Effects</span>
                        </div>
                        <button
                          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                          className={cn(
                            "relative h-6 w-10 rounded-full transition-colors",
                            settings.soundEnabled ? "bg-emerald-500" : "bg-muted"
                          )}
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.soundEnabled ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">Timed Mode</span>
                        </div>
                        <button
                          onClick={() => updateSettings({ timedMode: !settings.timedMode })}
                          className={cn(
                            "relative h-6 w-10 rounded-full transition-colors",
                            settings.timedMode ? "bg-emerald-500" : "bg-muted"
                          )}
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.timedMode ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">Quiz practice mode</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateSettings({ quizPracticeMode: !settings.quizPracticeMode })}
                          className={cn(
                            "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                            settings.quizPracticeMode ? "bg-emerald-500" : "bg-muted"
                          )}
                          aria-pressed={settings.quizPracticeMode}
                          aria-label="Quiz practice mode: scores are not saved"
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.quizPracticeMode ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">Match pairs per round</span>
                        </div>
                        <div
                          role="group"
                          aria-label="Match pairs per round"
                          className={cn(
                            "grid w-full shrink-0 grid-cols-3 gap-1 rounded-lg p-0.5 sm:flex sm:w-auto",
                            "bg-muted"
                          )}
                        >
                          {([4, 6, 8] as MatchPairCount[]).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => updateSettings({ matchPairCount: n })}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:py-1",
                                settings.matchPairCount === n
                                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">Match timer (best time saved)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateSettings({ matchTimedChallenge: !settings.matchTimedChallenge })}
                          className={cn(
                            "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                            settings.matchTimedChallenge ? "bg-emerald-500" : "bg-muted"
                          )}
                          aria-pressed={settings.matchTimedChallenge}
                          aria-label="Match timed challenge"
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.matchTimedChallenge ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">Case written feedback</span>
                        </div>
                        <div
                          role="group"
                          aria-label="Case study written feedback style"
                          className={cn(
                            "grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg p-0.5 sm:flex sm:w-auto",
                            "bg-muted"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => updateSettings({ caseFeedbackStyle: "coaching" })}
                            className={cn(
                              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:py-1",
                              settings.caseFeedbackStyle === "coaching"
                                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Coaching
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSettings({ caseFeedbackStyle: "exam" })}
                            className={cn(
                              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:py-1",
                              settings.caseFeedbackStyle === "exam"
                                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Exam-style
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 py-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Zap className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">Quiz difficulty</span>
                        </div>
                        <div
                          role="group"
                          aria-label="Quiz difficulty"
                          className={cn(
                            "grid w-full shrink-0 grid-cols-3 gap-1 rounded-lg p-0.5 sm:flex sm:w-auto",
                            "bg-muted"
                          )}
                        >
                          {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => updateSettings({ difficulty: diff })}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:py-1",
                                settings.difficulty === diff
                                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {DIFFICULTY_CONFIG[diff].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      Difficulty sets quiz timer length when Timed Mode is on.
                      {settings.timedMode && (
                        <>
                          {" "}
                          Now: {DIFFICULTY_CONFIG[settings.difficulty].time}s/question (
                          {DIFFICULTY_CONFIG[settings.difficulty].label}).
                        </>
                      )}
                      {settings.quizPracticeMode && (
                        <>
                          {" "}
                          Practice mode: quiz results are not added to your saved stats.
                        </>
                      )}
                    </p>
                  </div>
                </motion.div>
              )}

              {showStats && (
                <motion.div
                  key="stats"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 shrink-0 overflow-hidden border-b border-border/40 bg-muted/15 dark:bg-black/15"
                >
                  <div className="px-4 py-3 sm:px-6 sm:py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Your progress
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">{stats.totalQuizzes}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Quizzes</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">
                          {stats.totalQuestions > 0
                            ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
                            : 0}
                          %
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">Accuracy</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">{stats.bestStreak}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Best streak</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">{stats.totalFlashcards}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Cards</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">{stats.caseStudyCompleted}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">Cases done</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-center shadow-sm",
                          theme === "dark"
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-border/50 bg-card/90"
                        )}
                      >
                        <p className="text-xl font-bold tabular-nums">
                          {stats.caseStudyQuestionCount > 0
                            ? Math.round((stats.caseStudyCorrect / stats.caseStudyQuestionCount) * 100)
                            : 0}
                          %
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">Case accuracy</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {sessionFocusTopic ? (
              <div
                className={cn(
                  "relative z-10 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-6",
                  theme === "dark"
                    ? "border-emerald-500/15 bg-gradient-to-r from-emerald-950/45 via-emerald-950/20 to-transparent"
                    : "border-emerald-200/55 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-transparent"
                )}
              >
                <p className="flex min-w-0 items-start gap-2 text-xs leading-snug">
                  <Target
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                    )}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Focus</span>
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="text-foreground">{sessionFocusTopic}</span>
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setSessionFocusTopic(null)}
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    theme === "dark"
                      ? "text-emerald-200 hover:bg-white/10"
                      : "text-emerald-800 hover:bg-emerald-100/80"
                  )}
                >
                  Clear
                </button>
              </div>
            ) : null}

            <nav
              aria-label="Study area"
              className={cn(
                "relative z-10 shrink-0 border-b px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3",
                theme === "dark" ? "border-white/5 bg-black/15" : "border-border/40 bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "flex gap-1 rounded-2xl p-1 sm:gap-1.5 sm:p-1.5",
                  theme === "dark" ? "bg-black/25 ring-1 ring-white/5" : "bg-background/80 shadow-inner ring-1 ring-black/[0.04]"
                )}
              >
                <button
                  type="button"
                  aria-pressed={studySection === "practice"}
                  onClick={() => setStudySection("practice")}
                  title="Quiz, flashcards, and match"
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 sm:gap-2 sm:py-2.5 sm:text-sm",
                    studySection === "practice"
                      ? theme === "dark"
                        ? "bg-gradient-to-b from-emerald-500/25 to-emerald-600/10 text-emerald-50 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-400/25"
                        : "bg-white text-emerald-900 shadow-md shadow-emerald-900/10 ring-1 ring-emerald-300/45"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                >
                  <Zap className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="truncate">Practice</span>
                </button>
                <button
                  type="button"
                  aria-pressed={studySection === "case"}
                  onClick={() => setStudySection("case")}
                  title="Scenario-based case studies"
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 sm:gap-2 sm:py-2.5 sm:text-sm",
                    studySection === "case"
                      ? theme === "dark"
                        ? "bg-gradient-to-b from-amber-500/20 to-amber-700/10 text-amber-50 shadow-md shadow-amber-950/20 ring-1 ring-amber-400/25"
                        : "bg-white text-amber-900 shadow-md shadow-amber-900/8 ring-1 ring-amber-300/50"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="truncate">Case</span>
                </button>
                <button
                  type="button"
                  aria-pressed={studySection === "journal"}
                  onClick={() => setStudySection("journal")}
                  title="Practice journal entries"
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 sm:gap-2 sm:py-2.5 sm:text-sm",
                    studySection === "journal"
                      ? theme === "dark"
                        ? "bg-gradient-to-b from-sky-500/20 to-sky-700/10 text-sky-50 shadow-md shadow-sky-950/25 ring-1 ring-sky-400/25"
                        : "bg-white text-sky-900 shadow-md shadow-sky-900/8 ring-1 ring-sky-300/50"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="truncate">Journal</span>
                </button>
              </div>

              {studySection === "practice" ? (
                <div
                  role="tablist"
                  aria-label="Practice activities"
                  className={cn(
                    "mt-2 flex gap-1 rounded-xl p-0.5 sm:mt-2.5 sm:gap-1 sm:p-1",
                    theme === "dark" ? "bg-black/20 ring-1 ring-white/5" : "bg-background/70 ring-1 ring-black/[0.04]"
                  )}
                >
                  {(
                    [
                      { id: "quiz" as const, label: "Quiz", short: "Quiz", icon: Brain },
                      { id: "flashcards" as const, label: "Flashcards", short: "Cards", icon: Lightbulb },
                      { id: "match" as const, label: "Match", short: "Match", icon: Link2 },
                    ] as const
                  ).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      role="tab"
                      id={`study-drill-${row.id}`}
                      aria-selected={drillTab === row.id}
                      onClick={() => setDrillTab(row.id)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:gap-1.5 sm:px-2 sm:py-2 sm:text-sm",
                        drillTab === row.id
                          ? theme === "dark"
                            ? "bg-emerald-500/18 text-emerald-50 shadow-sm ring-1 ring-emerald-400/20"
                            : "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/70"
                          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      )}
                    >
                      <row.icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
                      <span className="truncate sm:hidden">{row.short}</span>
                      <span className="hidden truncate sm:inline">{row.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </nav>

            {/* Content: min-h-0 so this region scrolls instead of clipping header/settings */}
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-7">
              <AnimatePresence mode="wait">
                {/* Quiz Tab */}
                {activeTab === "quiz" && (
                  <motion.div
                    key="quiz"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!quizTopic ? (
                      <div>
                        <p className="mb-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">Pick a topic</span> (ten questions per run).
                          Open settings for timed mode or practice (no stat save).
                        </p>
                        {focusQuickQuizTopic ? (
                          <div
                            className={cn(
                              "mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                              theme === "dark" ? "border-primary/25 bg-primary/5" : "border-primary/20 bg-primary/5"
                            )}
                          >
                            <div className="flex gap-2 text-sm">
                              <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                              <div>
                                <p className="font-medium text-foreground">Quick start from your focus</p>
                                <p className="text-xs text-muted-foreground">
                                  Jump into a quiz for{" "}
                                  <span className="font-medium text-foreground">{focusQuickQuizTopic}</span>
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="shrink-0 rounded-lg"
                              onClick={() => fetchQuiz(focusQuickQuizTopic)}
                            >
                              Start this quiz
                            </Button>
                          </div>
                        ) : null}
                        <motion.div
                          className="grid gap-3 sm:grid-cols-2"
                          variants={topicStagger.container}
                          initial="hidden"
                          animate="show"
                        >
                          {QUIZ_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              variants={topicStagger.item}
                              onClick={() => fetchQuiz(topic.name)}
                              className={cn(
                                "group flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                                theme === "dark"
                                  ? "border-white/10 bg-card/60 hover:border-emerald-500/35 hover:bg-card hover:shadow-lg hover:shadow-black/30"
                                  : "border-border/60 bg-card/80 hover:border-emerald-600/30 hover:bg-white hover:shadow-md hover:shadow-emerald-950/10"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <span className="text-2xl transition-transform duration-200 group-hover:scale-105">
                                {topic.icon}
                              </span>
                              <span className="flex-1 text-sm font-medium">{topic.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </motion.div>
                      </div>
                    ) : loading ? (
                      <div
                        className="flex flex-col items-center justify-center py-16"
                        aria-live="polite"
                        aria-busy="true"
                        aria-label="Loading quiz"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-5xl"
                          aria-hidden
                        >
                          {shuffledQuizMsgs[loadingMsgIndex % shuffledQuizMsgs.length].emoji}
                        </motion.div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={loadingMsgIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 text-muted-foreground"
                          >
                            {shuffledQuizMsgs[loadingMsgIndex % shuffledQuizMsgs.length].text}
                          </motion.p>
                        </AnimatePresence>
                        <p className="mt-2 text-xs text-muted-foreground/60">{quizTopic}</p>
                        <div className="mt-4 flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-muted-foreground/40"
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : quizComplete ? (
                      <>
                        <Confetti active={score >= quizQuestions.length * 0.7} reducedMotion={reduceMotion} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center py-8 text-center"
                        >
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                            className={cn(
                              "mb-6 flex h-24 w-24 items-center justify-center rounded-full",
                              score === quizQuestions.length
                                ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5"
                                : score >= quizQuestions.length / 2
                                ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                                : "bg-muted"
                            )}
                          >
                            {score === quizQuestions.length ? (
                              <Trophy className="h-12 w-12 text-emerald-500" />
                            ) : score >= quizQuestions.length * 0.7 ? (
                              <Award className="h-12 w-12 text-amber-500" />
                            ) : (
                              <Target className="h-12 w-12 text-muted-foreground" />
                            )}
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <p className="text-6xl font-bold tracking-tight">
                              {score}<span className="text-3xl text-muted-foreground">/{quizQuestions.length}</span>
                            </p>
                            <p className="mt-2 text-sm font-medium text-muted-foreground">
                              {Math.round((score / quizQuestions.length) * 100)}% correct
                            </p>
                            <p className="mt-4 text-lg">
                              {score === quizQuestions.length
                                ? "🎉 Perfect score! You're a legend!"
                                : score >= quizQuestions.length * 0.8
                                ? "🔥 Excellent work! Almost perfect!"
                                : score >= quizQuestions.length / 2
                                ? "💪 Good job! Keep practicing."
                                : "📚 Time to hit the books!"}
                            </p>
                            {settings.quizPracticeMode ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Practice mode: this quiz was not added to saved stats.
                              </p>
                            ) : null}
                          </motion.div>
                          {quizMistakes.length > 0 ? (
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.25 }}
                              className="mt-6 w-full max-w-lg text-left"
                            >
                              <p className="mb-2 text-sm font-semibold">Review mistakes</p>
                              <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border/60 p-3">
                                {quizMistakes.map((m, idx) => {
                                  const wrongLabel = m.options[m.selected]?.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "") ?? "";
                                  const rightLabel =
                                    m.options[m.correctIndex]?.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "") ?? "";
                                  return (
                                    <div key={idx} className="border-b border-border/40 pb-3 text-sm last:border-0 last:pb-0">
                                      <p className="font-medium text-foreground">{m.question}</p>
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">You chose: {wrongLabel}</p>
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400">Correct: {rightLabel}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{m.explanation}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          ) : null}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-8 flex w-full max-w-md flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="lg"
                              className="gap-2 rounded-xl px-6"
                              disabled={!quizTopic}
                              onClick={() => quizTopic && fetchQuiz(quizTopic)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Same topic again
                            </Button>
                            <Button type="button" onClick={resetQuiz} size="lg" className="gap-2 rounded-xl px-6">
                              <ChevronLeft className="h-4 w-4" />
                              Other topics
                            </Button>
                          </motion.div>
                        </motion.div>
                      </>
                    ) : currentQuestion ? (
                      <div className="relative">
                        <div className="relative z-10">
                        {/* Confetti for streaks */}
                        <Confetti active={showConfetti} reducedMotion={reduceMotion} />
                        
                        {/* Progress bar */}
                        <div className="mb-6">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <button
                              onClick={resetQuiz}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Exit
                            </button>
                            
                            {/* Timer */}
                            {settings.timedMode && timeLeft !== null && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-bold",
                                  timeLeft <= 5
                                    ? "bg-red-500/10 text-red-500 animate-pulse"
                                    : timeLeft <= 10
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-muted"
                                )}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                {timeLeft}s
                              </motion.div>
                            )}
                            
                            {!settings.timedMode && (
                              <span className="text-muted-foreground">
                                <span className="font-medium text-foreground">{currentQuestionIndex + 1}</span> of {quizQuestions.length}
                              </span>
                            )}
                            
                            <div className="flex items-center gap-3">
                              {/* Streak indicator */}
                              {streak >= 2 && (
                                <motion.div
                                  key={streak}
                                  initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                  className="flex items-center gap-1 rounded-full bg-orange-500/12 px-2 py-0.5 text-orange-600 shadow-sm dark:text-orange-400"
                                >
                                  <Flame className="h-3.5 w-3.5" />
                                  <span className="text-xs font-bold tabular-nums">{streak}</span>
                                </motion.div>
                              )}
                              <motion.span
                                key={score}
                                initial={reduceMotion ? false : { scale: 1.35, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 480, damping: 24 }}
                                className="font-semibold tabular-nums text-foreground"
                              >
                                {score} pts
                              </motion.span>
                              {settings.quizPracticeMode ? (
                                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                                  Practice
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "relative h-2 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10",
                              theme === "dark" ? "bg-card" : "bg-muted"
                            )}
                          >
                            <motion.div
                              className={cn(
                                "relative h-full overflow-hidden rounded-full",
                                streak >= 3
                                  ? "bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"
                                  : "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            >
                              {!reduceMotion ? (
                                <motion.span
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                                  animate={{ x: ["-80%", "180%"] }}
                                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                                  aria-hidden
                                />
                              ) : null}
                            </motion.div>
                          </div>
                        </div>

                        <p className="mb-6 text-lg font-medium leading-relaxed" id="quiz-question-text">
                          {currentQuestion.question}
                        </p>

                        <div className="space-y-3">
                          {currentQuestion.options.map((option, i) => {
                            const isCorrect = i === currentQuestion.correctIndex;
                            const isSelected = selectedAnswer === i;
                            const letter = String.fromCharCode(65 + i);
                            // Strip any leading letter prefix like "A) ", "A. ", "A - ", etc.
                            const cleanOption = option.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "");

                            return (
                              <motion.button
                                key={i}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Answer ${letter}: ${cleanOption}`}
                                onClick={() => handleAnswerSelect(i)}
                                disabled={showResult}
                                className={cn(
                                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                                  showResult
                                    ? isCorrect
                                      ? "border-emerald-500 bg-emerald-500/10"
                                      : isSelected
                                      ? "border-red-500 bg-red-500/10"
                                      : "border-border/50 opacity-40"
                                    : cn(
                                        "border-border hover:border-foreground/20",
                                        theme === "dark" ? "bg-card/50 hover:bg-card" : "hover:bg-muted/80"
                                      )
                                )}
                                whileHover={!showResult ? { scale: 1.01 } : {}}
                                whileTap={!showResult ? { scale: 0.99 } : {}}
                              >
                                <span className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-all",
                                  showResult
                                    ? isCorrect
                                      ? "bg-emerald-500 text-white"
                                      : isSelected
                                      ? "bg-red-500 text-white"
                                      : "bg-muted"
                                    : "bg-muted"
                                )}>
                                  {showResult && isCorrect ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : showResult && isSelected ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : (
                                    letter
                                  )}
                                </span>
                                <span className="flex-1">{cleanOption}</span>
                              </motion.button>
                            );
                          })}
                        </div>

                        <AnimatePresence>
                          {showResult && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="mt-6"
                            >
                              <div
                                className={cn(
                                  "rounded-xl p-4",
                                  timeRanOut
                                    ? "bg-amber-500/5 border border-amber-500/20"
                                    : selectedAnswer === currentQuestion.correctIndex
                                      ? "bg-emerald-500/5 border border-emerald-500/20"
                                      : "bg-red-500/5 border border-red-500/20"
                                )}
                              >
                                <p className={cn(
                                  "mb-1 text-sm font-semibold",
                                  timeRanOut
                                    ? "text-amber-600"
                                    : selectedAnswer === currentQuestion.correctIndex 
                                      ? "text-emerald-600" 
                                      : "text-red-500"
                                )}>
                                  {timeRanOut 
                                    ? "⏱️ Time's up!" 
                                    : selectedAnswer === currentQuestion.correctIndex 
                                      ? "🎉 Correct!" 
                                      : "❌ Incorrect"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {timeRanOut && (
                                    <span className="block mb-1">
                                      The correct answer was: <strong>{currentQuestion.options[currentQuestion.correctIndex]?.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "")}</strong>
                                    </span>
                                  )}
                                  {currentQuestion.explanation}
                                </p>
                              </div>
                              <div className="mt-4 flex items-center gap-2">
                                <Button onClick={nextQuestion} className="flex-1 gap-2 rounded-xl">
                                  {currentQuestionIndex < quizQuestions.length - 1 ? (
                                    <>Continue <ArrowRight className="h-4 w-4" /></>
                                  ) : (
                                    <>See Results <Trophy className="h-4 w-4" /></>
                                  )}
                                </Button>
                                <span className="hidden text-xs text-muted-foreground/50 sm:block">
                                  Press Space
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {/* Case study tab */}
                {activeTab === "casestudy" && (
                  <motion.div
                    key="casestudy"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!caseStudyTopic ? (
                      <div>
                        <p className="mb-5 text-muted-foreground">
                          Real-world scenarios: multiple-choice questions, short written tasks with optional feedback on your
                          work, and discussion prompts.
                        </p>
                        {pendingCaseDraft ? (
                          <div
                            className={cn(
                              "mb-5 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                              theme === "dark" ? "border-amber-500/30 bg-amber-950/20" : "border-amber-500/40 bg-amber-50/80"
                            )}
                          >
                            <div>
                              <p className="text-sm font-medium">Resume saved case?</p>
                              <p className="text-xs text-muted-foreground">
                                {pendingCaseDraft.caseStudyPayload.title} ·{" "}
                                {pendingCaseDraft.caseStudyPhase === "written"
                                  ? "written practice"
                                  : pendingCaseDraft.caseStudyPhase === "results"
                                    ? "results"
                                    : "multiple choice"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" className="rounded-lg" onClick={resumeCaseDraft}>
                                Resume
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => {
                                  setPendingCaseDraft(null);
                                  try {
                                    localStorage.removeItem(CASE_DRAFT_KEY);
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        <motion.div
                          className="grid gap-3 sm:grid-cols-2"
                          variants={topicStagger.container}
                          initial="hidden"
                          animate="show"
                        >
                          {CASE_STUDY_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              variants={topicStagger.item}
                              onClick={() => fetchCaseStudy(topic.name)}
                              className={cn(
                                "group flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                                theme === "dark"
                                  ? "border-white/10 bg-card/60 hover:border-amber-500/35 hover:bg-card hover:shadow-lg hover:shadow-black/30"
                                  : "border-border/60 bg-card/80 hover:border-amber-600/30 hover:bg-white hover:shadow-md hover:shadow-amber-950/10"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <span className="text-2xl transition-transform duration-200 group-hover:scale-105">
                                {topic.icon}
                              </span>
                              <span className="flex-1 text-sm font-medium">{topic.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </motion.div>
                      </div>
                    ) : caseStudyLoading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-5xl"
                        >
                          {shuffledCaseStudyMsgs[loadingMsgIndex % shuffledCaseStudyMsgs.length].emoji}
                        </motion.div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={loadingMsgIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 text-muted-foreground"
                          >
                            {shuffledCaseStudyMsgs[loadingMsgIndex % shuffledCaseStudyMsgs.length].text}
                          </motion.p>
                        </AnimatePresence>
                        <p className="mt-2 text-xs text-muted-foreground/60">{caseStudyTopic}</p>
                        <div className="mt-4 flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-muted-foreground/40"
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : caseStudyError && !caseStudyPayload ? (
                      <div className="flex flex-col items-center py-12 text-center">
                        <p className="text-muted-foreground">{caseStudyError}</p>
                        <Button className="mt-6 rounded-xl" onClick={resetCaseStudy}>
                          Back to topics
                        </Button>
                      </div>
                    ) : caseStudyPayload &&
                      caseStudyPhase === "written" &&
                      (caseStudyPayload.writtenExercises?.length ?? 0) > 0 ? (
                      <motion.div
                        key="case-written"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col pb-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={resetCaseStudy}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Exit
                          </button>
                          <span className="text-xs font-medium text-muted-foreground">
                            Written practice · {caseStudyPayload.title}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mb-4 rounded-xl border p-3 sm:p-4",
                            theme === "dark" ? "border-border/60 bg-card/30" : "border-border/50 bg-muted/30"
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">How written practice works</p>
                          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                            <li>
                              <span className="font-medium text-foreground">Write</span> your answer in each box below.
                              Use full sentences, like email or memo style.
                            </li>
                            <li>
                              <span className="font-medium text-foreground">Self-check</span> by opening{" "}
                              <span className="text-foreground">Show sample outline</span>. Those bullets are themes a
                              strong response might hit; they are not the only acceptable wording.
                            </li>
                            <li>
                              <span className="font-medium text-foreground">Optional written feedback</span> comments on
                              what you wrote. It does not change your multiple-choice score or saved stats. If you use it,
                              the 1-5
                              buttons tell the reader how close you think you got to the outline.
                            </li>
                          </ol>
                        </div>
                        <div
                          className={cn(
                            "mb-6 max-h-[28vh] overflow-y-auto rounded-xl border p-3 text-xs leading-relaxed",
                            theme === "dark" ? "border-border bg-card/40" : "border-border/60 bg-muted/25"
                          )}
                        >
                          <p className="mb-1 font-medium text-foreground">Case recap</p>
                          <p className="text-muted-foreground">{caseStudyPayload.context}</p>
                          <div className="mt-2 space-y-2 text-muted-foreground">
                            {caseStudyPayload.scenario.split(/\n\n+/).slice(0, 4).map((para, i) => (
                              <p key={i}>{para.trim()}</p>
                            ))}
                            {caseStudyPayload.scenario.split(/\n\n+/).length > 4 ? (
                              <p className="italic opacity-80">… scroll the full case in your notes if needed.</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-8">
                          {(caseStudyPayload.writtenExercises ?? []).map((ex, i) => {
                            const fb = caseStudyFeedback[i];
                            const showOutline = caseStudyOutlineVisible[i];
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "rounded-xl border p-4",
                                  theme === "dark" ? "border-border bg-card/30" : "border-border/60 bg-background/60"
                                )}
                              >
                                <div className="mb-2 flex items-start gap-2">
                                  <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      {ex.role}
                                    </p>
                                    <p className="mt-1 text-sm font-medium leading-snug">{ex.prompt}</p>
                                  </div>
                                </div>
                                <textarea
                                  value={caseStudyWrittenText[i] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCaseStudyWrittenText((prev) => {
                                      const next = [...prev];
                                      next[i] = v;
                                      return next;
                                    });
                                  }}
                                  placeholder="Type your response…"
                                  rows={6}
                                  aria-label={`Written response for exercise ${i + 1}: ${ex.role}`}
                                  className={cn(
                                    "mt-3 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    theme === "dark"
                                      ? "border-border bg-card/50"
                                      : "border-input bg-background"
                                  )}
                                />

                                <div className="mt-4 border-t border-border/50 pt-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Self-check with sample outline
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Compare your draft to these idea bullets on your own before (or instead of) asking
                                    for feedback on your writing.
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 rounded-lg"
                                    onClick={() =>
                                      setCaseStudyOutlineVisible((prev) => {
                                        const next = [...prev];
                                        next[i] = !next[i];
                                        return next;
                                      })
                                    }
                                  >
                                    {showOutline ? "Hide sample outline" : "Show sample outline"}
                                  </Button>
                                  {showOutline ? (
                                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                                      {ex.outline.map((pt, j) => (
                                        <li key={j}>{pt}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>

                                <div className="mt-4 border-t border-border/50 pt-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Optional: your own rating
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    After you have read the outline (or tried without it), how well does your draft cover
                                    those themes? We only share this rating if you tap{" "}
                                    <span className="font-medium text-foreground">Get feedback</span>. It helps the
                                    reader calibrate (for example if you felt confident but missed a big point).
                                  </p>
                                  <div
                                    className="mt-2 flex flex-wrap items-center gap-1"
                                    role="group"
                                    aria-label="Self-rating: how well your draft covers the sample outline themes"
                                  >
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <button
                                        key={n}
                                        type="button"
                                        onClick={() =>
                                          setCaseWrittenSelfScore((prev) => {
                                            const next = [...prev];
                                            next[i] = n;
                                            return next;
                                          })
                                        }
                                        className={cn(
                                          "h-8 min-w-[2rem] rounded-md border text-xs font-medium transition-colors",
                                          caseWrittenSelfScore[i] === n
                                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                                        )}
                                        aria-pressed={caseWrittenSelfScore[i] === n}
                                        title={
                                          n === 1
                                            ? "1: missed most themes"
                                            : n === 5
                                            ? "5: hit the themes well"
                                            : `${n} of 5`
                                        }
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                                    <span>Missed most</span>
                                    <span>Covered well</span>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-lg"
                                    disabled={!(caseStudyWrittenText[i] ?? "").trim() || fb?.loading}
                                    onClick={() => fetchCaseStudyWrittenFeedback(i)}
                                  >
                                    {fb?.loading ? (
                                      <>
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        Feedback…
                                      </>
                                    ) : (
                                      "Get feedback"
                                    )}
                                  </Button>
                                </div>
                                {fb?.error ? (
                                  <p className="mt-2 text-sm text-red-500">{fb.error}</p>
                                ) : null}
                                {fb?.text ? (
                                  <div
                                    className={cn(
                                      "mt-3 rounded-lg border p-3 text-sm leading-relaxed",
                                      theme === "dark" ? "border-border bg-muted/20" : "border-border/60 bg-muted/40"
                                    )}
                                  >
                                    <p className="mb-1 text-xs font-semibold text-foreground">Feedback</p>
                                    <p className="whitespace-pre-wrap text-muted-foreground">{fb.text}</p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <Button onClick={finishCaseStudy} size="lg" className="mt-8 w-full gap-2 rounded-xl sm:w-auto sm:self-center">
                          Continue to results
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ) : caseStudyPhase === "results" && caseStudyPayload ? (
                      <>
                        <Confetti
                          active={caseStudyScore >= Math.ceil(caseStudyPayload.questions.length * 0.7)}
                          reducedMotion={reduceMotion}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col py-6"
                        >
                          <div className="mb-6 text-center">
                            <p className="text-sm font-medium text-muted-foreground">{caseStudyPayload.title}</p>
                            <p className="mt-2 text-4xl font-bold tracking-tight">
                              {caseStudyScore}
                              <span className="text-2xl text-muted-foreground">
                                /{caseStudyPayload.questions.length}
                              </span>
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {Math.round((caseStudyScore / caseStudyPayload.questions.length) * 100)}% correct on
                              multiple choice
                            </p>
                            {caseStudyPayload.writtenExercises && caseStudyPayload.writtenExercises.length > 0 ? (
                              <p className="mt-1 text-xs text-muted-foreground/80">
                                Written exercises are practice only and are not included in this score.
                              </p>
                            ) : null}
                          </div>
                          <div
                            className={cn(
                              "rounded-xl border p-4 text-left text-sm leading-relaxed",
                              theme === "dark" ? "border-border bg-card/80" : "border-border/60 bg-muted/40"
                            )}
                          >
                            <p className="mb-2 font-semibold text-foreground">In practice</p>
                            <p className="text-muted-foreground">{caseStudyPayload.practiceNotes}</p>
                          </div>
                          {caseStudyPayload.discussionQuestions &&
                            caseStudyPayload.discussionQuestions.length > 0 && (
                              <div
                                className={cn(
                                  "mt-4 rounded-xl border p-4 text-left text-sm leading-relaxed",
                                  theme === "dark" ? "border-border bg-card/50" : "border-border/60 bg-background/80"
                                )}
                              >
                                <p className="mb-1 font-semibold text-foreground">Discuss</p>
                                <p className="mb-3 text-xs text-muted-foreground">
                                  Open-ended. Work through solo, with a study group, or in class.
                                </p>
                                <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
                                  {caseStudyPayload.discussionQuestions.map((q, i) => (
                                    <li key={i}>{q}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          {caseMcqMistakes.length > 0 ? (
                            <div className="mt-4 w-full text-left">
                              <p className="mb-2 text-sm font-semibold">Multiple-choice review</p>
                              <div className="max-h-52 space-y-3 overflow-y-auto rounded-xl border border-border/60 p-3 text-sm">
                                {caseMcqMistakes.map((m, idx) => {
                                  const wrongLabel =
                                    m.options[m.selected]?.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "") ?? "";
                                  const rightLabel =
                                    m.options[m.correctIndex]?.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "") ?? "";
                                  return (
                                    <div
                                      key={idx}
                                      className="border-b border-border/40 pb-3 last:border-0 last:pb-0"
                                    >
                                      <p className="font-medium text-foreground">{m.question}</p>
                                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                        You chose: {wrongLabel}
                                      </p>
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Correct: {rightLabel}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">{m.explanation}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                            {caseStudyTopic ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="gap-2 rounded-xl"
                                onClick={() => {
                                  if (!caseStudyPayload || !caseStudyTopic) return;
                                  fetchCaseStudy(caseStudyTopic, {
                                    title: caseStudyPayload.title,
                                    scenario: caseStudyPayload.scenario,
                                    context: caseStudyPayload.context,
                                  });
                                }}
                              >
                                Next chapter (same company)
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {caseStudyPayload.journalPractice ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="gap-2 rounded-xl"
                                onClick={() => {
                                  setJournalCaseHint(caseStudyPayload.journalPractice ?? null);
                                  setJournalCaseRefTitle(caseStudyPayload.title);
                                  setJournalMemo((m) => {
                                    const t = `Case: ${caseStudyPayload.title}`;
                                    return m.trim() ? m : t;
                                  });
                                  if (caseStudyTopic) setSessionFocusTopic(caseStudyTopic);
                                  goToTab("journal");
                                }}
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                Practice in Journal
                              </Button>
                            ) : null}
                          </div>
                          <Button onClick={resetCaseStudy} size="lg" className="mt-8 gap-2 self-center rounded-xl px-6">
                            <RotateCcw className="h-4 w-4" />
                            Another case
                          </Button>
                        </motion.div>
                      </>
                    ) : caseStudyPhase === "mcq" && currentCaseStudyQ && caseStudyPayload ? (
                      <div>
                        <div className="mb-6">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <button
                              onClick={resetCaseStudy}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Exit
                            </button>
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{caseStudyQIndex + 1}</span>
                              {" of "}
                              {caseStudyPayload.questions.length}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "h-2 overflow-hidden rounded-full",
                              theme === "dark" ? "bg-card" : "bg-muted"
                            )}
                          >
                            <motion.div
                              className="h-full rounded-full bg-foreground"
                              initial={{ width: 0 }}
                              animate={{ width: `${caseStudyProgressPercent}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>

                        <div
                          className={cn(
                            "mb-4 rounded-xl border text-sm leading-relaxed",
                            theme === "dark" ? "border-border bg-card/50" : "border-border/60 bg-muted/30"
                          )}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                            onClick={() => setCaseScenarioOpen((o) => !o)}
                            aria-expanded={caseScenarioOpen}
                            aria-controls="case-scenario-panel"
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                              {caseStudyPayload.title}
                            </span>
                            <ChevronDown
                              className={cn("h-4 w-4 shrink-0 transition-transform", caseScenarioOpen && "rotate-180")}
                            />
                          </button>
                          {caseScenarioOpen ? (
                            <div
                              id="case-scenario-panel"
                              className="max-h-[min(40vh,22rem)] space-y-3 overflow-y-auto border-t border-border/50 px-4 py-3 text-muted-foreground"
                            >
                              <p className="text-xs text-muted-foreground">{caseStudyPayload.context}</p>
                              {caseStudyPayload.scenario.split(/\n\n+/).map((para, i) => (
                                <p key={i}>{para.trim()}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <p className="mb-4 text-lg font-medium leading-relaxed">{currentCaseStudyQ.question}</p>
                        <div className="space-y-3">
                          {currentCaseStudyQ.options.map((option, i) => {
                            const isCorrect = i === currentCaseStudyQ.correctIndex;
                            const isSelected = caseStudySelected === i;
                            const letter = String.fromCharCode(65 + i);
                            const cleanOption = option.replace(/^[A-Da-d][\)\.\-\:]\s*/i, "");

                            return (
                              <motion.button
                                key={i}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Case answer ${letter}: ${cleanOption}`}
                                onClick={() => handleCaseStudySelect(i)}
                                disabled={caseStudyShowResult}
                                className={cn(
                                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                                  caseStudyShowResult
                                    ? isCorrect
                                      ? "border-emerald-500 bg-emerald-500/10"
                                      : isSelected
                                        ? "border-red-500 bg-red-500/10"
                                        : "border-border/50 opacity-40"
                                    : cn(
                                        "border-border hover:border-foreground/20",
                                        theme === "dark" ? "bg-card/50 hover:bg-card" : "hover:bg-muted/80"
                                      )
                                )}
                                whileHover={!caseStudyShowResult ? { scale: 1.01 } : {}}
                                whileTap={!caseStudyShowResult ? { scale: 0.99 } : {}}
                              >
                                <span
                                  className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-all",
                                    caseStudyShowResult
                                      ? isCorrect
                                        ? "bg-emerald-500 text-white"
                                        : isSelected
                                          ? "bg-red-500 text-white"
                                          : "bg-muted"
                                      : "bg-muted"
                                  )}
                                >
                                  {caseStudyShowResult && isCorrect ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : caseStudyShowResult && isSelected ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : (
                                    letter
                                  )}
                                </span>
                                <span className="flex-1">{cleanOption}</span>
                              </motion.button>
                            );
                          })}
                        </div>

                        <AnimatePresence>
                          {caseStudyShowResult && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="mt-6"
                            >
                              <motion.div
                                className={cn(
                                  "rounded-xl border p-4",
                                  caseStudySelected === currentCaseStudyQ.correctIndex
                                    ? "border-emerald-500/20 bg-emerald-500/5"
                                    : "border-red-500/20 bg-red-500/5"
                                )}
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                              >
                                <p
                                  className={cn(
                                    "mb-1 text-sm font-semibold",
                                    caseStudySelected === currentCaseStudyQ.correctIndex
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-red-500"
                                  )}
                                >
                                  {caseStudySelected === currentCaseStudyQ.correctIndex
                                    ? "Correct"
                                    : "Incorrect"}
                                </p>
                                <p className="text-sm text-muted-foreground">{currentCaseStudyQ.explanation}</p>
                              </motion.div>
                              <div className="sticky bottom-0 z-10 mt-4 flex items-center gap-2 border-t border-border/40 bg-background/90 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/75">
                                <Button onClick={nextCaseStudyQuestion} className="flex-1 gap-2 rounded-xl">
                                  {caseStudyQIndex < caseStudyPayload.questions.length - 1 ? (
                                    <>
                                      Continue <ArrowRight className="h-4 w-4" />
                                    </>
                                  ) : caseStudyPayload.writtenExercises &&
                                    caseStudyPayload.writtenExercises.length > 0 ? (
                                    <>
                                      Written practice <PenLine className="h-4 w-4" />
                                    </>
                                  ) : (
                                    <>
                                      See results <Trophy className="h-4 w-4" />
                                    </>
                                  )}
                                </Button>
                                <span className="hidden text-xs text-muted-foreground/50 sm:block">
                                  Press Space
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {/* Flashcards Tab */}
                {activeTab === "flashcards" && (
                  <motion.div
                    key="flashcards"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!flashcardTopic ? (
                      <div>
                        <p className="mb-5 text-muted-foreground">
                          Pick a topic to open a new flashcard deck
                        </p>
                        {focusQuickFlashTopic ? (
                          <div
                            className={cn(
                              "mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                              theme === "dark" ? "border-primary/25 bg-primary/5" : "border-primary/20 bg-primary/5"
                            )}
                          >
                            <div className="flex gap-2 text-sm">
                              <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                              <div>
                                <p className="font-medium text-foreground">Quick start from your focus</p>
                                <p className="text-xs text-muted-foreground">
                                  Open flashcards for{" "}
                                  <span className="font-medium text-foreground">{focusQuickFlashTopic}</span>
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="shrink-0 rounded-lg"
                              onClick={() => fetchFlashcards(focusQuickFlashTopic)}
                            >
                              Load these cards
                            </Button>
                          </div>
                        ) : null}
                        <motion.div
                          className="space-y-3"
                          variants={topicStagger.container}
                          initial="hidden"
                          animate="show"
                        >
                          {FLASHCARD_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              variants={topicStagger.item}
                              onClick={() => fetchFlashcards(topic.name)}
                              className={cn(
                                "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
                                theme === "dark"
                                  ? "border-white/10 bg-card/60 hover:border-sky-500/35 hover:bg-card hover:shadow-lg hover:shadow-black/25"
                                  : "border-border/60 bg-card/80 hover:border-sky-600/30 hover:bg-white hover:shadow-md hover:shadow-sky-950/10"
                              )}
                              whileHover={{ scale: 1.005 }}
                              whileTap={{ scale: 0.995 }}
                            >
                              <span className="text-2xl transition-transform duration-200 group-hover:scale-105">
                                {topic.icon}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium">{topic.name}</p>
                                <p className="text-xs text-muted-foreground">New cards each time you open a topic. Deck
                                  length varies.</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </motion.div>
                      </div>
                    ) : loading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <motion.div
                          animate={{ rotateY: [0, 180, 360] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="text-5xl"
                        >
                          {shuffledFlashcardMsgs[loadingMsgIndex % shuffledFlashcardMsgs.length].emoji}
                        </motion.div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={loadingMsgIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 text-muted-foreground"
                          >
                            {shuffledFlashcardMsgs[loadingMsgIndex % shuffledFlashcardMsgs.length].text}
                          </motion.p>
                        </AnimatePresence>
                        <p className="mt-2 text-xs text-muted-foreground/60">{flashcardTopic}</p>
                        <div className="mt-4 flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-muted-foreground/40"
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : currentCard ? (
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setFlashcardTopic(null);
                              setFlashcards([]);
                              setFlashcardHardQueue([]);
                            }}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                          </button>
                          <div className="flex items-center gap-2">
                            {flashcards.map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1.5 w-6 rounded-full transition-colors",
                                  i === currentCardIndex
                                    ? "bg-foreground"
                                    : "bg-muted"
                                )}
                              />
                            ))}
                          </div>
                        </div>

                        {flashcardTopic ? (
                          <div className="mb-3 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg text-xs"
                              onClick={() => goToJournalFromDrill(flashcardTopic)}
                            >
                              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                              Try a journal entry for this topic
                            </Button>
                          </div>
                        ) : null}

                        {/* Flashcard */}
                        <div className="perspective-1000 mb-6">
                          <motion.div
                            className={cn(
                              "relative h-64 w-full cursor-pointer rounded-2xl border-2 p-6",
                              isFlipped
                                ? "border-emerald-500/50 bg-emerald-500/5"
                                : theme === "dark"
                                  ? "border-border bg-card"
                                  : "border-border/60 bg-card"
                            )}
                            onClick={() => setIsFlipped(!isFlipped)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className={cn(
                              "absolute left-4 top-4 rounded-full px-2.5 py-1 text-xs font-medium",
                              isFlipped
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted"
                            )}>
                              {isFlipped ? "Answer" : "Question"}
                            </div>
                            <div className="flex h-full items-center justify-center text-center">
                              <AnimatePresence mode="wait">
                                <motion.p
                                  key={isFlipped ? "back" : "front"}
                                  initial={{ opacity: 0, rotateX: 90 }}
                                  animate={{ opacity: 1, rotateX: 0 }}
                                  exit={{ opacity: 0, rotateX: -90 }}
                                  transition={{ duration: 0.2 }}
                                  className={cn(
                                    "text-lg leading-relaxed",
                                    isFlipped && "text-emerald-600 dark:text-emerald-400"
                                  )}
                                >
                                  {isFlipped ? currentCard.back : currentCard.front}
                                </motion.p>
                              </AnimatePresence>
                            </div>
                            <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-muted-foreground">
                              Tap to flip <span className="hidden sm:inline">or press Space</span>
                            </p>
                          </motion.div>
                        </div>

                        {isFlipped ? (
                          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                flashcardMarkAgain();
                              }}
                            >
                              Again (review later)
                            </Button>
                            {flashcardHardQueue.length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                In queue: {flashcardHardQueue.length}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            className="flex-1 rounded-xl"
                            disabled={currentCardIndex === 0}
                            onClick={() => {
                              setCurrentCardIndex((i) => i - 1);
                              setIsFlipped(false);
                            }}
                          >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">Previous</span>
                          </Button>
                          <span className="hidden text-xs text-muted-foreground/50 sm:block">
                            ← →
                          </span>
                          <Button className="flex-1 rounded-xl" onClick={() => advanceFlashcard()}>
                            <span className="hidden sm:inline">
                              {currentCardIndex === flashcards.length - 1 && flashcardHardQueue.length === 0
                                ? "Finish"
                                : "Next"}
                            </span>
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {/* Match pairs tab */}
                {activeTab === "match" && (
                  <motion.div
                    key="match"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Confetti active={showConfetti && activeTab === "match"} reducedMotion={reduceMotion} />
                    {!matchTopic ? (
                      <div>
                        <p className="mb-5 text-muted-foreground">
                          Pair each term with its definition. Definitions are phrased so they do not just repeat the term,
                          so matching stays a real recall check.
                        </p>
                        {focusQuickMatchTopic ? (
                          <div
                            className={cn(
                              "mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                              theme === "dark" ? "border-primary/25 bg-primary/5" : "border-primary/20 bg-primary/5"
                            )}
                          >
                            <div className="flex gap-2 text-sm">
                              <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                              <div>
                                <p className="font-medium text-foreground">Quick start from your focus</p>
                                <p className="text-xs text-muted-foreground">
                                  Start match for{" "}
                                  <span className="font-medium text-foreground">{focusQuickMatchTopic}</span>
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="shrink-0 rounded-lg"
                              onClick={() => fetchMatchRound(focusQuickMatchTopic)}
                            >
                              Start this match
                            </Button>
                          </div>
                        ) : null}
                        <motion.div
                          className="space-y-3"
                          variants={topicStagger.container}
                          initial="hidden"
                          animate="show"
                        >
                          {MATCH_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              variants={topicStagger.item}
                              onClick={() => fetchMatchRound(topic.name)}
                              className={cn(
                                "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
                                theme === "dark"
                                  ? "border-white/10 bg-card/60 hover:border-violet-400/35 hover:bg-card hover:shadow-lg hover:shadow-black/25"
                                  : "border-border/60 bg-card/80 hover:border-violet-500/35 hover:bg-white hover:shadow-md hover:shadow-violet-950/10"
                              )}
                              whileHover={{ scale: 1.005 }}
                              whileTap={{ scale: 0.995 }}
                            >
                              <span className="text-2xl transition-transform duration-200 group-hover:scale-105">
                                {topic.icon}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium">{topic.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Up to {settings.matchPairCount} pairs per round
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </motion.div>
                      </div>
                    ) : matchLoading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="text-5xl"
                        >
                          {shuffledMatchMsgs[loadingMsgIndex % shuffledMatchMsgs.length].emoji}
                        </motion.div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={loadingMsgIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 text-muted-foreground"
                          >
                            {shuffledMatchMsgs[loadingMsgIndex % shuffledMatchMsgs.length].text}
                          </motion.p>
                        </AnimatePresence>
                        <p className="mt-2 text-xs text-muted-foreground/60">{matchTopic}</p>
                        <div className="mt-4 flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-muted-foreground/40"
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : matchError && matchTiles.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-muted-foreground">{matchError}</p>
                        <Button variant="outline" className="mt-6 rounded-xl" onClick={resetMatchRound}>
                          Back to topics
                        </Button>
                      </div>
                    ) : matchTiles.length > 0 ? (
                      <div>
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={resetMatchRound}
                            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Topics
                          </button>
                          <div className="min-w-0 flex-1 text-center text-xs text-muted-foreground sm:text-sm">
                            <p className="truncate font-medium text-foreground">
                              {matchTopic} · {matchMatched.size}/{matchPairCount} pairs
                            </p>
                            {(settings.matchTimedChallenge || matchCombo > 1) && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {settings.matchTimedChallenge ? <>Time {matchElapsed}s</> : null}
                                {settings.matchTimedChallenge && matchBestSession != null ? (
                                  <> · Best {matchBestSession}s</>
                                ) : null}
                                {matchCombo > 1 ? <> · Streak {matchCombo}</> : null}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-lg px-2 text-xs"
                              onClick={() => matchTopic && goToJournalFromDrill(matchTopic)}
                            >
                              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                              Journal
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-lg text-xs"
                              onClick={() => matchTopic && fetchMatchRound(matchTopic)}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              New deck
                            </Button>
                          </div>
                        </div>

                        {matchComplete && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "mb-4 flex flex-col items-center gap-2 rounded-xl border p-4 sm:flex-row sm:justify-center",
                              theme === "dark" ? "border-emerald-500/30 bg-emerald-500/5" : "border-emerald-500/20 bg-emerald-50"
                            )}
                          >
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                              All pairs matched.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="rounded-lg"
                                onClick={() => {
                                  setMatchComplete(false);
                                  setMatchMatched(new Set());
                                  setMatchSelectedId(null);
                                  setMatchElapsed(0);
                                  setMatchCombo(0);
                                  matchTopic && fetchMatchRound(matchTopic);
                                }}
                              >
                                Again
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-lg" onClick={resetMatchRound}>
                                Topics
                              </Button>
                            </div>
                          </motion.div>
                        )}

                        <p className="mb-3 text-center text-xs text-muted-foreground">
                          Tap a <span className="font-medium text-foreground">term</span>, then its{" "}
                          <span className="font-medium text-foreground">definition</span>
                        </p>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {matchTiles.map((tile) => {
                            const done = matchMatched.has(tile.pairId);
                            const selected = matchSelectedId === tile.id;
                            return (
                              <motion.button
                                key={tile.id}
                                type="button"
                                disabled={done || matchComplete}
                                onClick={() => handleMatchTileClick(tile)}
                                className={cn(
                                  "min-h-[4.5rem] rounded-xl border p-2 text-left text-xs leading-snug transition-colors sm:min-h-[5.5rem] sm:p-3 sm:text-sm",
                                  done &&
                                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                                  !done &&
                                    selected &&
                                    (theme === "dark"
                                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                      : "border-primary bg-primary/5 ring-2 ring-primary/20"),
                                  !done &&
                                    !selected &&
                                    (theme === "dark"
                                      ? "border-border bg-card hover:border-foreground/25"
                                      : "border-border/60 bg-card hover:border-foreground/20")
                                )}
                                whileTap={done || matchComplete ? undefined : { scale: 0.98 }}
                              >
                                <span
                                  className={cn(
                                    "mb-1 block text-[10px] font-semibold uppercase tracking-wide",
                                    tile.side === "term" ? "text-blue-600 dark:text-blue-400" : "text-violet-600 dark:text-violet-400"
                                  )}
                                >
                                  {tile.side === "term" ? "Term" : "Definition"}
                                </span>
                                <span className="line-clamp-4 sm:line-clamp-5">{tile.text}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {/* Journal Entry Tab */}
                {activeTab === "journal" && (
                  <motion.div
                    key="journal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Confetti active={journalConfetti} reducedMotion={reduceMotion} subtle />
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">Journal practice</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Build balanced entries. Your work autosaves on this device.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={copyJournalToClipboard}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          {journalCopied ? "Copied" : "Copy"}
                        </Button>
                        <button
                          type="button"
                          onClick={clearJournal}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
                      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="text-sm font-medium text-foreground">Practice transaction</span>
                        <select
                          value={journalPromptId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setJournalExampleRevealed(false);
                            setJournalEntries(createEmptyJournalRows());
                            setJournalPromptId(v === "" ? null : v);
                          }}
                          className={cn(
                            "h-10 w-full rounded-lg border px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                            theme === "dark" ? "border-border bg-card" : "border-input bg-background"
                          )}
                          aria-label="Choose a practice transaction or blank worksheet"
                        >
                          <option value="">Blank worksheet (no scenario)</option>
                          {JOURNAL_PRACTICE_PROMPTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0 rounded-lg px-4 text-sm font-medium shadow-sm"
                        onClick={() => {
                          const p =
                            JOURNAL_PRACTICE_PROMPTS[
                              Math.floor(Math.random() * JOURNAL_PRACTICE_PROMPTS.length)
                            ]!;
                          setJournalPromptId(p.id);
                          setJournalExampleRevealed(false);
                          setJournalEntries(createEmptyJournalRows());
                        }}
                      >
                        Random prompt
                      </Button>
                    </div>

                    {activeJournalPrompt ? (
                      <div
                        className={cn(
                          "mb-4 rounded-xl border p-3 text-sm leading-relaxed",
                          theme === "dark" ? "border-border bg-card/40" : "border-border/60 bg-muted/30"
                        )}
                      >
                        <p className="font-semibold text-foreground">{activeJournalPrompt.title}</p>
                        <p className="mt-1 text-muted-foreground">{activeJournalPrompt.scenario}</p>
                        {activeJournalPrompt.example.length > 0 ? (
                          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 w-full shrink-0 rounded-lg px-3 text-sm font-medium shadow-sm sm:w-auto"
                              onClick={() => setJournalExampleRevealed((r) => !r)}
                            >
                              {journalExampleRevealed ? "Hide example entry" : "Show example entry"}
                            </Button>
                            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground sm:pt-1.5">
                              Reveal only after you try. One valid pattern, not the only answer.
                            </p>
                          </div>
                        ) : null}
                        {journalExampleRevealed && activeJournalPrompt.example.length > 0 ? (
                          <div
                            className={cn(
                              "mt-3 rounded-lg border p-2 text-xs",
                              theme === "dark" ? "border-emerald-500/20 bg-emerald-950/20" : "border-emerald-500/25 bg-emerald-50/80"
                            )}
                          >
                            <p className="mb-2 font-medium text-foreground">Example (balanced)</p>
                            <ul className="space-y-1 text-muted-foreground">
                              {activeJournalPrompt.example.map((line, li) => (
                                <li key={li}>
                                  <span className="text-foreground">{line.account}</span>
                                  {line.debit ? ` · Dr ${parseJournalAmount(line.debit).toFixed(2)}` : ""}
                                  {line.credit ? ` · Cr ${parseJournalAmount(line.credit).toFixed(2)}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {journalCaseHint ? (
                      <div
                        className={cn(
                          "mb-4 rounded-xl border p-3 text-sm",
                          theme === "dark" ? "border-emerald-500/25 bg-emerald-950/15" : "border-emerald-500/30 bg-emerald-50/90"
                        )}
                        role="status"
                      >
                        <p className="font-medium text-foreground">From your case</p>
                        {journalCaseRefTitle ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{journalCaseRefTitle}</p>
                        ) : null}
                        <p className="mt-1 text-muted-foreground">{journalCaseHint}</p>
                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                          onClick={() => {
                            setJournalCaseHint(null);
                            setJournalCaseRefTitle(null);
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}

                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Reference / memo
                        <input
                          type="text"
                          value={journalMemo}
                          onChange={(e) => setJournalMemo(e.target.value)}
                          placeholder="e.g., Case: Q3 close, Drill: Revenue…"
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-normal outline-none ring-offset-background placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring",
                            theme === "dark" ? "border-border bg-card" : "border-input bg-background"
                          )}
                          aria-label="Journal reference or memo"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Date (optional)
                        <input
                          type="text"
                          value={journalDateStr}
                          onChange={(e) => setJournalDateStr(e.target.value)}
                          placeholder="e.g., 2026-03-15 or Mar 15"
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-normal outline-none ring-offset-background placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring",
                            theme === "dark" ? "border-border bg-card" : "border-input bg-background"
                          )}
                          aria-label="Journal date optional"
                        />
                      </label>
                    </div>

                    <div className="mb-4 rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => setJournalShowRules((s) => !s)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
                        aria-expanded={journalShowRules}
                      >
                        Posting tips
                        <ChevronDown
                          className={cn("h-4 w-4 shrink-0 transition-transform", journalShowRules && "rotate-180")}
                        />
                      </button>
                      {journalShowRules ? (
                        <ul className="space-y-1.5 border-t border-border/50 px-3 py-3 text-xs text-muted-foreground">
                          <li>Put the amount on <span className="font-medium text-foreground">debit or credit</span>, not both on the same line.</li>
                          <li>Total debits must equal total credits for the entry to balance.</li>
                          <li>Each extra line is another account; split amounts across lines when needed.</li>
                        </ul>
                      ) : null}
                    </div>

                    {journalHasInvalidRows ? (
                      <p className="mb-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        One or more rows have both a debit and a credit. Use separate lines for each side.
                      </p>
                    ) : null}

                    {/* Mobile: stacked rows */}
                    <div className="space-y-3 md:hidden">
                      {journalEntries.map((entry, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-xl border p-3",
                            journalRowHasDebitAndCredit(i)
                              ? "border-amber-500/50 bg-amber-500/5"
                              : theme === "dark"
                              ? "border-border bg-card/30"
                              : "border-border/60 bg-background/80"
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Line {i + 1}</span>
                            {journalEntries.length > 2 ? (
                              <button
                                type="button"
                                onClick={() => removeJournalRow(i)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                aria-label={`Remove line ${i + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          <input
                            type="text"
                            value={entry.account}
                            onChange={(e) => updateJournalEntry(i, "account", e.target.value)}
                            placeholder="Account name"
                            aria-label={`Line ${i + 1} account`}
                            className={cn(
                              "mb-2 w-full rounded-lg border px-2 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                              theme === "dark" ? "border-border bg-card/50" : "border-input bg-background"
                            )}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[10px] font-medium text-muted-foreground">
                              Debit
                              <input
                                inputMode="decimal"
                                value={entry.debit}
                                onChange={(e) => updateJournalEntry(i, "debit", e.target.value)}
                                onBlur={() => formatJournalAmountBlur(i, "debit")}
                                placeholder="0.00"
                                aria-label={`Line ${i + 1} debit`}
                                className={cn(
                                  "mt-0.5 w-full rounded-lg border px-2 py-2 text-right text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                                  theme === "dark" ? "border-border bg-card/50" : "border-input bg-background"
                                )}
                              />
                            </label>
                            <label className="text-[10px] font-medium text-muted-foreground">
                              Credit
                              <input
                                inputMode="decimal"
                                value={entry.credit}
                                onChange={(e) => updateJournalEntry(i, "credit", e.target.value)}
                                onBlur={() => formatJournalAmountBlur(i, "credit")}
                                placeholder="0.00"
                                aria-label={`Line ${i + 1} credit`}
                                className={cn(
                                  "mt-0.5 w-full rounded-lg border px-2 py-2 text-right text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                                  theme === "dark" ? "border-border bg-card/50" : "border-input bg-background"
                                )}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium",
                          theme === "dark" ? "border-border bg-card" : "border-border bg-muted/50"
                        )}
                      >
                        <span>Total</span>
                        <span className="tabular-nums">
                          Dr ${totalDebits.toFixed(2)} · Cr ${totalCredits.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div
                      className={cn(
                        "hidden overflow-hidden rounded-xl border md:block",
                        theme === "dark" ? "border-border" : "border-border/60"
                      )}
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={theme === "dark" ? "bg-card" : "bg-muted/50"}>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                            <th className="w-28 px-4 py-3 text-right font-medium text-muted-foreground">Debit</th>
                            <th className="w-28 px-4 py-3 text-right font-medium text-muted-foreground">Credit</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {journalEntries.map((entry, i) => (
                            <tr
                              key={i}
                              className={cn(
                                "border-t border-border/50",
                                journalRowHasDebitAndCredit(i) && "bg-amber-500/10"
                              )}
                            >
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={entry.account}
                                  onChange={(e) => updateJournalEntry(i, "account", e.target.value)}
                                  placeholder={i === 0 ? "e.g., Cash" : i === 1 ? "e.g., Revenue" : "Account name"}
                                  aria-label={`Line ${i + 1} account`}
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-muted/60"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  inputMode="decimal"
                                  value={entry.debit}
                                  onChange={(e) => updateJournalEntry(i, "debit", e.target.value)}
                                  onBlur={() => formatJournalAmountBlur(i, "debit")}
                                  placeholder="0.00"
                                  aria-label={`Line ${i + 1} debit`}
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 text-right outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-muted/60"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  inputMode="decimal"
                                  value={entry.credit}
                                  onChange={(e) => updateJournalEntry(i, "credit", e.target.value)}
                                  onBlur={() => formatJournalAmountBlur(i, "credit")}
                                  placeholder="0.00"
                                  aria-label={`Line ${i + 1} credit`}
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 text-right outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-muted/60"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                {journalEntries.length > 2 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeJournalRow(i)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                    aria-label={`Remove line ${i + 1}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr
                            className={cn(
                              "border-t-2 font-medium",
                              theme === "dark" ? "border-border bg-card" : "border-border bg-muted/50"
                            )}
                          >
                            <td className="px-4 py-3">Total</td>
                            <td className="px-4 py-3 text-right">${totalDebits.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${totalCredits.toFixed(2)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button variant="outline" size="sm" onClick={addJournalRow} className="gap-1 rounded-lg">
                        <Plus className="h-4 w-4" />
                        Add row
                      </Button>
                      <motion.div
                        animate={isBalanced && !journalHasInvalidRows ? { scale: [1, 1.05, 1] } : {}}
                        className={cn(
                          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                          journalHasInvalidRows
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : isBalanced
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : totalDebits > 0 || totalCredits > 0
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {journalHasInvalidRows ? (
                          <>
                            <XCircle className="h-4 w-4" />
                            Fix row errors
                          </>
                        ) : isBalanced ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Balanced
                          </>
                        ) : totalDebits > 0 || totalCredits > 0 ? (
                          <>
                            <XCircle className="h-4 w-4" />
                            Off by ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                          </>
                        ) : (
                          "Enter amounts"
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
  );
}
