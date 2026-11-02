# 📖 ZeroRAG 專案術語字典 (Glossary) v1.1.1

本文件依據全域開發通則「字典先行 (Dictionary First)」原則建立，嚴格定義 ZeroRAG (Knowledge → Evidence → Application Compiler) 專案之核心術語、領域模型實體 (Domain Entities)、數值型別與變數命名規範。後續所有架構設計、程式碼與安全規範必須 100% 對齊本字典。

---

## 1. 核心定位與產品架構術語 (Core Architecture)

| 繁體中文術語 | 英文對照 (Term) | 代碼變數 / 識別碼 (Identifier) | 定義與語義解釋 |
| :--- | :--- | :--- | :--- |
| **知識應用編譯器** | Knowledge-to-App Compiler | `knowledge_app_compiler` | ZeroRAG 的核心產品定位：將原始文件知識編譯為具備證據鏈的可執行微型應用。 |
| **知識編譯工作室** | Studio Compiler | `studio_compiler` | 包含完整 Ingest（文字切塊）、向量化、知識包匯入匯出與應用編譯的完整線上工作室環境。 |
| **發布執行期閱覽器** | Runtime Viewer | `runtime_viewer` | 發布為獨立 Portable HTML 的唯讀檢索與查核應用。**徹底剔除解析庫 (Zero Parser)**，體積控制於 15MB 內。 |
| **無伺服器本機優先** | Local-First Zero-Backend | `local_first_zero_backend` | 資料與向量運算預設發生於瀏覽器端，零自建伺服器成本 ($0 Infrastructure Cost)。 |
| **資料傳輸四級模型** | Four-Level Data Egress | `data_egress_level` | 區分資料邊界的四級模型（L0: 全離線, L1: Google 免費, L2: Google 付費 BYOK, L3: Vertex AI 企業專約）。 |
| **自備金鑰憑證** | Bring Your Own Key (BYOK) | `byok_credential` | 使用者自備之 Google API 金鑰，嚴格落實 Session-Only 隔離，禁止打包進匯出產物。 |
| **知識封裝包** | Knowledge Package (.ragpack) | `ragpack_package` / `ragpack_file` | ZeroRAG 定義的一級知識交換格式，封裝 manifest、chunks.json、checksums.json 與 embeddings.bin。 |
| **便攜應用網頁** | Portable HTML Application | `portable_html_app` | 依賴 CDN 與網路 API、不含金鑰、可公開分享的單檔案應用產物（目標 ≤ 15MB）。 |
| **主張-證據映射** | Claim-Evidence Mapping | `claim_evidence_mapping` | 將 AI 回答拆解為獨立事實主張，並逐項綁定原文出處與適用範圍警示的核心檢核機制。 |

---

## 2. 領域模型與實體 (Domain Entities & Types)

### 2.1 來源出處定位 (`SourceLocation`)
提供精確雙軌出處定位：
```typescript
interface SourceLocation {
  source_id: string;               // 來源文件雜湊識別碼 (SHA-256)
  source_name: string;             // 來源檔案名稱 (如: "2026_procurement_law.md")
  page_index?: number;             // 0-based 實體檔案頁碼索引
  printed_page_number?: string;    // 文件內部印刷頁碼 (如: "第 37 頁", "條號: §26")
  section?: string;                // 章節標題或條號 (如: "第 26 條第 3 項")
  paragraph_index?: number;        // 段落流水號
}
```

### 2.2 文本分塊與嵌入配置 (`TextChunkItem` & `EmbeddingConfig`)
```typescript
interface EmbeddingConfig {
  provider: "google" | "local_wasm";
  model: string;                   // 預設 "gemini-embedding-2"
  dimensions: number;              // MVP 固定 768 維
  task_format: "gemini-embedding-2-prefix"; // 官方規範之 prompt prefix 語法
  normalization: "l2";             // 向量已自動正規化，餘弦等於點積
  distance_metric: "cosine";       // 餘弦相似度
  version: string;                 // "2026-10"
}

interface TextChunkItem {
  chunk_id: string;                // 唯一 UUID
  workspace_id: string;            // 所屬工作區 ID
  location: SourceLocation;        // 來源出處定位物件
  content: string;                 // 分塊原始文字
  token_count?: number;            // 預估 Token 數
}
```

### 2.3 二進位向量儲存體 (`BinaryEmbeddingStore`)
嚴格廢除肥大的 JSON `number[]` 陣列，改採高效能連續二進位結構：
```typescript
interface BinaryEmbeddingStore {
  dimensions: number;              // 768
  count: number;                   // 向量總數量
  model_id: string;                // "gemini-embedding-2"
  data: Float32Array;              // 一維平坦化之連續 Float32 二進位向量緩衝區
}
```

