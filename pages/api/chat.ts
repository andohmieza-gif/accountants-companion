import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are The Accountant's Companion — a helpful AI for accounting students and professionals.
Explain accounting topics in clear, practical language. Keep answers focused unless the user asks for depth.
When differences exist between US GAAP and IFRS, briefly note both unless the user specifies one.
Format journal entries clearly with debits first, then credits (indented). Use bullet points for lists.
If a question is ambiguous, give a concise answer then ask one clarifying question.`;

const MAX_CONTEXT_MESSAGES = 12;

type IncomingRoleMessage = {
  role?: string;
  content?: unknown;
};

function normalizeMessages(bodyMessages: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(bodyMessages)) return [];
  return (bodyMessages as IncomingRoleMessage[])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        Boolean(m) &&
        typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant")
    )
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_CONTEXT_MESSAGES) as ChatCompletionMessageParam[];
}

type ChatRequestBody = {
  message?: string;
  messages?: unknown;
  stream?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as ChatRequestBody;
  const { message, messages: historyMessages, stream: wantStream } = body;
  const latest =
    typeof message === "string" && message.trim().length > 0 ? message.trim() : null;
  const normalized = normalizeMessages(historyMessages);

  if (!latest && normalized.length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...normalized,
    ...(latest ? [{ role: "user" as const, content: latest }] : []),
  ];

  try {
    if (wantStream) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      (res as NextApiResponse & { flushHeaders?: () => void }).flushHeaders?.();

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        stream: true,
        temperature: 0.4,
        max_tokens: 1024,
      });

      for await (const part of stream) {
        const token = part.choices[0]?.delta?.content ?? "";
        if (token) res.write(token);
      }
      res.end();
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      temperature: 0.4,
      max_tokens: 1024,
    });

    const reply = response.choices[0]?.message?.content || "Sorry, I didn't get that.";
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "OpenAI request failed. Please try again later." });
    }
    try {
      res.end();
    } catch {
      /* ignore */
    }
    return;
  }
}
