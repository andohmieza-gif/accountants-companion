import { useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const [flashcardTopic, setFlashcardTopic] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
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
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === quizQuestions[currentQuestionIndex]?.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);
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
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-10 w-10 text-muted-foreground" />
                        </motion.div>
                        <p className="mt-4 text-muted-foreground">Generating your quiz...</p>
                        <p className="mt-1 text-xs text-muted-foreground/60">{quizTopic}</p>
                      </div>
                    ) : quizComplete ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center py-8 text-center"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                          className={cn(
                            "mb-6 flex h-20 w-20 items-center justify-center rounded-full",
                            score === quizQuestions.length
                              ? "bg-emerald-500/10"
                              : score >= quizQuestions.length / 2
                              ? "bg-amber-500/10"
                              : "bg-muted"
                          )}
                        >
                          {score === quizQuestions.length ? (
                            <Trophy className="h-10 w-10 text-emerald-500" />
                          ) : (
                            <Sparkles className="h-10 w-10 text-amber-500" />
                          )}
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <p className="text-5xl font-bold">
                            {score}<span className="text-2xl text-muted-foreground">/{quizQuestions.length}</span>
                          </p>
                          <p className="mt-3 text-lg text-muted-foreground">
                            {score === quizQuestions.length
                              ? "Perfect score! Outstanding!"
                              : score >= quizQuestions.length / 2
                              ? "Good work! Keep practicing."
                              : "Keep studying, you'll improve!"}
                          </p>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="mt-8"
                        >
                          <Button onClick={resetQuiz} size="lg" className="gap-2 rounded-xl px-6">
                            <RotateCcw className="h-4 w-4" />
                            Try Another Topic
                          </Button>
                        </motion.div>
                      </motion.div>
                    ) : currentQuestion ? (
                      <div>
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
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{currentQuestionIndex + 1}</span> of {quizQuestions.length}
                            </span>
                            <span className="font-medium">{score} pts</span>
                          </div>
                          <div className={cn(
                            "h-2 overflow-hidden rounded-full",
                            theme === "dark" ? "bg-card" : "bg-neutral-100"
                          )}>
                            <motion.div
                              className="h-full rounded-full bg-foreground"
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
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium",
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
                              <div className={cn(
                                "rounded-xl p-4",
                                theme === "dark" ? "bg-card" : "bg-neutral-50"
                              )}>
                                <p className="mb-1 text-sm font-medium">
                                  {selectedAnswer === currentQuestion.correctIndex ? "✓ Correct!" : "✗ Incorrect"}
                                </p>
                                <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                              </div>
                              <Button onClick={nextQuestion} className="mt-4 w-full gap-2 rounded-xl">
                                {currentQuestionIndex < quizQuestions.length - 1 ? (
                                  <>Continue <ArrowRight className="h-4 w-4" /></>
                                ) : (
                                  <>See Results <Trophy className="h-4 w-4" /></>
                                )}
                              </Button>
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
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-10 w-10 text-muted-foreground" />
                        </motion.div>
                        <p className="mt-4 text-muted-foreground">Creating flashcards...</p>
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
                              Tap to flip
                            </p>
                          </motion.div>
                        </div>

                        <div className="flex gap-3">
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
                            Previous
                          </Button>
                          <Button
                            className="flex-1 rounded-xl"
                            disabled={currentCardIndex === flashcards.length - 1}
                            onClick={() => {
                              setCurrentCardIndex((i) => i + 1);
                              setIsFlipped(false);
                            }}
                          >
                            Next
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
