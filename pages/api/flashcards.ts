import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FlashcardsRequestBody = {
  topic?: string;
  batch?: "first" | "more";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as FlashcardsRequestBody;
  const { topic, batch = "first" } = body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const count = batch === "first" ? 3 : 7;
  const prompt = batch === "first"
    ? `Generate ${count} concise accounting flashcards. Return JSON: {"flashcards":[{"front":"term or question","back":"answer"}]}`
    : `Generate ${count} MORE different accounting flashcards (don't repeat). Return JSON: {"flashcards":[{"front":"term or question","back":"answer"}]}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: topic },
      ],
      temperature: 0.8,
      max_tokens: batch === "first" ? 600 : 1200,
    });

    const content = response.choices[0]?.message?.content || '{"flashcards":[]}';
    const parsed = JSON.parse(content);

    return res.status(200).json({ flashcards: parsed.flashcards || [] });
  } catch (error) {
    console.error("Flashcards API error:", error);
    return res.status(500).json({ error: "Failed to generate flashcards" });
  }
}
