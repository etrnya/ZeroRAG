# 🚀 ZeroRAG 產品需求規劃規格書 (Product Requirements Document) v1.1.1

> **專案代號**：ZeroRAG (Knowledge → Evidence → Application Compiler)  
> **當前版本**：v1.1.1 (Approved Architecture Spec)  
> **更新日期**：2026-11-02  
> **文件基準**：整合 PRD v1.1.0、PRD_v1.1.1_ERRATA.md (E1~E21) 與 Spike E 官方核實成果  
> **核心哲學**：**Local-First**（本機優先）× **Evidence-First**（證據鏈優先）× **Generator-First**（成果導向）  
> **術語與實體標準**：嚴格遵循 [GLOSSARY.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/GLOSSARY.md)

---

## 1. 產品核心定位與問題定義 (Executive Summary & Mission)

### 1.1 從「RAG 對話玩具」到「知識應用編譯器」
傳統 RAG 產品大多停留於「讓使用者跟文件對話」的聊天介面，不僅 Token 消耗昂貴、難以離線，更存在幻覺與無法追溯出處的痛點。

**ZeroRAG 的全新定位**：
> **「一套運作於瀏覽器端的無伺服器知識應用編譯器 (Knowledge → Evidence → Application Compiler)」**  
> 它的核心使命是：將原始文字/文件（法規、SOP、檢定題庫、合約規範書）在瀏覽器本機解析與結構化提煉後，**直接編譯為具備完整事實證據鏈 (Evidence Chain) 的輕量、可獨立發布之微型 Web 應用**。

```text
       【原始文件知識】                     【核心處理中樞】                      【專業可行動產出】
      Knowledge Source                   ZeroRAG Engine                      Actionable Apps
   ┌────────────────────┐             ┌───────────────────┐             ┌─────────────────────┐
   │ • PDF (pdf.js)     │             │ Ingest & Chunking │             │  Audit Dashboard    │
   │ • Word (mammoth)   │ ──(提取)──> │ gemini-embed-2    │ ──(編譯)──> │  (MVP: 查核儀表板)  │
   │ • Markdown / TXT   │             │ In-Browser Vector │             ├─────────────────────┤
   └────────────────────┘             │ Evidence Assembly │             │  Quiz & Flashcards  │
                                      └─────────┬─────────┘             │  Web Slides / Mind  │
                                                │                       └─────────────────────┘
                                  ┌─────────────┴─────────────┐
                                  ▼                           ▼
                             【知識存檔包】               【發布應用】
                           .ragpack Package             Portable HTML
```

### 1.2 成本宣稱：$0 基礎設施維護成本 ($0 Infrastructure Cost)
- **非 $0 Total Cost**：零自建後端伺服器、零自建向量資料庫租用費、GitHub Pages 免費託管。
- **透明外部 API 計費**：使用者透過 BYOK (Bring Your Own Key) 自行使用 Gemini API。
  - 免費層級 (AI Studio Free)：享有 Google 官方每日免費請求配額。
  - 商業付費層級 (Pay-as-you-go)：使用者直接對齊 Google Cloud 官方扣款，開發者不經手、不代收亦不承擔連帶責任。

---

## 2. 資料傳輸四級模型與安全鐵律 (Data Egress & Security Invariants)

### 2.1 四級資料傳輸分類 (Data Egress Levels - E12 統一規格)
全系統統一定義四級資料傳輸架構：

