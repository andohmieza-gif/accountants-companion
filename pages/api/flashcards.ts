import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FlashcardsRequestBody = {
  topic?: string;
};

const generateBatch = async (topic: string, batchNum: number) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { 
        role: "system", 
        content: `Generate 5 unique accounting flashcards (batch ${batchNum}). Return JSON: {"flashcards":[{"front":"term or question","back":"answer"}]}` 
      },
      { role: "user", content: topic },
    ],
    temperature: 0.9,
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
  const { topic } = body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    // Generate 2 batches of 5 flashcards in parallel
    const [batch1, batch2] = await Promise.all([
      generateBatch(topic, 1),
      generateBatch(topic, 2),
    ]);

    return res.status(200).json({ flashcards: [...batch1, ...batch2] });
  } catch (error) {
    console.error("Flashcards API error:", error);
    return res.status(500).json({ error: "Failed to generate flashcards" });
  }
}
