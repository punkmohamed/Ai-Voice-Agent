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

const DEFAULT_INSTRUCTIONS = `You are a helpful AI voice assistant with UI customization capabilities. Respond to the user in a friendly, conversational manner. You can help with information, answer questions, or just chat.

You have access to the following tools to customize the user interface:
1. changeBackgroundColor - Changes the background color (accepts color names or hex codes like #ffffff)
2. changeTextColor - Changes the text color (accepts color names or hex codes like #000000)
3. changeButtonColor - Changes the button color (accepts: blue, green, purple, red, yellow)
4. changeTextSize - Changes the text size (accepts: small, medium, large)

If the user asks you to change colors or text size, use these tools to help them. For example, if they ask for a blue background, call the changeBackgroundColor function with the appropriate color.

Keep your responses concise and engaging.
`;

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