| 等級 | 標籤 | 傳輸路徑與隱私政策 | 適合情境 |
| :---: | :---: | :--- | :--- |
| **L0** | ⚫ **本機全離線 (Zero Data Egress)** | 文件 ➔ 瀏覽器 ➔ 本機 WASM/WebGPU 向量模型 ➔ IndexedDB。**100% 資料不出本機**。*(Architecture Reserved，非 MVP 範圍)* | 極機密國防、醫療、核心營業秘密 |
| **L1** | 🟡 **Google AI Studio 免費層級** | 瀏覽器 ➔ 直連 Google API。**資料不用於開發者主機，但依 Google 條款可能用於改善產品**。 | 公開資料、考古題、非機密測試 |
| **L2** | 🟢 **Google AI Studio 付費層級 (BYOK)** | 瀏覽器 ➔ 直連 Google API。**資料不用於改善產品，但 Google 會為了濫用偵測短期記錄 prompt/response**。 | 商業專案、一般業務、工作流程 |
| **L3** | 🔵 **Vertex AI 企業合約** | 瀏覽器/代理 ➔ Google Cloud Vertex AI。依企業級資料處理協議 (DPA)，保證零資料留存與合規稽核。 | 嚴格企業資安、SOC2/HIPAA 管控場景 |

### 2.2 八大安全不變性規則 (Security Invariants S1 ~ S8)
1. **S1 (`NEVER_BUNDLE_KEY`)**：匯出的 HTML 檔案與 `.ragpack` 知識包**絕對嚴禁包含任何 API Key**。
2. **S2 (`NO_GIT_KEY`)**：專案原始碼、文件、測試腳本與 Git Commit 絕對禁止硬編碼任何真實 API Key。
3. **S3 (`ZERO_DEVELOPER_STORAGE`)**：嚴禁將使用者的文件、向量或私人資料上傳至任何開發者自建伺服器。
4. **S4 (`LOCAL_FIRST_STORAGE`)**：所有工作區中繼資料、切塊文字與向量快取預設只留存在瀏覽器 `IndexedDB`。
5. **S5 (`EXPORT_PRIVACY_GATE`)**：匯出公開網頁或知識包前，UI 必須強制跳出資料隱私確認，預設**不打包原始文件**。
6. **S6 (`VISIBLE_EGRESS`)**：前端狀態列必須清晰標示當前對外 Google API 的請求狀態、模型名稱與 Token 傳輸量。
7. **S7 (`TERMS_ACKNOWLEDGEMENT`)**：首次輸入金鑰時，使用者必須明確知悉免費版與付費版之資料處理條款邊界。
8. **S8 (`OUTPUT_SANITIZATION`)**：所有由 LLM 生成之內容與渲染片段，必須經過 DOMPurify 無害化處理，杜絕 XSS。

---

## 3. 領域核心模型與二進位向量架構 (Domain & Vector Engine)

### 3.1 向量提供者與 Prompt 前綴規格 (`EmbeddingConfig`)
- 採用 **`gemini-embedding-2`**（支援原生多模態與 128~3072 維度，本系統預設採 768 維）。
- **關鍵規範 (Spike E 核實)**：`gemini-embedding-2` **不支援 `task_type` 欄位**，必須採用官方 Prompt Prefix 指令語法：
  - 檢索查詢：`task: question answering | query: {query_text}`
  - 文件切塊：`title: {title} | text: {chunk_text}`（無標題時標註 `title: none`）
- **關鍵規範 (防多段聚合)**：禁止在單一 `embedContent` 中傳入多段文字（會被自動融合成單一向量而失真），批次處理必須使用 `batchEmbedContents` 或獨立分塊請求。

```typescript
interface EmbeddingConfig {
  provider: "google" | "local_wasm";
  model: string;                         // "gemini-embedding-2"
  dimensions: number;                    // 預設 768 (可選 1536 / 3072)
  task_format: "gemini-embedding-2-prefix";
  normalization: "l2";                   // Google API 已自動做 L2 正規化，餘弦可簡化為點積
  distance_metric: "cosine";             // 餘弦相似度
  version: string;                       // "2026-10"
}
```

### 3.2 二進位向量儲存 (`BinaryEmbeddingStore`)
- 捨棄肥大且容易阻塞 UI 的 JSON 格式（3,000 筆 × 768 維之 JSON 高達 25~35MB）。
- 改採平坦化連續二進位資料結構 (`embeddings.bin`)，3,000 分塊僅需 **8.79 MiB**：

