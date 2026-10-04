// api/generate.js
// Vercel Serverless Function：在後端呼叫 Anthropic API，金鑰只存在伺服器端環境變數中，
// 前端永遠看不到 ANTHROPIC_API_KEY。
//
// 部署前請到 Vercel 專案的 Settings → Environment Variables 新增：
//   ANTHROPIC_API_KEY = sk-ant-xxxxxxxx
// 選填：
//   ANTHROPIC_MODEL   = claude-sonnet-5   (預設值，可換成你想用的型號字串)

const TEXTURE_KEYS = [
  "paper","wall","concrete","grain","marble","wood",
  "mist","watercolor","sea","ripple",
  "tech","blueprint","circuit",
  "stars","galaxy",
  "linen","weave","rain",
  "halftone","sand","pinstripe"
];

const GEO_KEYS = [
  "circles","lines","dots","triangles","hexagons","arcs","chevrons","squares",
  "diamonds","waves","crosses","bars","frame","zigzag","orbit","halfcircles",
  "stripes","rings","mosaic","isocubes","spiral","gridsq"
];

// 與前端 index.html 內的 RES 物件完全一致，才能讓 AI 回傳的代碼對得上前端的連結與名稱。
const RES = {
  s: {
    huzu:  ["科研新創資源平台", "https://huzu.stpi.niar.org.tw/startup.resources/detail/key/aaa", "國科會科技新創資源"],
    sme:   ["新創圓夢網 創業資源專區", "https://startup.sme.gov.tw/home/modules/infopack/detail/?sId=103", "學生與青年創業資源"],
    ieec:  ["北醫創新創業教育中心 IEEC", "https://ieec.tmu.edu.tw/", "校內創業教育、活動與輔導"],
    pm:    ["教育部精準健康產業跨領域人才培育計畫", "https://proj.moe.edu.tw/moe-tpph/", "僅限醫療、生醫、精準健康相關"]
  },
  d: {
    taipei: ["台北市新創處 Startup Taipei", "https://www.startup.taipei/", "臺北新創生態系與輔導"],
    yf:     ["臺灣創業生態系基礎服務整合平臺計畫", "https://youthfirst.yda.gov.tw/index.php/subject/content/74", "創業諮詢與新創基地"],
    sbir:   ["地方型SBIR", "https://sbir.org.tw/project/introLocal", "地方中小企業創新研發補助"],
    ustart: ["U-start創新創業計畫", "https://ustart.yda.gov.tw/", "青年與大專生創業"],
    find:   ["FINDIT", "https://findit.sme.gov.tw/tw", "新創資訊與資源整合"],
    ndc:    ["國發會新創相關資源", "https://www.ndc.gov.tw/Content_List.aspx?n=507E36AEE1AA9945", "政策面新創資源"],
    tta:    ["台灣新創競技場 Taiwan Tech Arena", "https://www.taiwanarena.tech/", "科技新創加速與國際鏈結"],
    smea:   ["經濟部中小及新創企業署", "https://www.sme.gov.tw/masterpage-tw", "中小與新創企業輔導補助"],
    sel:    ["中小企業網路大學校", "https://smelearning.sme.gov.tw/", "線上創業與經營課程"],
    si:     ["社會創新平台", "https://startup.sme.gov.tw/sitaiwan/", "社會創新與社會影響類"]
  },
  f: {
    pioneer: ["Pioneer", "https://pioneer.app/", "線上早期新創社群與獎金"],
    thiel:   ["Thiel Fellowship", "https://thielfellowship.org/", "年輕創業者獎助（22歲以下）"],
    c500:    ["500 Global", "https://500.co/", "早期投資與加速器"],
    tech:    ["Techstars", "https://www.techstars.com/", "加速器與導師網絡"],
    hult:    ["Hult Prize", "https://www.hultprize.org/", "大學生社會影響創業競賽"],
    ms:      ["Microsoft for Startups", "https://www.microsoft.com/en-us/startups", "雲端與AI資源"],
    g:       ["Google for Startups", "https://startup.google.com/", "技術與導師資源"],
    aws:     ["AWS Startups", "https://aws.amazon.com/tw/startups/", "雲端資源與方案"],
    yc:      ["Y Combinator", "https://www.ycombinator.com/", "頂尖加速器"],
    fi:      ["Founder Institute", "https://fi.co/", "創業者培訓與孵化"]
  }
};

