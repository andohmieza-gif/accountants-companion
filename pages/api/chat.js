import OpenAI from "openai";

const openai = new OpenAI(); // Reads API key from process.env.OPENAI_API_KEY automatically

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are The Accountant's Companion — a helpful AI chatbot for accounting students and professionals. You explain accounting topics like GAAP, CPA exams, audit, tax, and journal entries in clear, practical language.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = response.choices[0]?.message?.content || "Sorry, I didn't get that.";
    res.status(200).json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "OpenAI request failed. Please try again later." });
  }
}