```typescript
interface BinaryEmbeddingStore {
  dimensions: number;                    // 768
  count: number;                         // 分塊筆數
  model_id: string;                      // "gemini-embedding-2"
  data: Float32Array;                    // 一維平坦化連續二進位緩衝區
}
```

### 3.3 來源定位 (`SourceLocation`) 與 證據物件 (`Evidence`)
全系統輸出遵循「事實陳述必須可追溯」原則（E6 規範）：
```typescript
interface SourceLocation {
  source_id: string;                     // 檔案 SHA-256 雜湊
  source_name: string;                   // 檔案名稱
  page_index?: number;                   // 0-based PDF 實體頁碼
  printed_page_number?: string;          // 文件印刷頁碼 (例如 "第 18 條", "附錄 A")
  section?: string;                      // 章節標題
  paragraph_index?: number;              // 段落序號
}

interface Evidence {
  chunk_id: string;
  location: SourceLocation;
  quote: string;                         // 精確出處引言原文
  relevance_score: number;               // 檢索相關度分數 (0.00 ~ 1.00)
  retrieval_method: "vector" | "keyword" | "hybrid";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  generated_at: string;                  // ISO 時間戳
}
```

---

## 4. 檢索管線與參數規範 (Retrieval Pipeline - E3 & E4 修正)

```text
  User Query (使用者提問)
      │
      ▼
┌──────────────┐      ┌─────────────────────────┐
│ Query Embed  │ ───> │ Candidate Retrieval     │ (純 JS / Worker 向量點積計算)
└──────────────┘      └────────────┬────────────┘
                                   │ 依分數排序取出 candidateK (預設 30 筆)
                                   ▼
                      ┌─────────────────────────┐
                      │ Score Filter (門檻過濾) │ (依 minScore 篩選，預設選配保證 Top-K)
                      └────────────┬────────────┘
                                   │ 取出 topK 筆 (預設 3~5 筆)
                                   ▼
                      ┌─────────────────────────┐
                      │ Context Assembly        │ (組裝 Context，限制 max_tokens: 4000)
                      └────────────┬────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │ Gemini 2.5 Flash        │ (Prompt 嚴格強制綁定 Evidence)
                      └────────────┬────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │ Answer + Evidence Chain │ (結構化 Markdown + 標註卡片回傳)
                      └─────────────────────────┘
```

---

## 5. 知識包 (.ragpack) 規格與雙軌交付

### 5.1 `.ragpack` 知識包封裝規格 (E7 & E8 修正)
以標準 ZIP 格式封裝，支援跨裝置還原、匯出與共享：
```text
my-knowledge.ragpack (ZIP 格式)
├── manifest.json       <-- 專案名稱、UUID、版本、建立時間、EmbeddingConfig
├── metadata.json       <-- 文件清單、分塊統計、Token 總量
├── checksums.json      <-- 逐檔 SHA-256 完整性雜湊（防篡改，E7）
├── chunks.json         <-- 分塊內容與 SourceLocation 結構化文字
├── embeddings.bin      <-- 平坦化 Float32Array 連續二進位向量
└── documents/          <-- 原始文件備份（預設不勾選，防機密打包，E8）
```

### 5.2 成果交付雙軌規格
1. **便攜式發布應用 (Portable HTML)**：
   - 命名為 `[專案名]-rag.html`。
   - 適合託管於 GitHub Pages (`https://`)。
   - 內嵌結構化向量與知識資料，開啟時以 Session-Only 模式輸入 API Key 即可使用，總體積目標 ≤ 15MB（上限 20MB）。
2. **全離線封裝包 (Offline Bundle)**：
   - 命名為 `[專案名]-offline.html`。
   - 支援雙擊即開 (`file://`)，內建必要 UI 樣式與離線依賴。

---

## 6. DDD 分層架構對齊 (Layered Architecture - E10 修正)

嚴格遵守單向依賴，禁止表現層直接穿透儲存或外部 API：

