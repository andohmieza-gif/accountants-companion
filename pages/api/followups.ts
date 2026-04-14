import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FollowupsRequestBody = {
  question?: string;
  answer?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as FollowupsRequestBody;
  const { question, answer } = body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You generate follow-up questions for an accounting assistant. Given a user's question and the assistant's answer, suggest exactly 3 specific, relevant follow-up questions the user might want to ask next.

Rules:
- Keep each question under 45 characters
- Make them specific to the topic discussed, not generic
- Return ONLY the 3 questions, one per line, no numbering or bullets`,
        },
        {
          role: "user",
          content: `User asked: "${question.slice(0, 200)}"

Assistant answered about: "${answer.slice(0, 300)}"

Generate 3 follow-up questions:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content || "";
    const followups = content
      .split("\n")
      .map((line) => line.replace(/^[\d\.\-\*\)]+\s*/, "").trim())
      .filter((line) => line.length > 0 && line.length < 60)
      .slice(0, 3);

    return res.status(200).json({ followups });
  } catch (error) {
    console.error("Followups API error:", error);
    return res.status(500).json({ error: "Failed to generate follow-ups" });
  }
}
