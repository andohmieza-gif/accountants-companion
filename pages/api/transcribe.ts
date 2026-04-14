import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let tempPath: string | null = null;

  try {
    const form = formidable({ keepExtensions: true });
    const [, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    // Rename file to have proper extension for Whisper
    const ext = path.extname(audioFile.originalFilename || "") || ".webm";
    tempPath = audioFile.filepath + ext;
    fs.renameSync(audioFile.filepath, tempPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    return res.status(200).json({ text: transcription.text });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return res.status(500).json({ error: "Transcription failed" });
  } finally {
    if (tempPath) fs.unlink(tempPath, () => {});
  }
}