### 2.4 核心證據實體 (`Evidence`)
全系統第一級公民物件，拒絕無來源幻覺：
```typescript
interface Evidence {
  chunk_id: string;
  location: SourceLocation;
  quote: string;                   // 原文精確引用字句 (字對字引用)
  relevance_score: number;         // 關聯度評分 (0.00 ~ 1.00)
  retrieval_method: "vector" | "keyword" | "hybrid";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  generated_at: string;            // ISO 時間戳
}
```

### 2.5 核心事實主張檢驗模型 (`ClaimVerification`)
防範 AI 擴張解釋之關鍵實體：
```typescript
interface ClaimVerification {
  claim_id: string;                // 主張流水號
  claim_text: string;              // AI 提煉之單一具體陳述（如：「保存期限為五年」）
  verification_status: "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED"; // 證據支持狀態
  scope_warning?: string;          // 適用範圍警示（如：「原文僅適用於檢驗紀錄，不涵蓋行政公文」）
  primary_evidence: {
    chunk_id: string;
    exact_quote: string;           // 嚴格對齊原文之字句
    source_location: SourceLocation;
  };
}
```

### 2.6 檢索結果模型 (`RetrievalResult`)
```typescript
interface RetrievalResult {
  chunk_id: string;
  score: number;                   // 相似度分數
  rank: number;                    // 排序名次 (1-based)
  location: SourceLocation;
  content: string;
}
```

---

## 3. 安全防護與不變性約束 (Security Invariants)

| 代號 | 安全不變性規則 (Security Invariant) | 違規防禦機制 |
| :--- | :--- | :--- |
| **S1** | **API Key 絕不進入匯出檔案** (`NEVER_BUNDLE_KEY`) | 打包引擎在序列化 HTML 時，執行靜態檢查，確保無任何金鑰字串。 |
| **S2** | **API Key 絕不提交至 Git** (`NO_GIT_KEY`) | 專案全面配置 `.gitignore`，且客戶端代碼禁止常數金鑰。 |
| **S3** | **零開發者伺服器儲存** (`ZERO_DEVELOPER_STORAGE`) | 嚴禁將使用者文件或向量上傳至 ZeroRAG 開發團隊之任何主機。 |
| **S4** | **工作區預設僅留存本機** (`LOCAL_FIRST_STORAGE`) | 所有分塊與索引僅存於瀏覽器 `IndexedDB`，未獲使用者授權不離開瀏覽器。 |
| **S5** | **匯出公開網頁防外洩門禁** (`EXPORT_PRIVACY_GATE`) | 匯出 Portable HTML 前，強制彈出資料外洩風險提示，要求使用者確認文件非機密。預設不打包原始文件。 |
| **S6** | **外部通訊狀態可視化** (`VISIBLE_EGRESS`) | 前端 Network 狀態列必須即時顯示對外 Google API 之呼叫狀態與傳輸量。 |
| **S7** | **Google 條款事前確認** (`TERMS_ACKNOWLEDGEMENT`) | 首次使用 Gemini API 前，使用者必須在 UI 勾選知悉免費版與付費版之資料處理政策。 |
| **S8** | **LLM 產出內容嚴格無害化** (`OUTPUT_SANITIZATION`) | 所有由 LLM 產生的 HTML/Markdown 必須先通過 DOMPurify 與 Schema 驗證，防範 Prompt Injection XSS。 |

---

## 4. 四級資料傳輸定義 (Data Egress Levels)

- ⚫ **Level 0 (Zero Data Egress)**：本機全離線，100% 零網路請求。*(架構預留，非 MVP 範圍)*
- 🟡 **Level 1 (Google AI Studio Free)**：資料不用於開發者，但依 Google 條款可能用於改善產品，嚴禁機密文件。
- 🟢 **Level 2 (Google AI Studio Paid BYOK)**：資料不用於產品改善，但 Google 官方會為了濫用防範進行短期日誌保留。
- 🔵 **Level 3 (Vertex AI Enterprise)**：需配置 KMS 客戶自管金鑰、VPC-SC 服務外圍與 BAA/DPA 企業合約，具備法律級合規保證。

---

## 5. 產出成果渲染器識別碼 (Generators)

- `audit_generator`：品保與法規查核儀表板生成器（**MVP 核心唯一產出器**，實作 Claim-Evidence 映射、原文比對與適用範圍警示）。
- `quiz_generator`：考點刷題與測驗互動卡片生成器（V1.1 擴充）。
- `slides_generator`：Reveal.js 網頁簡報生成器（V1.2 擴充）。
- `mindmap_generator`：Mermaid 決策樹生成器（V1.2 擴充）。
- `report_generator`：A4 Print CSS 報告生成器（V1.2 擴充）。
