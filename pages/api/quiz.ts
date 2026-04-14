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
      response_format: { type: "json_object" },
      messages: [
        { 
          role: "system", 
          content: `Generate 10 CPA-level multiple choice questions. Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}` 
        },
        { role: "user", content: topic },
      ],
      temperature: 0.8,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content || '{"questions":[]}';
    const parsed = JSON.parse(content);

    return res.status(200).json({ questions: parsed.questions || [] });
  } catch (error) {
    console.error("Quiz API error:", error);
    return res.status(500).json({ error: "Failed to generate quiz" });
  }
}
