import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const OPENAI_API_KEY="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"

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_INSTRUCTIONS = `You are a helpful AI voice assistant. Your role is to answer questions and provide information in a friendly, conversational manner. Keep your responses concise and clear. Focus on providing accurate and helpful answers to the user's questions.`;

app.get('/session', async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        instructions: DEFAULT_INSTRUCTIONS,
        voice: "ash",
      }),
    });
    const result = await response.json();
    console.log('OpenAI session response:', result);
    res.json({result});
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default app;
