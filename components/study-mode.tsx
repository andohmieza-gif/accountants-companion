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
  RotateCcw,
  Loader2,
  Lightbulb,
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
  "Financial Statements",
  "Revenue Recognition (ASC 606)",
  "Leases (ASC 842)",
  "Depreciation Methods",
  "Inventory Valuation",
  "Accounts Receivable",
  "Bond Accounting",
  "Equity Transactions",
  "Cash Flow Statement",
  "Audit Procedures",
];

const FLASHCARD_TOPICS = [
  "Basic Accounting Terms",
  "Financial Ratios",
  "Journal Entry Rules",
  "GAAP Principles",
  "Audit Assertions",
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
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data.questions || []);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setScore(0);
        setQuizComplete(false);
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
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards || []);
        setCurrentCardIndex(0);
        setIsFlipped(false);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={cn(
              "relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl",
              theme === "dark" ? "border-border bg-card" : "border-border/60 bg-white"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
                  <BookOpen className="h-5 w-5 text-background" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Study Mode</h2>
                  <p className="text-sm text-muted-foreground">Practice and learn accounting</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/50">
              {[
                { id: "quiz" as Tab, label: "Practice Quiz", icon: Brain },
                { id: "flashcards" as Tab, label: "Flashcards", icon: Lightbulb },
                { id: "journal" as Tab, label: "Journal Entry", icon: FileSpreadsheet },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-b-2 border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {/* Quiz Tab */}
              {activeTab === "quiz" && (
                <div>
                  {!quizTopic ? (
                    <div>
                      <p className="mb-4 text-sm text-muted-foreground">Select a topic to start a 5-question quiz:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {QUIZ_TOPICS.map((topic) => (
                          <button
                            key={topic}
                            onClick={() => fetchQuiz(topic)}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all hover:border-foreground/20",
                              theme === "dark" ? "border-border bg-background" : "border-border/50 bg-neutral-50"
                            )}
                          >
                            {topic}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Generating quiz...</p>
                    </div>
                  ) : quizComplete ? (
                    <div className="text-center py-8">
                      <div className="mb-4 text-5xl font-bold">
                        {score}/{quizQuestions.length}
                      </div>
                      <p className="mb-6 text-muted-foreground">
                        {score === quizQuestions.length
                          ? "Perfect score! 🎉"
                          : score >= quizQuestions.length / 2
                          ? "Good job! Keep practicing."
                          : "Keep studying, you'll get there!"}
                      </p>
                      <Button onClick={resetQuiz} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Try Another Topic
                      </Button>
                    </div>
                  ) : currentQuestion ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Question {currentQuestionIndex + 1} of {quizQuestions.length}
                        </span>
                        <span className="text-sm font-medium">Score: {score}</span>
                      </div>
                      <p className="mb-6 text-lg font-medium">{currentQuestion.question}</p>
                      <div className="space-y-2">
                        {currentQuestion.options.map((option, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswerSelect(i)}
                            disabled={showResult}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                              showResult
                                ? i === currentQuestion.correctIndex
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : selectedAnswer === i
                                  ? "border-red-500 bg-red-500/10"
                                  : "border-border opacity-50"
                                : "border-border hover:border-foreground/20",
                              theme === "dark" ? "bg-background" : "bg-white"
                            )}
                          >
                            {showResult && i === currentQuestion.correctIndex && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                            )}
                            {showResult && selectedAnswer === i && i !== currentQuestion.correctIndex && (
                              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                            )}
                            <span>{option}</span>
                          </button>
                        ))}
                      </div>
                      {showResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4"
                        >
                          <div className={cn(
                            "rounded-xl p-4 text-sm",
                            theme === "dark" ? "bg-muted" : "bg-neutral-100"
                          )}>
                            <p className="font-medium mb-1">Explanation:</p>
                            <p className="text-muted-foreground">{currentQuestion.explanation}</p>
                          </div>
                          <Button onClick={nextQuestion} className="mt-4 w-full">
                            {currentQuestionIndex < quizQuestions.length - 1 ? "Next Question" : "See Results"}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No questions available.</p>
                  )}
                </div>
              )}

              {/* Flashcards Tab */}
              {activeTab === "flashcards" && (
                <div>
                  {!flashcardTopic ? (
                    <div>
                      <p className="mb-4 text-sm text-muted-foreground">Select a topic to generate flashcards:</p>
                      <div className="grid gap-2">
                        {FLASHCARD_TOPICS.map((topic) => (
                          <button
                            key={topic}
                            onClick={() => fetchFlashcards(topic)}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all hover:border-foreground/20",
                              theme === "dark" ? "border-border bg-background" : "border-border/50 bg-neutral-50"
                            )}
                          >
                            {topic}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Generating flashcards...</p>
                    </div>
                  ) : currentCard ? (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setFlashcardTopic(null);
                            setFlashcards([]);
                          }}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          ← Back to topics
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {currentCardIndex + 1} / {flashcards.length}
                        </span>
                      </div>
                      <motion.div
                        className={cn(
                          "relative min-h-[200px] cursor-pointer rounded-2xl border p-6",
                          theme === "dark" ? "border-border bg-background" : "border-border/50 bg-white shadow-sm"
                        )}
                        onClick={() => setIsFlipped(!isFlipped)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {isFlipped ? "Answer" : "Question"}
                        </div>
                        <div className="flex min-h-[160px] items-center justify-center text-center">
                          <p className={cn("text-lg", isFlipped && "text-emerald-600 dark:text-emerald-400")}>
                            {isFlipped ? currentCard.back : currentCard.front}
                          </p>
                        </div>
                        <p className="mt-4 text-center text-xs text-muted-foreground">Click to flip</p>
                      </motion.div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          disabled={currentCardIndex === 0}
                          onClick={() => {
                            setCurrentCardIndex((i) => i - 1);
                            setIsFlipped(false);
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={currentCardIndex === flashcards.length - 1}
                          onClick={() => {
                            setCurrentCardIndex((i) => i + 1);
                            setIsFlipped(false);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No flashcards available.</p>
                  )}
                </div>
              )}

              {/* Journal Entry Tab */}
              {activeTab === "journal" && (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Practice creating journal entries. Debits must equal credits.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-2 text-left font-medium">Account</th>
                          <th className="pb-2 text-right font-medium w-28">Debit</th>
                          <th className="pb-2 text-right font-medium w-28">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalEntries.map((entry, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-2">
                              <input
                                type="text"
                                value={entry.account}
                                onChange={(e) => updateJournalEntry(i, "account", e.target.value)}
                                placeholder="Account name"
                                className={cn(
                                  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-foreground/30",
                                  theme === "dark" ? "border-border bg-background" : "border-border/50"
                                )}
                              />
                            </td>
                            <td className="py-1.5 px-1">
                              <input
                                type="number"
                                value={entry.debit}
                                onChange={(e) => updateJournalEntry(i, "debit", e.target.value)}
                                placeholder="0.00"
                                className={cn(
                                  "w-full rounded-lg border px-3 py-2 text-right text-sm outline-none focus:border-foreground/30",
                                  theme === "dark" ? "border-border bg-background" : "border-border/50"
                                )}
                              />
                            </td>
                            <td className="py-1.5 pl-1">
                              <input
                                type="number"
                                value={entry.credit}
                                onChange={(e) => updateJournalEntry(i, "credit", e.target.value)}
                                placeholder="0.00"
                                className={cn(
                                  "w-full rounded-lg border px-3 py-2 text-right text-sm outline-none focus:border-foreground/30",
                                  theme === "dark" ? "border-border bg-background" : "border-border/50"
                                )}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-medium">
                          <td className="pt-3">Total</td>
                          <td className="pt-3 text-right">{totalDebits.toFixed(2)}</td>
                          <td className="pt-3 text-right">{totalCredits.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={addJournalRow}>
                      + Add Row
                    </Button>
                    <div className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
                      isBalanced ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {isBalanced ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Balanced
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          Not balanced
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
