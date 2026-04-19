/** Quiz / case / flashcard APIs accept this to steer GAAP vs IFRS emphasis. */
export type StandardsFocus = "gaap" | "ifrs" | "both";

export function parseStandardsFocus(raw: unknown): StandardsFocus {
  if (raw === "ifrs" || raw === "gaap" || raw === "both") return raw;
  return "gaap";
}

export function standardsUserInstruction(focus: StandardsFocus): string {
  switch (focus) {
    case "ifrs":
      return "Framing: prioritize IFRS. Mention US GAAP only when a short contrast helps.";
    case "both":
      return "Framing: lead with US GAAP, then note the main IFRS difference when it matters.";
    default:
      return "Framing: US GAAP throughout (ASC references when they fit naturally).";
  }
}
