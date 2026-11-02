# 🏛️ ZeroRAG 架構設計規格書 (Architecture Specification) v1.1.1

> **文件狀態**：APPROVED (依據 Pre-Execution Review 瘦身與定案)  
> **關聯規格**：[PRD.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/PRD.md) | [GLOSSARY.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/GLOSSARY.md) | [SECURITY.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/SECURITY.md)  
> **系統架構模式**：輕量無狀態管線 (Lightweight Stateless Pipelines) + Studio/Runtime 物理隔離 + 二進位向量引擎

---

## 1. 系統架構全景與「編譯器／執行期」物理隔離

為防止體積失控並達成「Portable HTML ≤ 15MB」之目標，系統在物理上拆分為 **Studio (編譯工作室)** 與 **Runtime (發布閱覽器)** 兩套情境：

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   【Studio 模式：知識編譯工作室】                      │
│      (線上版 GitHub Pages：包含解析、切塊、向量化、知識包匯出)         │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
                ▼ (貼入/載入文字)                        ▼ (發起編譯)
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     Chunking Pipeline         │        │    .ragpack & HTML Compiler   │
│  • Markdown / TXT / Paste     │        │  • 打包 chunks.json           │
│  • 滑動視窗切塊演算法          │        │  • 寫入 embeddings.bin        │
│  • SourceLocation 雙軌定位    │        │  • 計算 checksums.json        │
└───────────────┬───────────────┘        │  • 產出 Runtime Portable HTML │
                │                        └───────────────┬───────────────┘
                ▼ (分塊段落)                             │
┌───────────────────────────────┐                        │ (產物發布)
│      Vector Pipeline          │                        │
│  • gemini-embedding-2 (768維) │                        ▼
│  • batchEmbedContents 批次    │        ┌───────────────────────────────┐
│  • Float32Array 連續平坦化    │        │   【Runtime 模式：便攜應用】   │
└───────────────┬───────────────┘        │   (獨立單檔 HTML, 零解析庫)   │
                │                        ├───────────────────────────────┤
                ▼                        │  • 唯讀載入內嵌向量與文本     │
┌───────────────────────────────┐        │  • 瀏覽器本機暴力點積 Top-K   │
│    IndexedDB Storage Adapter  │        │  • Claim-Evidence 查核儀表板  │
│  • 單一大 ArrayBuffer 快速存取│        │  • 體積穩健控制在 ~11MB       │
└───────────────────────────────┘        └───────────────────────────────┘
```

---

## 2. 輕量管線化設計（拒絕純前端過度工程化）

摒除後端微服務僵硬的多層抽象，純前端採用 **三大無狀態核心管線 (Stateless Pipelines)**：

### 2.1 切塊管線 (`ChunkingPipeline`)
- **MVP 範圍限制**：僅處理純文字（Markdown、TXT、剪貼簿字串）。絕不在第一版引入重型 PDF/Word 解析庫，避開版面錯位與表格破版泥淖。
- **職責**：將文字拆分為具有語意連續性的片段，並計算 SHA-256 與 `SourceLocation`（檔案名、章節條號、段落序號）。

### 2.2 向量索引管線 (`VectorIndex`)
- **零依賴演算法**：純 JavaScript / Web Worker 實作二進位緩衝區管理與點積運算。
- **數學等價優化**：因 `gemini-embedding-2` 已由端點進行 L2 正規化，餘弦相似度等於純向量點積 ($A \cdot B$)。
- **儲存對齊**：IndexedDB 採用方案 A（單一大 `ArrayBuffer` 存放整體二進位向量，搭配中繼 chunks 儲存），冷啟動讀取小於 50ms。

### 2.3 主張-證據映射管線 (`ClaimEvidenceMapper`)
- **防擴張核心**：不直接輸出全文自由聊天內容。要求 LLM 以嚴格 JSON Schema 輸出單一具體陳述 (`ClaimVerification`)。
- **對照比對**：
  1. 擷取 Top-5 證據片段 (`Evidence`)。
  2. 要求 LLM 針對待查核項目拆解為獨立 Claims，逐一標註 `SUPPORTED`、`CONTRADICTED` 或 `UNVERIFIED`。
  3. 若原文僅屬特定情境，強制模型填寫 `scope_warning`（適用範圍警示）。

---

## 3. 二進位向量儲存格式規範 (`embeddings.bin`)

採用標準 Little-Endian 平坦化二進位佈局：

```text
+---------------------------------------------------------------+
| Byte 0~3   : Magic Number 'ZRAG' (0x5A, 0x52, 0x41, 0x47)     |
| Byte 4~5   : Format Version (Uint16: 0x0001)                  |
| Byte 6~7   : Dimensions (Uint16: 768)                         |
| Byte 8~11  : Vector Count N (Uint32)                          |
| Byte 12~43 : Model Identifier ASCII ("gemini-embedding-2")    |
| Byte 44~63 : Reserved / Flags (20 Bytes)                      |
+---------------------------------------------------------------+
| Byte 64 ~  : Float32Array (N * Dimensions * 4 Bytes)          |
|              Vector 0: [f32, f32, ... (768)]                  |
|              Vector 1: [f32, f32, ... (768)]                  |
|              ...                                              |
|              Vector N-1: [f32, f32, ... (768)]                |
+---------------------------------------------------------------+
```

前端載入時僅需一行代碼建立零拷貝檢視 (Zero-Copy View)：
```typescript
const vectors = new Float32Array(buffer, 64, count * dimensions);
```

---

## 4. 知識封裝包規格 (`.ragpack`)

`.ragpack` 實質為標準 ZIP 封裝，內含嚴格的結構：

```text
my-knowledge.ragpack (ZIP 格式)
├── manifest.json       <-- 專案名稱、UUID、版本、建立時間、EmbeddingConfig
├── metadata.json       <-- 文件清單、分塊統計、Token 總量
├── checksums.json      <-- 逐檔 SHA-256 完整性雜湊（防篡改，E7）
├── chunks.json         <-- 分塊內容與 SourceLocation 結構化文字
└── embeddings.bin      <-- 平坦化 Float32Array 連續二進位向量
```

---

## 5. 打包體積控制與 15MB 達成矩陣

| 組成項目 | 未壓縮體積 | 處理策略與實際估算 |
| :--- | :---: | :--- |
| **純向量資料 (3000 × 768 Float32)** | 8.79 MiB | Base64 膨脹為 **11.7 MiB**；gzip 後約 **7.5~8.5 MiB**。 |
| **分塊文本 (3000 × 150字繁中)** | 1.35 MiB | 內嵌於 `<script type="application/json">`，約 **400 KiB**。 |
| **中繼資料與 Checksums** | 0.15 MiB | JSON 格式，約 **50 KiB**。 |
| **前端 Runtime UI + CSS** | 0.80 MiB | 原生 Vanilla JS + 內嵌 CSS，約 **150 KiB**。 |
| **第三方解析庫 (Runtime)** | - | **0 KB**（Runtime 徹底剔除 pdf.js/mammoth）。 |
| **總計 (Portable HTML)** | **~11.09 MiB** | **留有 3.5MB+ 安全裕度，15MB 絕對可達！** |
