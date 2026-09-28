import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // 1. 安全檢查與金鑰驗證
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 後端未設定 GEMINI_API_KEY 環境變數' });
  }

  // 初始化 Google AI SDK
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // 接收前端 index.html 傳過來的品牌參數
  // 💡 請確保這裡的欄位名稱 (brandDescription, colorPalette) 與你 index.html 傳過來的一致
  const { brandDescription, colorPalette } = req.body; 

  // 建立提示詞 (無額外雜質，純粹針對你的需求)
  const textPrompt = `你是一位頂級品牌設計師。根據以下品牌描述和色系，統整出符合風格的質感品牌企劃，並提供適合的設計資源連結（如字體、色碼表等）。
  品牌描述：\${brandDescription || '未提供'}
  指定色系：\${colorPalette || '未提供'}
  
  請嚴格使用以下 JSON 格式回傳，不要包含任何 markdown 標籤（如 \`\`\`json）：
  {
    "styleAnalysis": "風格分析文字",
    "suggestedFonts": ["字體1", "字體2"],
    "resourceLinks": [{"name": "資源名稱", "url": "網址"}]
  }`;

  const imagePrompt = `A premium, high-end professional brand hero image background, minimal aesthetic, suitable for website banner, lifestyle branding photograph, matching the description: ${brandDescription}, incorporating the colors: ${colorPalette}, 8k resolution, cinematic lighting.`;

  let aiTextOutput = null;
  let imageUrl = null;

  // ========================================================
  // 階段一：生成品牌企劃文字 (Gemini 3.7 Flash ＋ 1.5 備援)
  // ========================================================
  try {
    console.log('嘗試使用第一優先模型: gemini-3.7-flash');
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: textPrompt,
    });
    aiTextOutput = JSON.parse(response.text.trim());
  } catch (error) {
    console.warn('Gemini 3.7 Flash 塞車或發生錯誤，啟動防塞車備援機制...', error.message);
    try {
      console.log('正在切換至備援模型: gemini-1.5-flash');
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash', // 1.5 Flash 穩定度極高，免費層不易塞車
        contents: textPrompt,
      });
      aiTextOutput = JSON.parse(fallbackResponse.text.trim());
    } catch (fallbackError) {
      return res.status(503).json({ error: 'AI 文字生成模型目前全面過載，請稍後再試。' });
    }
  }

  // ========================================================
  // 階段二：生成質感品牌圖 (Imagen 3 ＋ 備援)
  // ========================================================
  try {
    console.log('嘗試使用主要圖片模型生成主頁圖...');
    const imageResponse = await ai.models.generateImages({
      model: 'imagen-3',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '16:9',
      },
    });
    const imageBase64 = imageResponse.generatedImages.image.imageBytes;
    imageUrl = `data:image/png;base64,${imageBase64}`;
  } catch (imageError) {
    console.warn('主要圖片模型擁擠，嘗試使用備援圖片模型...', imageError.message);
    try {
      const fallbackImageResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002', // 備用高速圖片模型
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '16:9',
        },
      });
      const imageBase64 = fallbackImageResponse.generatedImages.image.imageBytes;
      imageUrl = `data:image/png;base64,${imageBase64}`;
    } catch (fallbackImageError) {
      // 如果連圖片備援都失敗，提供一張質感的預設灰色漸層預覽圖，不讓網站整個死掉
      imageUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="800" height="450" viewBox="0 0 800 450"><rect width="100%" height="100%" fill="%23E2E8F0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%2394A3B8">圖片生成稍候片刻，請重新點擊生成</text></svg>';
    }
  }

  // 5. 成功整合兩者，回傳給前端 index.html
  return res.status(200).json({
    data: aiTextOutput,
    imageUrl: imageUrl
  });
}

