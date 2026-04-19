export type JournalLine = { account: string; debit: string; credit: string };

export type JournalPracticePrompt = {
  id: string;
  title: string;
  scenario: string;
  tags: string[];
  /** One valid balanced entry learners can reveal after trying. */
  example: JournalLine[];
};

export const JOURNAL_PRACTICE_PROMPTS: JournalPracticePrompt[] = [
  {
    id: "cash-service-revenue",
    title: "Cash for services",
    scenario:
      "A consulting firm completes a project and immediately collects $8,500 cash from the client for services rendered.",
    tags: ["revenue", "cash", "service", "journal", "basic"],
    example: [
      { account: "Cash", debit: "8500", credit: "" },
      { account: "Service Revenue", debit: "", credit: "8500" },
    ],
  },
  {
    id: "unearned-revenue",
    title: "Customer deposit (unearned revenue)",
    scenario:
      "A SaaS company receives $12,000 cash from a customer for a one-year subscription that starts today. Record the cash receipt.",
    tags: ["revenue", "unearned", "deferred", "liability", "journal", "asc 606"],
    example: [
      { account: "Cash", debit: "12000", credit: "" },
      { account: "Unearned Subscription Revenue", debit: "", credit: "12000" },
    ],
  },
  {
    id: "supplies-on-account",
    title: "Supplies on account",
    scenario:
      "The business purchases $640 of office supplies from a vendor on credit (invoice due in 30 days).",
    tags: ["inventory", "supplies", "payable", "journal", "cogs"],
    example: [
      { account: "Office Supplies", debit: "640", credit: "" },
      { account: "Accounts Payable", debit: "", credit: "640" },
    ],
  },
  {
    id: "accrued-salaries",
    title: "Accrued salaries",
    scenario:
      "December 31: Employees earned $4,200 in wages that will be paid on the next payroll date in January. Record the accrual.",
    tags: ["payroll", "accrual", "expense", "journal", "gaap"],
    example: [
      { account: "Salaries and Wages Expense", debit: "4200", credit: "" },
      { account: "Salaries and Wages Payable", debit: "", credit: "4200" },
    ],
  },
  {
    id: "depreciation",
    title: "Monthly depreciation",
    scenario:
      "Record $1,850 of straight-line depreciation on equipment for the current month.",
    tags: ["depreciation", "fixed", "ppe", "journal", "expense"],
    example: [
      { account: "Depreciation Expense", debit: "1850", credit: "" },
      { account: "Accumulated Depreciation — Equipment", debit: "", credit: "1850" },
    ],
  },
  {
    id: "prepaid-insurance",
    title: "Prepaid insurance paid in cash",
    scenario:
      "The company pays $3,600 cash for a 12-month insurance policy effective immediately. Record the payment.",
    tags: ["prepaid", "asset", "cash", "journal"],
    example: [
      { account: "Prepaid Insurance", debit: "3600", credit: "" },
      { account: "Cash", debit: "", credit: "3600" },
    ],
  },
  {
    id: "ar-service",
    title: "Services on account",
    scenario:
      "The firm bills a client $5,200 for completed audit fieldwork. Payment is due in 45 days.",
    tags: ["receivable", "revenue", "audit", "journal"],
    example: [
      { account: "Accounts Receivable", debit: "5200", credit: "" },
      { account: "Service Revenue", debit: "", credit: "5200" },
    ],
  },
  {
    id: "dividend-declared",
    title: "Cash dividend paid",
    scenario:
      "The board declared and the company paid $15,000 cash dividends to shareholders.",
    tags: ["equity", "dividend", "cash", "journal"],
    example: [
      { account: "Dividends", debit: "15000", credit: "" },
      { account: "Cash", debit: "", credit: "15000" },
    ],
  },
];

export function findPromptsForTopic(topicName: string): JournalPracticePrompt[] {
  const t = topicName.toLowerCase();
  const stop = new Set(["and", "the", "for", "with"]);
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w));
  const matched = JOURNAL_PRACTICE_PROMPTS.filter((p) =>
    p.tags.some((tag) => t.includes(tag) || words.some((w) => tag.includes(w) || w.includes(tag)))
  );
  return matched.length ? matched : JOURNAL_PRACTICE_PROMPTS;
}

export function pickRandomPromptForTopic(topicName: string): JournalPracticePrompt {
  const list = findPromptsForTopic(topicName);
  return list[Math.floor(Math.random() * list.length)]!;
}

export function getPromptById(id: string | null): JournalPracticePrompt | null {
  if (!id) return null;
  return JOURNAL_PRACTICE_PROMPTS.find((p) => p.id === id) ?? null;
}
