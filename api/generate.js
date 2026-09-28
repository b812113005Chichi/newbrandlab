import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 後端未設定 GEMINI_API_KEY 環境變數' });
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // 完美接收 BRANDLAB 前端傳來的 7 大煉金參數
  const { 
    brandName, brandType, representativeColors, 
    productsOrServices, brandDescription, brandTraits, targetAudience 
  } = req.body; 

  const textPrompt = `你是一位國際頂級品牌視覺總監。請根據以下「AI品牌煉金術」參數，提煉出極具未來感與質感的品牌企劃主頁內容，並提供精選資源。
  【品牌煉金參數】
  - 品牌名稱：\${brandName || '（請由 AI 根據風格命名一個極具質感的名稱）'}
  - 品牌種類：\${brandType || '未指定'}
  - 代表色系：\${representativeColors || '未指定'}
  - 商品或服務：\${productsOrServices || '未指定'}
  - 品牌宗旨與敘述：\${brandDescription || '未指定'}
  - 品牌核心特質：\${brandTraits || '未指定'}
  - 目標客群：\${targetAudience || '未指定'}
  
  請嚴格使用以下格式回傳標準的 JSON 數據，不要包含任何 markdown 標籤（如 \`\`\`json）：
  {
    "finalBrandName": "最終品牌名稱",
    "styleAnalysis": "針對此品牌特質與色彩的深度美學風格分析文字（約120字，語氣需高奢且有儀式感）",
    "resourceLinks": [
      {"name": "Google Fonts (字體資源)", "url": "https://google.com"},
      {"name": "Adobe Color (配色延伸)", "url": "https://adobe.com"},
      {"name": "Unsplash (質感意境素材)", "url": "https://unsplash.com"}
    ]
  }`;

  const imagePrompt = `A premium luxury commercial branding hero image, minimal aesthetic, professional website banner background, reflecting a brand for \${brandType}. Concept: \${brandDescription}, featuring characteristics of \${brandTraits}. Visual palette must strictly complement the colors: \${representativeColors}. 8k resolution, cinematic lighting, photorealistic, no text overlay.`;

  let aiTextOutput = null;
  let imageUrl = null;

  // 階段一：文字生成 (3.7 Flash ＋ 1.5 備援機制)
  try {
    const response = await ai.models.generateContent({ model: 'gemini-3.7-flash', contents: textPrompt });
    let cleanText = response.text.trim().replace(/^```json/, '').replace(/```\$/, '');
    aiTextOutput = JSON.parse(cleanText.trim());
  } catch (error) {
    console.warn('Gemini 3.7 擁擠，啟動防塞車備援線路...');
    try {
      const fallbackResponse = await ai.models.generateContent({ model: 'gemini-1.5-flash', contents: textPrompt });
      let cleanText = fallbackResponse.text.trim().replace(/^```json/, '').replace(/```\$/, '');
      aiTextOutput = JSON.parse(cleanText.trim());
    } catch (fallbackError) {
      return res.status(503).json({ error: '煉金術核心目前能量極不穩定，請稍候再試。' });
    }
  }

  // 階段二：圖片生成 (Imagen 3 ＋ 備援機制)
  try {
    const imageResponse = await ai.models.generateImages({
      model: 'imagen-3', prompt: imagePrompt,
      config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '16:9' }
    });
    imageUrl = `data:image/png;base64,\${imageResponse.generatedImages.image.imageBytes}`;
  } catch (imageError) {
    console.warn('主要圖片模型擁擠，換用備援圖片模型...');
    try {
      const fallbackImg = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002', prompt: imagePrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '16:9' }
      });
      imageUrl = `data:image/png;base64,\${fallbackImg.generatedImages.image.imageBytes}`;
    } catch (fallbackImageError) {
      imageUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://w3.org" width="800" height="450" viewBox="0 0 800 450"><rect width="100%" height="100%" fill="%2314142e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="%232be4ff">圖片具象化較慢，請重新點擊生成</text></svg>';
    }
  }

  return res.status(200).json({ data: aiTextOutput, imageUrl: imageUrl });
}

