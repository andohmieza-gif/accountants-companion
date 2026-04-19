import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI();

type FeedbackBody = {
  caseTitle?: string;
  scenario?: string;
  exerciseRole?: string;
  exercisePrompt?: string;
  userAnswer?: string;
  modelOutline?: string[];
  /** coaching = warm tutor; exam = tighter bar, exam-style tone */
  style?: "coaching" | "exam";
  /** 1–5 self-rating before requesting feedback */
  selfRubricScore?: number;
};

const COACHING_SYSTEM = `You are a supportive CPA / accounting educator reviewing a learner's written response to a case study exercise.

Rules:
- Be constructive and specific. Note strengths, gaps, and blind spots relative to the case facts.
- You may use the "model outline" bullets as a private rubric, but do not quote them verbatim as a checklist. Synthesize.
- Keep feedback concise: at most 4 short paragraphs or bullet groups, plain language, no numeric score on their answer.
- If the answer is very thin, encourage expanding on risks, procedures, documentation, or professional judgment — without writing the full answer for them.
- U.S. GAAP / audit mindset unless the prompt clearly implies otherwise.`;

const EXAM_SYSTEM = `You are a rigorous accounting examiner-style coach reviewing a constructed response.

Rules:
- Hold a higher bar than a casual tutor: call out missing standards, incomplete procedures, weak risk linkage, or disclosure gaps vs. what a strong candidate would write.
- Still do not assign a letter grade or single numeric score on their answer.
- Be direct but respectful. At most 3 short paragraphs or tight bullet groups.
- You may use the model outline as a private rubric; synthesize, do not recite it.
- U.S. GAAP / audit mindset unless the prompt clearly implies otherwise.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as FeedbackBody;
  const { caseTitle, scenario, exerciseRole, exercisePrompt, userAnswer, modelOutline, style, selfRubricScore } =
    body;

  if (!exercisePrompt || !userAnswer || !userAnswer.trim()) {
    return res.status(400).json({ error: "exercisePrompt and userAnswer are required" });
  }

  const scenarioText = typeof scenario === "string" ? scenario.slice(0, 8000) : "";
  const outline =
    Array.isArray(modelOutline) && modelOutline.length > 0
      ? modelOutline.filter((s) => typeof s === "string" && s.trim()).slice(0, 12).join("\n• ")
      : "(none provided)";

  const system = style === "exam" ? EXAM_SYSTEM : COACHING_SYSTEM;
  const self =
    typeof selfRubricScore === "number" && selfRubricScore >= 1 && selfRubricScore <= 5
      ? `${selfRubricScore}/5 (how well they think they covered the outline)`
      : "not provided";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Case title: ${caseTitle || "Case study"}

Scenario (excerpt):
${scenarioText || "(not provided)"}

Learner role for this task: ${exerciseRole || "Professional"}

Exercise prompt:
${exercisePrompt}

Learner self-assessment vs. outline coverage: ${self}

Model outline (for your reference only — do not present as the only correct answer):
• ${outline}

Learner's response:
${userAnswer.trim()}

Provide feedback as described in your instructions.`,
        },
      ],
      temperature: style === "exam" ? 0.35 : 0.5,
      max_tokens: style === "exam" ? 650 : 850,
    });

    const feedback = response.choices[0]?.message?.content?.trim();
    if (!feedback) {
      return res.status(500).json({ error: "Empty feedback" });
    }

    return res.status(200).json({ feedback });
  } catch (error) {
    console.error("Case study feedback API error:", error);
    return res.status(500).json({ error: "Failed to generate feedback" });
  }
}