const list = t => Object.entries(RES[t]).map(([k, v]) => `${k}(${v[0]}，${v[2]})`).join("、");

// 與前端一致的簡單驗證，避免完全不合法的資料被送進 prompt
function validate(P) {
  if (!P || typeof P !== "object") return "缺少品牌資料";
  if (!Array.isArray(P.種類) || !P.種類.length || P.種類.length > 6) return "種類需為 1-6 項";
  if (!Array.isArray(P.代表色) || !P.代表色.length || P.代表色.length > 3) return "代表色需為 1-3 色";
  if (!P.代表色.every(c => /^#[0-9a-fA-F]{6}$/.test(c))) return "代表色格式錯誤";
  if (!Array.isArray(P.商品服務) || !P.商品服務.length) return "商品或服務至少 1 項";
  if (!P.宗旨 || !String(P.宗旨).trim()) return "缺少宗旨／品牌敘述";
  if (!Array.isArray(P.特質) || !P.特質.length || P.特質.length > 10) return "特質需為 1-10 項";
  if (!Array.isArray(P.客群) || !P.客群.length) return "客群至少 1 項";
  // 粗略限制長度，避免被用來塞超長文字浪費 token
  const tooLong = [P.宗旨, ...P.商品服務, ...P.特質, ...P.客群].some(s => String(s).length > 200);
  if (tooLong) return "輸入內容過長";
  return null;
}

function buildPrompt(P) {
  return `你是品牌策略師與設計師。依下列新創品牌資料，只回傳 JSON（無 markdown）。
資料：${JSON.stringify(P)}（客群僅供你設計品牌風格與文案時參考，不要在頁面中列出客群）
JSON 欄位：
name: 品牌名稱（已提供則原樣使用，否則創造貼切好記的名稱）
summary: 融合宗旨、特質、種類，濃縮成一句話（兩行內，約30字以內），不要複述原文
tags: 融合特質與種類，摘要成至多 6 個簡短小標（每個 2-6 字）
font: "serif"|"sans"|"tech" 依品牌風格擇一
layout: "split"|"center"|"poster" 依品牌風格擇一
texture: 主頁上方有色區段的背景質感，從 none 或以下擇一：${TEXTURE_KEYS.join("|")}。依品牌風格挑最貼切的，只在能維持設計質感平衡時使用，不適合就 none，避免總是選同一種
geo: 幾何裝飾，從 none 或以下擇一：${GEO_KEYS.join("|")}。同樣依風格挑最貼切的，只在合適時使用，不適合就 none，避免總是選同一種
logo: 一個簡潔、有辨識度、不雜亂的原創 SVG 字串（viewBox="0 0 100 100"，無文字或僅品牌名首字，不含script/外部資源）。只可使用代表色 ${P.代表色.join(",")}、黑白、及與代表色極相近的色號
products: [{t,e}] 將商品服務文字 t 原封不動全部列出，性質相近者排在相鄰位置；e 為最貼切該項目的單一 emoji
similar: 1-3 個與此品牌整體性質（商品、服務、宗旨）最相似的真實存在品牌，[{name,url,why}]，url 必須是你確定存在的官方網站首頁，不確定就不要列
student: 最適合的 0-3 個學生創業資源代碼，僅能從以下選：${list("s")}
domestic: 最適合的 0-3 個國內資源代碼，僅能從以下選：${list("d")}
foreign: 最適合的 0-3 個國外資源代碼，僅能從以下選：${list("f")}
沒有適配的資源就給空陣列。`;
}

function extractJson(text) {
  const cleaned = String(text).trim().replace(/^```json\s*|^```\s*|```\s*$/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("模型未回傳 JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "伺服器尚未設定 ANTHROPIC_API_KEY" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const P = body && body.P;
  const err = validate(P);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }

  const prompt = buildPrompt(P);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: `Anthropic API 錯誤：${r.status} ${t}` });
      return;
    }

    const data = await r.json();
    const text = (data.content || []).map(b => b.text || "").join("\n");
    const json = extractJson(text);
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message || "generation failed" });
  }
};
