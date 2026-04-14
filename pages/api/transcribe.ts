import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { IncomingForm, File } from "formidable";
import fs from "fs";

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

  try {
    const form = new IncomingForm();
    
    const [, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const audioFile = files.audio as File | File[];
    const file = Array.isArray(audioFile) ? audioFile[0] : audioFile;

    if (!file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.filepath),
      model: "whisper-1",
      language: "en",
    });

    // Clean up temp file
    fs.unlink(file.filepath, () => {});

    return res.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return res.status(500).json({ error: "Transcription failed" });
  }
}
