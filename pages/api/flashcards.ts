import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FlashcardsRequestBody = {
  topic?: string;
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an accounting flashcard generator. Generate exactly 8 flashcards about the given accounting topic.

Return a JSON array with this exact structure (no markdown, just JSON):
[
  {
    "front": "Question or term on front of card",
    "back": "Answer or definition on back of card"
  }
]

Make flashcards concise and useful for studying. Front should be a question or term, back should be a clear answer.`,
        },
        {
          role: "user",
          content: `Generate 8 flashcards about: ${topic}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    // Parse JSON from response
    let flashcards;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      flashcards = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      flashcards = [];
    }

    return res.status(200).json({ flashcards });
  } catch (error) {
    console.error("Flashcards API error:", error);
    return res.status(500).json({ error: "Failed to generate flashcards" });
  }
}