```text
ZeroRAG
├── Domain (領域層 - 零外部依賴)
│   ├── Document: 文件與來源模型
│   ├── Chunk: 語意切塊模型
│   ├── Embedding: Provider 介面與模型參數
│   ├── Retrieval: 向量點積算子、候選排序與過濾器
│   ├── Evidence: 證據鏈實體與位置比對
│   └── Workspace: 工作區狀態生命週期
│
├── Application (應用層 - 協調用例與業務流程)
│   ├── IngestDocumentUseCase: 檔案讀取、切塊與雜湊生成
│   ├── BuildIndexUseCase: 批次呼叫向量化與二進位平坦化
│   ├── SearchKnowledgeUseCase: 查詢向量化、Top-K 檢索與分數篩選
│   ├── AnswerQueryUseCase: 提示詞組裝、呼叫生成與證據鏈綁定
│   ├── ExportRagpackUseCase: 打包 ZIP、計算 SHA-256 Checksums
│   └── GenerateAuditUseCase: 執行規範查核與生成報告儀表板
│
├── Infrastructure (基礎設施層 - 外部通訊與持久化)
│   ├── GeminiClient: REST API 直連、指數退避重試、防 429 級聯
│   ├── IndexedDBStorage: 瀏覽器資料庫配額與讀寫
│   ├── BinaryCodec: Float32Array 與 ArrayBuffer 序列化
│   └── ZipCodec: fflate/JSZip 封裝與解壓縮
│
└── Presentation (表現層 - UI 與微型應用生成器)
    ├── AppShell: 頂部導航、工作區切換、API Key 安全對話框
    ├── IngestWizard: 文件拖曳上傳、切塊預覽與向量化進度條
    ├── AuditDashboard: (MVP 核心) 品保/法規查核互動儀表板
    └── PortablePacker: 單一 HTML 導出精靈 (落實 S1 隔離)
```

---

## 7. 非功能性需求與驗收指標 (NFR Benchmark)

1. **向量檢索延遲目標 (PRD §7.1)**：
   - 基準環境：Chrome 154 / Windows 11 / x86-64。
   - 基準資料集：3,000 分塊 × 768 維度 Float32。
   - 延遲分位數：**P50 < 10ms、P95 < 30ms、P99 < 50ms**（待 Spike B 綠燈驗證）。
2. **冷啟動讀取**：IndexedDB 載入 3,000 分塊與向量至記憶體可搜尋狀態 < 1.0 秒。
3. **打包檔案體積**：3,000 分塊 Portable HTML 總體積 **目標 ≤ 15MB（上限 20MB）**。

---

## 8. 分階段開發路徑與 MVP 驗收 (Roadmap)

```text
Phase 0.5: Technical Spikes (技術假設驗證 Gate)
   │ ├── Spike E: BYOK 通訊與條款核實 (進行中)
   │ ├── Spike B: IndexedDB 存取與暴力 Cosine Top-K 壓測
   │ ├── Spike C: Portable HTML 體積與壓縮方案比較
   │ └── Spike D: file:// 協議跨瀏覽器相容性
   ▼
Phase 0: 專案骨架與 DDD 核心領域層 (Domain Core)
   ▼
Phase 1: 文件解析 (PDF/Word/MD) ➔ 智慧切塊 ➔ SourceLocation 建立
   ▼
Phase 2: gemini-embedding-2 ➔ 二進位向量化 ➔ IndexedDB 儲存 ➔ 檢索層
   ▼
Phase 3: RAG 檢索 ➔ Evidence 證據鏈組裝 ➔ 基礎問答驗證
   ▼
Phase 4: .ragpack 工作區匯入與匯出 (ZIP + SHA-256 Checksums)
   ▼
Phase 5: 核心成果產生器：Audit Dashboard (品保/法規查核儀表板) ➔ 【MVP 完工驗收點】
   ▼
Phase 6: Portable HTML 單檔案打包器 (落實 S1 憑證隔離)
```
