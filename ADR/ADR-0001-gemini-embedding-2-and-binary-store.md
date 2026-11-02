# ADR-0001: 採用 gemini-embedding-2 與二進位 Float32Array 向量儲存架構

## 狀態 (Status)
ACCEPTED (已通過並經 Spike B 實測驗證) - 2026-11-02

## 背景脈絡 (Context)
在初代草案中，曾提議使用 `text-embedding-004` 並將向量以 JSON `number[]` 陣列儲存於 `embeddings.json`。然而：
1. **Google 官方公告**：`text-embedding-004` 已於 2026-01-14 正式 shutdown，已無法調用。最新推薦模型為原生多模態的 `gemini-embedding-2`（支援 128~3072 維度）。
2. **數學與記憶體事實**：在 3,000 個分塊、768 維度情境下，若以純文字 JSON 儲存，體積會膨脹到 25~35MB，造成瀏覽器解析極度卡頓與記憶體溢出。

## 決策 (Decision)
1. **向量模型選型**：採用 `gemini-embedding-2`，MVP 預設輸出維度固定為 768 維，兼顧檢索語義精度與前端運算效能。
2. **向量提供者抽象**：建立 `EmbeddingConfig` 結構，嚴格記錄 provider、model、dimensions、task_format（prefix 格式）、normalization ("l2")、distance_metric ("cosine") 與 version，避免跨模型向量空間污染。
3. **二進位儲存格式**：全面廢除 `embeddings.json`，改採 `Float32Array` 平坦化緩衝區與二進位檔案格式 `embeddings.bin`（含 64-byte Header）。
4. **儲存架構**：IndexedDB 採用方案 A（單一平坦化二進位 Buffer 存於獨立 Object Store，搭配 chunks metadata 儲存）。

## 後果影響 (Consequences & Empirical Metrics)
- **正面優勢（Spike B 實測驗證數據）**：
  - **體積與記憶體**：3,000 個分塊 × 768 維度僅佔用 **8.79 MiB** 二進位緩衝區（相較 JSON 減少 70%+）。
  - **檢索延遲分位數**：1,000 次查詢實測 **P50 = 2.32 ms**、**P95 = 2.88 ms**、**P99 = 3.90 ms**，性能優於 Gate 目標 (< 30ms) 達 10.4 倍。
  - **擴展延展性**：即使擴展至 10,000 個分塊 (29.3 MiB)，P95 延遲依然達 **9.38 ms** (< 30ms)。
  - **冷啟動讀取**：IndexedDB 零拷貝檢視讀取小於 50 ms。
- **潛在限制**：
  - 開發者無法直接用純文字編輯器閱讀向量數據（需透過解碼工具讀取）。
  - 向量必須事先進行 L2 正規化，以保持點積與餘弦相似度在數學上的等價性。
