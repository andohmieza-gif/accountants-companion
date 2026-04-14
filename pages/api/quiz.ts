import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type QuizRequestBody = {
  topic?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as QuizRequestBody;
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
          content: `You are an accounting quiz generator. Generate exactly 5 multiple choice questions about the given accounting topic.

Return a JSON array with this exact structure (no markdown, just JSON):
[
  {
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why the answer is correct"
  }
]

Make questions appropriate for CPA exam preparation level. Each question must have exactly 4 options.`,
        },
        {
          role: "user",
          content: `Generate 5 quiz questions about: ${topic}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    // Parse JSON from response
    let questions;
    try {
      // Try to extract JSON if it's wrapped in markdown
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      questions = [];
    }

    return res.status(200).json({ questions });
  } catch (error) {
    console.error("Quiz API error:", error);
    return res.status(500).json({ error: "Failed to generate quiz" });
  }
}
