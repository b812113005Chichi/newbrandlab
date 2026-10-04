# my-brand-generator 部署說明

## 結構
```
my-brand-generator/
├── public/index.html   ← 前端網站（已改為呼叫 /api/generate，不再使用 claude.ai 專屬功能）
├── api/generate.js     ← 後端：在伺服器端呼叫 Anthropic API，金鑰不會外洩給瀏覽器
├── package.json
└── .env.example
```

## 部署到 Vercel

1. 把這個資料夾推到一個 GitHub repo（或直接用 `vercel` CLI 從本機部署）。
2. 到 https://vercel.com → Add New → Project，選這個 repo。
3. Framework Preset 選 **Other**（不需要 build command，不需要 output directory，Vercel 會自動把 `public/` 當靜態站、`api/` 當 Serverless Functions）。
4. 部署前先到專案的 **Settings → Environment Variables** 新增：
   - `ANTHROPIC_API_KEY` = 你的 Anthropic API 金鑰（sk-ant-開頭）
   - （選填）`ANTHROPIC_MODEL`，預設是 `claude-sonnet-5`
5. 按 Deploy。完成後打開網址即可公開使用。

## 和 claude.ai 版本的差異

claude.ai 裡的版本用 `claude.use('sample')` 和 `claude.use('downloads')` 這兩個只存在於 Artifact 預覽環境的能力。部署到一般網站後這兩個都不存在，所以做了對應調整：

- **AI 生成**：原本直接在瀏覽器呼叫 Claude；現在瀏覽器把表單資料送到你自己的 `/api/generate`，由後端組出完全相同的 prompt 再呼叫 Anthropic API，回傳一樣格式的 JSON，前端渲染邏輯完全沒變。
- **下載分享圖**：原本用 Artifact 的下載能力；現在改成瀏覽器原生下載（產生圖檔後用隱藏連結觸發下載），使用者體驗相同。
- 其他所有畫面、排版、特質摘要、商品圖示、相似品牌、創業資源邏輯等**完全沒有更動**。

## 重要提醒：金鑰與費用

這個網站公開後，任何人都可以打開頁面按「生成」，而每次生成都會呼叫你的 Anthropic API 金鑰並產生費用。建議至少做以下其中一項，避免被濫用：

- 到 Anthropic Console 幫這支金鑰設定每月用量上限（Usage limits）。
- 在 `api/generate.js` 加上簡單的頻率限制（例如依 IP 限制每分鐘呼叫次數），或加一組只有你知道的驗證碼欄位。
- 若只是活動限定使用，活動結束後記得到 Vercel 移除或重新產生金鑰。

`api/generate.js` 目前已經做了基本的欄位驗證（種類 1–6 項、代表色 1–3 色且需為 `#rrggbb` 格式、文字長度上限等），但沒有做呼叫頻率限制，請視需要自行加強。
