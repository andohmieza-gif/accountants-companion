import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type CaseStudyRequestBody = {
  topic?: string;
};

const SYSTEM = `You write realistic U.S. GAAP-focused accounting case studies for CPA candidates and working accountants.

Rules:
- Use a fictional company name and realistic facts (amounts, dates, roles, industry). Never use real public company names.
- The scenario must read like something that could happen in practice: controller, auditor, tax, FP&A, or financial reporting context as fits the topic.
- Write for both learners and professionals: clear enough for students, substantive enough for practitioners.
- Ground questions in the facts given; answers should require reasoning from the case, not generic textbook recall.
- Explanations should cite the relevant accounting logic (ASC topics, audit mindset, or professional judgment) in plain language.

Return ONLY valid JSON with this exact shape:
{
  "title": "short title for the case",
  "context": "one line: entity type, industry, and your role (e.g., corporate controller at a mid-size SaaS company)",
  "scenario": "multi-paragraph narrative with specific facts. Use \\n\\n between paragraphs. Where helpful, include short labeled sections (e.g. key concerns, relevant balances) like a real case packet.",
  "questions": [
    {
      "question": "question text referencing the case",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "why the best answer follows from GAAP / practice, tied to the scenario"
    }
  ],
  "practiceNotes": "2–4 sentences: what a professional would watch for next, document, or escalate in the real world.",
  "discussionQuestions": ["open-ended prompt 1", "open-ended prompt 2", "open-ended prompt 3"],
  "writtenExercises": [
    {
      "role": "short hat / role (e.g. Audit senior, Corporate controller)",
      "prompt": "Realistic task the learner types an answer to: e.g. list key procedures, draft memo bullets, explain judgment, outline journal entries conceptually — grounded in THIS case's facts.",
      "outline": ["3–6 bullet points a strong answer might cover — for self-check and feedback; not copy-pasted from the prompt"]
    }
  ]
}

Generate exactly 5 scored multiple-choice questions. correctIndex must be 0–3. Options must be distinct and plausible.

Provide exactly 3 "discussionQuestions": short, open-ended prompts for reflection or group study.

Provide exactly 2 "writtenExercises". Each must feel like real work product practice (not trivia): different angles (e.g. risk + procedures, or accounting treatment + disclosure). "outline" must have 3–6 distinct, substantive bullets tied to the scenario.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as CaseStudyRequestBody;
  const { topic } = body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Topic / theme for this case study: ${topic}\n\nVary the fact pattern so it does not resemble generic textbook examples.`,
        },
      ],
      temperature: 0.85,
      max_tokens: 5200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "Empty model response" });
    }

    const parsed = JSON.parse(content) as {
      title?: string;
      context?: string;
      scenario?: string;
      questions?: Array<{
        question?: string;
        options?: string[];
        correctIndex?: number;
        explanation?: string;
      }>;
      practiceNotes?: string;
      discussionQuestions?: unknown;
      writtenExercises?: unknown;
    };

    const questions = (parsed.questions || []).filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3 &&
        typeof q.explanation === "string"
    );

    if (!parsed.title || !parsed.context || !parsed.scenario || questions.length < 3 || !parsed.practiceNotes) {
      return res.status(500).json({ error: "Invalid case study structure" });
    }

    const discussionQuestions = Array.isArray(parsed.discussionQuestions)
      ? parsed.discussionQuestions
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 5)
      : [];

    const rawWritten = parsed.writtenExercises;
    const writtenExercises = Array.isArray(rawWritten)
      ? rawWritten
          .filter(
            (ex): ex is { role: string; prompt: string; outline: string[] } =>
              !!ex &&
              typeof ex === "object" &&
              typeof (ex as { role?: unknown }).role === "string" &&
              typeof (ex as { prompt?: unknown }).prompt === "string" &&
              Array.isArray((ex as { outline?: unknown }).outline)
          )
          .map((ex) => {
            const outline = (ex.outline as unknown[])
              .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
              .map((o) => o.trim())
              .slice(0, 8);
            return {
              role: (ex.role as string).trim(),
              prompt: (ex.prompt as string).trim(),
              outline,
            };
          })
          .filter((ex) => ex.role.length > 0 && ex.prompt.length > 0 && ex.outline.length >= 2)
          .slice(0, 3)
      : [];

    return res.status(200).json({
      title: parsed.title,
      context: parsed.context,
      scenario: parsed.scenario,
      questions,
      practiceNotes: parsed.practiceNotes,
      ...(discussionQuestions.length > 0 ? { discussionQuestions } : {}),
      ...(writtenExercises.length > 0 ? { writtenExercises } : {}),
    });
  } catch (error) {
    console.error("Case study API error:", error);
    return res.status(500).json({ error: "Failed to generate case study" });
  }
}
