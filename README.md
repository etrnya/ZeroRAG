<div align="center">

# ⚡ ZeroRAG

**無伺服器知識應用編譯器 (Knowledge → Evidence → Application Compiler)**

*在瀏覽器中將法規、SOP 與專業文件消化提煉，一鍵編譯為具備事實證據鏈的微型獨立應用*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First%20%7C%20Zero--Backend-38bdf8.svg)](ARCHITECTURE.md)
[![Vector: gemini--embedding--2](https://img.shields.io/badge/Vector-gemini--embedding--2%20(768d)-a855f7.svg)](ADR/ADR-0001-gemini-embedding-2-and-binary-store.md)
[![Benchmark: P95 < 3ms](https://img.shields.io/badge/Latency-P95%20%3D%202.88ms-10b981.svg)](SPIKES/spike-b/RESULT.md)
[![Bundle: 10.8MB < 15MB](https://img.shields.io/badge/Bundle-10.85MB%20%E2%89%A4%2015MB-success.svg)](ADR/ADR-0004-standalone-bundle-format.md)
[![Tests: 17 Passed](https://img.shields.io/badge/Tests-17%20Passed-10b981.svg)](#-自動化測試與品質驗收)

[✨ 線上展示 (GitHub Pages)](#-快速開始-quick-start) •
[📖 術語字典](GLOSSARY.md) •
[🏛️ 架構規格](ARCHITECTURE.md) •
[🛡️ 資安不變性](SECURITY.md) •
[🧪 技術驗證報告](ZERO-RAG-TECHNICAL-SPIKE.md)

</div>

---

## 💡 為什麼需要 ZeroRAG？(The Mission)

傳統的 RAG (檢索增強生成) 大多停留於「讓使用者跟文件自由聊天」的玩具階段，面臨三大致命痛點：
1. **維運昂貴**：需要持續支付向量資料庫 (Pinecone/Milvus) 與後端伺服器的月租費。
2. **幻覺與擴張解釋**：即使引用了正確段落，AI 也常「推論過度」（例如：原文「檢驗結果保存五年」，AI 擴張為「所有行政公文均應保存五年」）。
3. **無法跨裝置獨立交付**：知識無法像 PDF 或 Word 一樣打包成獨立檔案發給主管、客戶或學員使用。

**ZeroRAG 的全新解法**：
> **ZeroRAG 是一套運作於瀏覽器端的「無伺服器知識應用編譯器」**。  
> 它的任務不是單純對話，而是將原始文件（法規、SOP、檢定題庫、合約規範書）在前端本機解析後，**直接編譯為具備單一事實主張映射 (Claim-Evidence Mapping) 的輕量、可獨立發布之單檔案微應用 (Portable HTML)**。

---

## 🌟 核心工程亮點 (Key Highlights)

### 1. 💰 $0 基礎設施維護成本 ($0 Infrastructure Cost)
- **Zero Developer Server**：零自建後端伺服器、零自建託管向量資料庫，直接透過 GitHub Pages 免費靜態託管。
- **透明 BYOK (Bring Your Own Key)**：使用者透過自備 Google Gemini API Key 調用，免費層享有每日官方額度，商業付費層直接對齊 Google Cloud 定價，開發者不經手帳單。

### 2. ⚖️ Claim-Evidence Mapping（防範 AI 擴張解釋）
- 摒棄文末粗糙附上來源的作法，將查核結論拆解為單一具體事實主張 (`ClaimVerification`)。
- **字對字引述校驗**：若 LLM 引用字句未在原文精確匹配，系統即時亮起警示。
- **適用範圍警示 (`scope_warning`)**：強制審計模型標記情境邊界（例如：「原文僅適用於檢驗紀錄，不涵蓋行政公文」），徹底杜絕擴張解釋。

### 3. ⚡ 8.79 MiB 純二進位向量庫與極速檢索 (V8 Optimized)
- 徹底廢除肥大的 JSON 陣列，改採連續二進位緩衝區 (`embeddings.bin`)，3,000 分塊僅需 **8.79 MiB**。
- 採用 V8 JIT 展開 (Loop-unrolled by 4) 之純記憶體點積 Top-K 檢索，**實測 P95 延遲僅 2.88 ms**（優於預期目標 10 倍！），吞吐量高達 416+ QPS。

### 4. 📦 10.85 MB 單檔案發布標準 (Portable HTML ≤ 15MB)
- 依據 **ADR-0004 C2 方案**：向量二進位資料先經 Gzip (Level 9) 壓縮後再以 Base64 內嵌，前端利用原生 `DecompressionStream('gzip')` 在 **36.5 ms** 內完成秒級解壓縮。
- 徹底拔除 Runtime 端的解析庫，確保 3,000 分塊知識應用體積穩健控制在 **10.85 MB**（具備 4.15 MB 安全餘量）。

### 5. 🛡️ 八大資安不變性守則 (S1 ~ S8)
嚴格落實**「憑證不入聊天紀錄、不入程式碼、不入 Git、不入匯出檔案」**之鐵律，架構與打包器輸入端完全隔離金鑰，預設採用「Session-Only 分頁關閉即焚」模式。

---

## 🏛️ 系統架構圖 (Architecture Blueprint)

```text
       【原始文件知識】                     【核心處理中樞】                      【專業可行動產出】
      Knowledge Source                   ZeroRAG Engine                      Actionable Apps
   ┌────────────────────┐             ┌───────────────────┐             ┌─────────────────────┐
   │ • Markdown / TXT   │             │ Chunking Pipeline │             │  Audit Dashboard    │
   │ • 剪貼簿文字貼入   │ ──(切塊)──> │ gemini-embed-2    │ ──(編譯)──> │  (MVP: 查核儀表板)  │
   │ • 法規條號自動識別 │             │ In-Browser Vector │             ├─────────────────────┤
   └────────────────────┘             │ Claim-Evidence    │             │  Portable HTML      │
                                      └─────────┬─────────┘             │  (單檔 10.8MB 發布) │
                                                │                       └─────────────────────┘
                                                ▼
                                    【二進位知識封裝包】
                                  .ragpack (ZIP + SHA-256)
```

---

## 🚀 快速開始 (Quick Start)

### 方法 A：線上直接體驗 (GitHub Pages)
直接造訪本專案之線上 GitHub Pages：
👉 **https://etrnya.github.io/ZeroRAG/**

### 方法 B：本機執行 (30 秒啟動)

```bash
# 1. 複製儲存庫
git clone https://github.com/etrnya/ZeroRAG.git
cd ZeroRAG

# 2. 啟動本機 HTTP 伺服器
npm start
# 或直接執行: python -m http.server 8765

# 3. 在瀏覽器開啟 Studio 工作台
# http://localhost:8765/src/ui/index.html
```

---

## 🖥️ 操作工作流程 (Workflow)

1. **點擊「📋 載入採購法範例」**：載入《政府採購法》與食品實驗室 SOP 規章文字。
2. **點擊「✂️ 執行切塊」**：系統即時完成滑動視窗切塊，精確識別條號章節與段落。
3. **選擇向量化模式**：
   - **實機模式**：配置您的 Google Gemini API Key (BYOK)，直連 Google 端點取得 768 維高品質向量。
   - **🧪 模擬模式**：點擊「模擬合成向量」，**0 API 費用 / 0 Token 消耗** 秒級體驗檢索與查核全流程！
4. **執行事實查核 (Audit Dashboard)**：
   - 輸入問題：「機關招標時，得否在規格書中指定特定廠牌型號？」
   - 點擊「⚖️ 執行事實查核」，即刻產出包含 **Claim 主張、狀態判斷、適用範圍警示與出處引句** 的專業查核報告。
5. **點擊「📦 匯出 Portable HTML」**：一鍵下載單一 `.html` 檔案，離線發布或交由協作者使用。

---

## 🧪 自動化測試與品質驗收

本專案配置有嚴格的自動化靜態斷言門禁 (Automated Assertion Gate)：

```bash
npm test
```

測試覆蓋 17 項核心斷言：
- [x] SHA-256 原生雜湊計算
- [x] 法規條文結構自動識別（第 26 條、第 50 條精準切分）
- [x] 二進位 `embeddings.bin` 64-byte Header 與零拷貝檢視還原
- [x] V8 點積 Top-K 檢索精度與降序排列
- [x] ClaimVerification Prompt 結構化與反擴張指示驗證
- [x] 字對字引述不符時之 `scope_warning` 自動警示機制
- [x] S1 資安不變性：導出產物 100% 零 API Key 洩漏檢查

---

## 📁 專案目錄結構

```text
ZeroRAG/
├── .github/workflows/deploy.yml   <-- GitHub Actions 自動化部署 CI/CD
├── ADR/                           <-- 架構決策紀錄 (ADR-0001 ~ 0005)
├── SPIKES/                        <-- Phase 0.5 技術驗證套件與實測數據
│   ├── spike-b/                   <-- IndexedDB 儲存與點積壓測 (P95=2.88ms)
│   ├── spike-c/                   <-- Portable HTML 體積測試 (C2=10.85MB)
│   ├── spike-d/                   <-- file:// 相容性矩陣
│   └── spike-e/                   <-- BYOK 直連與條款核實
├── src/
│   ├── core/                      <-- 領域核心層 (切塊、向量庫、Claim 映射)
│   ├── infra/                     <-- 基礎設施層 (GeminiClient, IndexedDB)
│   ├── ui/                        <-- 表現層 (ZeroRAG Studio Web 工作台)
│   └── test_core.js               <-- 17 項自動化單元測試套件
├── ARCHITECTURE.md                <-- 系統架構規格書
├── GLOSSARY.md                    <-- 全域術語字典 (Dictionary First)
├── PRD.md                         <-- 產品需求規劃規格書 (v1.1.1)
├── SECURITY.md                    <-- 資安防禦與不變性守則手冊
├── package.json                   <-- 專案元數據與 npm 指令
└── LICENSE                        <-- MIT 開源授權條款
```

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 開源授權，歡迎自由研究、教學、二次開發與商業應用。  
由 **彥廷 (etrnya)** 於 2026 年精心打造。
