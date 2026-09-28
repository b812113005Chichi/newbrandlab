import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.7-flash';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'server not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) {
    return res.status(400).json({ error: 'bad prompt' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: '你只回傳一個 JSON 物件，不要 markdown 程式碼框，不要任何說明文字。',
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    });

    const text = response.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'no json' });

    let data;
    try { data = JSON.parse(match[0]); } catch { return res.status(502).json({ error: 'invalid json' }); }
    return res.status(200).json(data);
  } catch (err) {
    const status = err && (err.status || err.code);
    if (status === 429) return res.status(429).json({ error: 'rate limited' });
    console.error('Gemini error:', err && err.message);
    return res.status(502).json({ error: 'upstream error' });
  }
}

