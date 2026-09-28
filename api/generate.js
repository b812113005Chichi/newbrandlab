import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // 1. 安全檢查
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 後端未設定 GEMINI_API_KEY' });
  }

  try {
    // 2. 正確初始化 GoogleGenAI
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // 接收來自 index.html 的參數（請確保欄位名稱與 index.html 對齊）
    const { userPrompt } = req.body; 

    // 3. 呼叫 Gemini 3.7 Flash (最新標準語法)
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash', 
      contents: userPrompt || '請幫我測試這段文字', // 防止前端傳空值
    });

    // 4. 回傳給前端
    return res.status(200).json({ text: response.text });

  } catch (error) {
    // 這裡會把錯誤記錄在 Vercel Logs 裡方便排查
    console.error('Gemini API 呼叫失敗，詳細原因:', error.message || error);
    return res.status(500).json({ error: `AI 呼叫失敗: ${error.message || error}` });
  }
}

