import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FlashcardsRequestBody = {
  topic?: string;
  /** When true, backs are written for a term↔definition match game: no spoilers on the back. */
  forMatch?: boolean;
};

const FLASHCARD_SYSTEM = (batchNum: number) =>
  `Generate 5 unique accounting flashcards (batch ${batchNum}). Return JSON: {"flashcards":[{"front":"term or question","back":"answer"}]}`;

const MATCH_PAIR_SYSTEM = (batchNum: number) =>
  `Generate 5 unique accounting items (batch ${batchNum}) for a TERM↔DEFINITION MATCHING game (not general study cards).

Return JSON: {"flashcards":[{"front":"...","back":"..."}]}

Front ("front"): a clear prompt—concept name, ratio name, acronym, or "what is / how is / formula for …" style question is fine.

Back ("back") — follow ALL of these:
1. Do NOT start the back with the same acronym or label that appears on the front (e.g. if the front says "ROE" or "Return on Equity", the back must NOT begin with "ROE", "Return on equity", or similar).
2. Do NOT put the ratio or metric TITLE in the first sentence; lead with the economic meaning in plain words ("Measures how effectively…" / "Shows whether…").
3. For formula-style fronts: express the math with generic phrases ("divide total stockholders' profit by average equity") or symbols-only style where the ratio name is omitted—never a line like "Current Ratio = Current Assets / …" that repeats the name from the front.
4. The back must still be uniquely correct for that front—just not trivially pairable by copying repeated proper nouns.

Keep each back under ~220 characters when possible.`;

const generateBatch = async (topic: string, batchNum: number, forMatch: boolean) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: forMatch ? MATCH_PAIR_SYSTEM(batchNum) : FLASHCARD_SYSTEM(batchNum),
      },
      {
        role: "user",
        content: forMatch
          ? `Topic/theme: ${topic}\nGenerate pairs suitable for matching practice on this topic.`
          : topic,
      },
    ],
    temperature: forMatch ? 0.75 : 0.9,
    max_tokens: 1000,
  });
  const content = response.choices[0]?.message?.content || '{"flashcards":[]}';
  return JSON.parse(content).flashcards || [];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as FlashcardsRequestBody;
  const { topic, forMatch } = body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const matchMode = Boolean(forMatch);

  try {
    const [batch1, batch2] = await Promise.all([
      generateBatch(topic, 1, matchMode),
      generateBatch(topic, 2, matchMode),
    ]);

    return res.status(200).json({ flashcards: [...batch1, ...batch2] });
  } catch (error) {
    console.error("Flashcards API error:", error);
    return res.status(500).json({ error: "Failed to generate flashcards" });
  }
}
