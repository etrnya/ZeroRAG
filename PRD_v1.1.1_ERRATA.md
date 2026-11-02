# 📝 ZeroRAG v1.1.1 勘誤與待合併清單 (Errata Backlog)

> **狀態**：RESOLVED & MERGED INTO v1.1.1 SPECIFICATIONS  
> **更新日期**：2026-11-02  
> **規則**：v1.1.1 經開工前架構審查 (Pre-Execution Architecture Review) 全量合併定案。

---

## A. 第二輪審查與架構審核處理狀態 (E1 ~ E11)

| # | 影響文件 | 問題 | v1.1.1 落地成果 | 狀態 |
| :-- | :-- | :-- | :-- | :--: |
| E1 | PRD §2.1, GLOSSARY | Level 0（本機 WASM embedding）有宣稱，但非 MVP | 標註 **Architecture Reserved / NOT MVP**；`local_wasm` 不列入 MVP 驗收；另立 ADR-0005 | ✅ 已合併 |
| E2 | GLOSSARY §2.2, ARCH | `EmbeddingConfig` 需規範 task 格式與度量 | 採 `task_format: "gemini-embedding-2-prefix"`, `normalization: "l2"`, `distance_metric: "cosine"` | ✅ 已合併 |
| E3 | PRD §4 | 「Reranking & Filter」實際上只是分數過濾 | 改名為 **Score Filter**；Reranker 列為 V1.1+ 選配 | ✅ 已合併 |
| E4 | PRD §4 | `score >= 0.70` 門檻寫死不合理 | 改成 `RetrievalConfig { candidateK: 30, topK: 5, minScore?: number }`；保證 Top-K 為先 | ✅ 已合併 |
| E5 | GLOSSARY §2.4 | Evidence 混淆相關度與可信度 | 新增 `retrieval_method`, `confidence?`, `generated_at` | ✅ 已合併 |
| E6 | PRD §3.4 | 「無來源幻覺」無法保證 | 引入 **`ClaimVerification`（主張-證據獨立映射）**，若無證據標註 `UNVERIFIED` 並提供 `scope_warning` | ✅ 已合併 |
| E7 | PRD §5.1, ARCH §4 | `.ragpack` 缺乏完整性防篡改校驗 | 規格正式納入 **`checksums.json` (逐檔 SHA-256 雜湊)** | ✅ 已合併 |
| E8 | PRD §5.1, ADR-0003 | `documents/` 預設可能打包內部原始檔 | 預設**不打包原始文件**，防範敏感文件外洩（落實 S5） | ✅ 已合併 |
| E9 | PRD §7.2 | Base64 體積膨脹，15MB 需嚴格控管 | 採取 **Studio（編譯器）與 Runtime（發布頁）物理隔離**：Runtime 徹底拔除 pdf.js 等解析庫，體積穩健壓在 11MB | ✅ 已合併 |
| E10 | PRD §6 | DDD 命名不宜過度工程化 | 採輕量無狀態管線 (`ChunkingPipeline`, `VectorIndex`, `ClaimEvidenceMapper`) | ✅ 已合併 |
| E11 | PRD §8 | Roadmap 缺少技術驗證階段 | 插入 **Phase 0.5 — Technical Spikes** | ✅ 已合併 |

---

## B. 內部不一致與規範校對處理狀態 (E12 ~ E21)

| # | 影響文件 | 問題 | v1.1.1 落地成果 | 狀態 |
| :-- | :-- | :-- | :-- | :--: |
| E12 | PRD, SECURITY, GLOSSARY | 四級傳輸 Level 定義曾有衝突 | 全面統一為：**L0 本機全離線 ⚫ / L1 Google 免費層級 🟡 / L2 Google 付費 BYOK 🟢 / L3 Vertex AI 企業專約 🔵** | ✅ 已合併 |
| E13 | ADR-0001 | 「P95 < 30ms 已達成」曾為推測 | 標記為目標值，並由 Spike B 基準壓測驗證 | ✅ 驗證中 |
| E14 | ARCH §2.3 | 「JSZip/fslate」錯字 | 已更正為 `fflate` / `JSZip` | ✅ 已合併 |
| E15 | SECURITY §3.1 | regex 帶 `g` 旗標存在 `lastIndex` 漏判隱患 | 移除 `g` 旗標；明確以架構隔離為第一防線，正則為縱深防禦 | ✅ 已合併 |
| E16 | SECURITY §2 | Invariant 需具備測試機制 | 納入 Invariant 測試計畫（S1 導出掃描、S2 pre-commit scan、S8 XSS 測試集） | ✅ 已合併 |
| E17 | 全部文件 | 官方模型停用日期與條款需核實 | Spike E 完成原文核實，確立 prefix 語法與多段輸入聚合防護 | ✅ 已合併 |
| E18 | ADR 目錄 | ADR 編號維護規範 | 維持原編號：0001 embedding, 0002 憑證隔離, 0003 ragpack; 預留 0004 bundle, 0005 local | ✅ 已合併 |
| E19 | PRD, ARCH | 多段輸入會被 Gemini 融合成單向量 | 向量化批次一律使用 `batchEmbedContents` 或獨立分塊請求 | ✅ 已合併 |
| E20 | PRD, SECURITY | 禁用的雲端保留狀態功能 | 嚴禁調用 Grounding, File API, Interactions API (除非 store:false) | ✅ 已合併 |
| E21 | ARCH | 瀏覽器呼叫路徑評估 | MVP 採純 REST fetch 直連，零外掛依賴且利於離線打包 | ✅ 已合併 |
