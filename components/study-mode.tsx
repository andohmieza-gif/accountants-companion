import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Brain,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ChevronRight,
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
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Storage key for study stats
const STUDY_STATS_KEY = "accountants-companion-study-stats";
const STUDY_SETTINGS_KEY = "accountants-companion-study-settings";

type Difficulty = "easy" | "medium" | "hard";
type StudyStats = {
  totalQuizzes: number;
  totalCorrect: number;
  totalQuestions: number;
  bestStreak: number;
  totalFlashcards: number;
  topicStats: Record<string, { correct: number; total: number }>;
};

type StudySettings = {
  soundEnabled: boolean;
  timedMode: boolean;
  difficulty: Difficulty;
};

const defaultStats: StudyStats = {
  totalQuizzes: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  bestStreak: 0,
  totalFlashcards: 0,
  topicStats: {},
};

const defaultSettings: StudySettings = {
  soundEnabled: true,
  timedMode: false,
  difficulty: "medium",
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

// Confetti component
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 1,
    color: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)],
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, scale: 1 }}
          animate={{ y: '100vh', opacity: 0, scale: 0, rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          className="absolute h-3 w-3 rounded-full"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

type Tab = "quiz" | "flashcards" | "journal";

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

interface StudyModeProps {
  isOpen: boolean;
  onClose: () => void;
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
];

const FLASHCARD_TOPICS = [
  { name: "Basic Accounting Terms", icon: "📚", count: 10 },
  { name: "Financial Ratios", icon: "📈", count: 10 },
  { name: "Journal Entry Rules", icon: "✍️", count: 10 },
  { name: "GAAP Principles", icon: "📋", count: 10 },
  { name: "Audit Assertions", icon: "✅", count: 10 },
];

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
];

const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function StudyMode({ isOpen, onClose, theme }: StudyModeProps) {
  const [activeTab, setActiveTab] = useState<Tab>("quiz");
  const [quizTopic, setQuizTopic] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [shuffledQuizMsgs, setShuffledQuizMsgs] = useState(QUIZ_LOADING_MESSAGES);
  const [shuffledFlashcardMsgs, setShuffledFlashcardMsgs] = useState(FLASHCARD_LOADING_MESSAGES);
  const [streak, setStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);

  const [flashcardTopic, setFlashcardTopic] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  // New features state
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [settings, setSettings] = useState<StudySettings>(defaultSettings);
  const [stats, setStats] = useState<StudyStats>(defaultStats);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [maxStreak, setMaxStreak] = useState(0);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings and stats from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STUDY_SETTINGS_KEY);
      if (savedSettings) setSettings(JSON.parse(savedSettings));
      
      const savedStats = localStorage.getItem(STUDY_STATS_KEY);
      if (savedStats) setStats(JSON.parse(savedStats));
    } catch (e) {
      // Ignore errors
    }
  }, []);

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
          // Time's up - auto-select wrong answer
          if (selectedAnswer === null) {
            const wrongIndex = quizQuestions[currentQuestionIndex]?.correctIndex === 0 ? 1 : 0;
            handleAnswerSelect(wrongIndex);
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

  // Shuffle and rotate loading messages
  useEffect(() => {
    if (!loading) {
      setLoadingMsgIndex(0);
      return;
    }
    // Shuffle messages when loading starts
    setShuffledQuizMsgs(shuffleArray(QUIZ_LOADING_MESSAGES));
    setShuffledFlashcardMsgs(shuffleArray(FLASHCARD_LOADING_MESSAGES));
    
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => i + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);
  const [isFlipped, setIsFlipped] = useState(false);

  const [journalEntries, setJournalEntries] = useState<{ account: string; debit: string; credit: string }[]>([
    { account: "", debit: "", credit: "" },
    { account: "", debit: "", credit: "" },
  ]);

  const fetchQuiz = useCallback(async (topic: string) => {
    setLoading(true);
    setQuizTopic(topic);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);

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
    setFlashcardTopic(topic);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);

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
    const isCorrect = index === quizQuestions[currentQuestionIndex]?.correctIndex;
    if (isCorrect) {
      playSound("correct", settings.soundEnabled);
      setScore((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 500);
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
    if (!isOpen || activeTab !== "quiz" || !question || showResult || loading) return;
    
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
  }, [isOpen, activeTab, quizQuestions, currentQuestionIndex, showResult, loading]);

  // Space/Enter to continue after answer
  useEffect(() => {
    if (!isOpen || activeTab !== "quiz" || !showResult) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextQuestion();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeTab, showResult]);

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      // Reset timer for next question
      if (settings.timedMode) {
        setTimeLeft(DIFFICULTY_CONFIG[settings.difficulty].time);
      }
    } else {
      // Quiz complete - save stats
      playSound("complete", settings.soundEnabled);
      setQuizComplete(true);
      
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
  };

  const resetQuiz = () => {
    setQuizTopic(null);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Keyboard shortcuts for flashcards
  useEffect(() => {
    const card = flashcards[currentCardIndex];
    if (!isOpen || activeTab !== "flashcards" || !card || loading) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === "ArrowRight" && currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex((i) => i + 1);
        setIsFlipped(false);
      } else if (e.key === "ArrowLeft" && currentCardIndex > 0) {
        setCurrentCardIndex((i) => i - 1);
        setIsFlipped(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeTab, flashcards, currentCardIndex, loading]);

  const addJournalRow = () => {
    setJournalEntries([...journalEntries, { account: "", debit: "", credit: "" }]);
  };

  const removeJournalRow = (index: number) => {
    if (journalEntries.length > 2) {
      setJournalEntries(journalEntries.filter((_, i) => i !== index));
    }
  };

  const clearJournal = () => {
    setJournalEntries([
      { account: "", debit: "", credit: "" },
      { account: "", debit: "", credit: "" },
    ]);
  };

  const updateJournalEntry = (index: number, field: "account" | "debit" | "credit", value: string) => {
    const updated = [...journalEntries];
    updated[index][field] = value;
    setJournalEntries(updated);
  };

  const totalDebits = journalEntries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
  const totalCredits = journalEntries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);
  const isBalanced = totalDebits > 0 && totalDebits === totalCredits;

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const currentCard = flashcards[currentCardIndex];
  const progressPercent = quizQuestions.length > 0 ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100 : 0;

  const tabs = [
    { id: "quiz" as Tab, label: "Quiz", icon: Brain, description: "Test your knowledge" },
    { id: "flashcards" as Tab, label: "Flashcards", icon: Lightbulb, description: "Quick review" },
    { id: "journal" as Tab, label: "Journal", icon: FileSpreadsheet, description: "Practice entries" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
            className={cn(
              "relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl",
              theme === "dark" ? "bg-background" : "bg-white"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl",
                  theme === "dark" ? "bg-card" : "bg-neutral-100"
                )}>
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Study Mode</h2>
                  <p className="text-sm text-muted-foreground">Master accounting concepts</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Stats button */}
                <button
                  onClick={() => {
                    setShowStats(!showStats);
                    setShowSettings(false);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    showStats
                      ? theme === "dark" ? "bg-card text-foreground" : "bg-neutral-200"
                      : theme === "dark" ? "hover:bg-card" : "hover:bg-neutral-100"
                  )}
                  title="View Stats"
                >
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </button>
                {/* Settings button */}
                <button
                  onClick={() => {
                    setShowSettings(!showSettings);
                    setShowStats(false);
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    showSettings
                      ? theme === "dark" ? "bg-card text-foreground" : "bg-neutral-200"
                      : theme === "dark" ? "hover:bg-card" : "hover:bg-neutral-100"
                  )}
                  title="Settings"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                    theme === "dark" ? "hover:bg-card" : "hover:bg-neutral-100"
                  )}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Settings/Stats Panel - Only one shows at a time */}
            <AnimatePresence mode="wait">
              {showSettings && (
                <motion.div
                  key="settings"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-border/40"
                >
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          {settings.soundEnabled ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-sm">Sound Effects</span>
                        </div>
                        <button
                          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                          className={cn(
                            "relative h-6 w-10 rounded-full transition-colors",
                            settings.soundEnabled ? "bg-emerald-500" : theme === "dark" ? "bg-muted" : "bg-neutral-200"
                          )}
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.soundEnabled ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Timed Mode</span>
                        </div>
                        <button
                          onClick={() => updateSettings({ timedMode: !settings.timedMode })}
                          className={cn(
                            "relative h-6 w-10 rounded-full transition-colors",
                            settings.timedMode ? "bg-emerald-500" : theme === "dark" ? "bg-muted" : "bg-neutral-200"
                          )}
                        >
                          <motion.div
                            className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                            animate={{ left: settings.timedMode ? 20 : 4 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Difficulty</span>
                        </div>
                        <div className={cn(
                          "flex gap-0.5 rounded-lg p-0.5",
                          theme === "dark" ? "bg-muted" : "bg-neutral-100"
                        )}>
                          {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
                            <button
                              key={diff}
                              onClick={() => updateSettings({ difficulty: diff })}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                                settings.difficulty === diff
                                  ? "bg-background shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {DIFFICULTY_CONFIG[diff].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {settings.timedMode && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        ⏱️ {DIFFICULTY_CONFIG[settings.difficulty].time}s per question
                      </p>
                    )}
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
                  className="overflow-hidden border-b border-border/40"
                >
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-4 gap-2">
                      <div className={cn(
                        "rounded-lg p-2 text-center",
                        theme === "dark" ? "bg-muted" : "bg-neutral-50"
                      )}>
                        <p className="text-xl font-bold">{stats.totalQuizzes}</p>
                        <p className="text-[10px] text-muted-foreground">Quizzes</p>
                      </div>
                      <div className={cn(
                        "rounded-lg p-2 text-center",
                        theme === "dark" ? "bg-muted" : "bg-neutral-50"
                      )}>
                        <p className="text-xl font-bold">
                          {stats.totalQuestions > 0 
                            ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) 
                            : 0}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">Accuracy</p>
                      </div>
                      <div className={cn(
                        "rounded-lg p-2 text-center",
                        theme === "dark" ? "bg-muted" : "bg-neutral-50"
                      )}>
                        <p className="text-xl font-bold">{stats.bestStreak}</p>
                        <p className="text-[10px] text-muted-foreground">Best Streak</p>
                      </div>
                      <div className={cn(
                        "rounded-lg p-2 text-center",
                        theme === "dark" ? "bg-muted" : "bg-neutral-50"
                      )}>
                        <p className="text-xl font-bold">{stats.totalFlashcards}</p>
                        <p className="text-[10px] text-muted-foreground">Cards</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className={cn(
              "mx-6 flex gap-2 rounded-xl p-1.5",
              theme === "dark" ? "bg-card" : "bg-neutral-100"
            )}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? theme === "dark"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
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
                        <p className="mb-5 text-muted-foreground">
                          Choose a topic to test your knowledge with 10 questions
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {QUIZ_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              onClick={() => fetchQuiz(topic.name)}
                              className={cn(
                                "group flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                                theme === "dark"
                                  ? "border-border bg-card hover:border-foreground/20 hover:bg-card/80"
                                  : "border-border/50 hover:border-foreground/20 hover:shadow-md"
                              )}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <span className="text-2xl">{topic.icon}</span>
                              <span className="flex-1 text-sm font-medium">{topic.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    ) : loading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-5xl"
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
                        <Confetti active={score >= quizQuestions.length * 0.7} />
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
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-8 flex gap-3"
                          >
                            <Button onClick={resetQuiz} size="lg" className="gap-2 rounded-xl px-6">
                              <RotateCcw className="h-4 w-4" />
                              Try Another Topic
                            </Button>
                          </motion.div>
                        </motion.div>
                      </>
                    ) : currentQuestion ? (
                      <div className={cn(correctFlash && "animate-pulse")}>
                        {/* Confetti for streaks */}
                        <Confetti active={showConfetti} />
                        
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
                                    : theme === "dark" ? "bg-card" : "bg-neutral-100"
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
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-500"
                                >
                                  <Flame className="h-3.5 w-3.5" />
                                  <span className="text-xs font-bold">{streak}</span>
                                </motion.div>
                              )}
                              <span className="font-medium">{score} pts</span>
                            </div>
                          </div>
                          <div className={cn(
                            "h-2 overflow-hidden rounded-full",
                            theme === "dark" ? "bg-card" : "bg-neutral-100"
                          )}>
                            <motion.div
                              className={cn(
                                "h-full rounded-full",
                                streak >= 3 ? "bg-gradient-to-r from-orange-500 to-amber-500" : "bg-foreground"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>

                        <p className="mb-6 text-lg font-medium leading-relaxed">{currentQuestion.question}</p>

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
                                        theme === "dark" ? "bg-card/50 hover:bg-card" : "hover:bg-neutral-50"
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
                                      : theme === "dark" ? "bg-background" : "bg-neutral-100"
                                    : theme === "dark" ? "bg-background" : "bg-neutral-100"
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
                              <motion.div 
                                className={cn(
                                  "rounded-xl p-4",
                                  selectedAnswer === currentQuestion.correctIndex
                                    ? "bg-emerald-500/5 border border-emerald-500/20"
                                    : "bg-red-500/5 border border-red-500/20"
                                )}
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                              >
                                <p className={cn(
                                  "mb-1 text-sm font-semibold",
                                  selectedAnswer === currentQuestion.correctIndex ? "text-emerald-600" : "text-red-500"
                                )}>
                                  {selectedAnswer === currentQuestion.correctIndex ? "🎉 Correct!" : "❌ Incorrect"}
                                </p>
                                <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                              </motion.div>
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
                          Select a topic to generate study flashcards
                        </p>
                        <div className="space-y-3">
                          {FLASHCARD_TOPICS.map((topic) => (
                            <motion.button
                              key={topic.name}
                              onClick={() => fetchFlashcards(topic.name)}
                              className={cn(
                                "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                                theme === "dark"
                                  ? "border-border bg-card hover:border-foreground/20"
                                  : "border-border/50 hover:border-foreground/20 hover:shadow-md"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <span className="text-2xl">{topic.icon}</span>
                              <div className="flex-1">
                                <p className="font-medium">{topic.name}</p>
                                <p className="text-xs text-muted-foreground">{topic.count} cards</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </motion.button>
                          ))}
                        </div>
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
                            onClick={() => {
                              setFlashcardTopic(null);
                              setFlashcards([]);
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
                                    : theme === "dark" ? "bg-card" : "bg-neutral-200"
                                )}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Flashcard */}
                        <div className="perspective-1000 mb-6">
                          <motion.div
                            className={cn(
                              "relative h-64 w-full cursor-pointer rounded-2xl border-2 p-6",
                              isFlipped
                                ? "border-emerald-500/50 bg-emerald-500/5"
                                : theme === "dark" ? "border-border bg-card" : "border-border/60"
                            )}
                            onClick={() => setIsFlipped(!isFlipped)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className={cn(
                              "absolute left-4 top-4 rounded-full px-2.5 py-1 text-xs font-medium",
                              isFlipped
                                ? "bg-emerald-500/10 text-emerald-600"
                                : theme === "dark" ? "bg-background" : "bg-neutral-100"
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
                          <Button
                            className="flex-1 rounded-xl"
                            disabled={currentCardIndex === flashcards.length - 1}
                            onClick={() => {
                              const isLast = currentCardIndex === flashcards.length - 2;
                              setCurrentCardIndex((i) => i + 1);
                              setIsFlipped(false);
                              // Track flashcard review on last card
                              if (isLast) {
                                playSound("complete", settings.soundEnabled);
                                updateStats({
                                  totalFlashcards: stats.totalFlashcards + flashcards.length,
                                });
                              }
                            }}
                          >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
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
                    <div className="mb-5 flex items-center justify-between">
                      <p className="text-muted-foreground">
                        Practice creating balanced journal entries
                      </p>
                      <button
                        onClick={clearJournal}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className={cn(
                      "overflow-hidden rounded-xl border",
                      theme === "dark" ? "border-border" : "border-border/60"
                    )}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={theme === "dark" ? "bg-card" : "bg-neutral-50"}>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                            <th className="w-28 px-4 py-3 text-right font-medium text-muted-foreground">Debit</th>
                            <th className="w-28 px-4 py-3 text-right font-medium text-muted-foreground">Credit</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {journalEntries.map((entry, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={entry.account}
                                  onChange={(e) => updateJournalEntry(i, "account", e.target.value)}
                                  placeholder={i === 0 ? "e.g., Cash" : i === 1 ? "e.g., Service Revenue" : "Account name"}
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-neutral-50"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={entry.debit}
                                  onChange={(e) => updateJournalEntry(i, "debit", e.target.value)}
                                  placeholder="0.00"
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 text-right outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-neutral-50"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={entry.credit}
                                  onChange={(e) => updateJournalEntry(i, "credit", e.target.value)}
                                  placeholder="0.00"
                                  className={cn(
                                    "w-full rounded-lg border-0 bg-transparent px-2 py-2 text-right outline-none placeholder:text-muted-foreground/40",
                                    theme === "dark" ? "focus:bg-card" : "focus:bg-neutral-50"
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                {journalEntries.length > 2 && (
                                  <button
                                    onClick={() => removeJournalRow(i)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={cn(
                            "border-t-2 font-medium",
                            theme === "dark" ? "border-border bg-card" : "border-border bg-neutral-50"
                          )}>
                            <td className="px-4 py-3">Total</td>
                            <td className="px-4 py-3 text-right">${totalDebits.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${totalCredits.toFixed(2)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={addJournalRow} className="gap-1 rounded-lg">
                        <Plus className="h-4 w-4" />
                        Add Row
                      </Button>
                      <motion.div
                        animate={isBalanced ? { scale: [1, 1.05, 1] } : {}}
                        className={cn(
                          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                          isBalanced
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : totalDebits > 0 || totalCredits > 0
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : theme === "dark" ? "bg-card text-muted-foreground" : "bg-neutral-100 text-muted-foreground"
                        )}
                      >
                        {isBalanced ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Balanced!
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
