# ADR-0004: 採用 C2 方案 (Gzip + Base64 + DecompressionStream) 作為 Portable HTML 發布標準

## 狀態 (Status)
ACCEPTED (已通過並經 Spike C 實測驗證) - 2026-11-02

## 背景脈絡 (Context)
ZeroRAG 承諾產出輕量、可獨立發布、零伺服器維護的便攜式應用 (Portable HTML)。然而：
1. **體積挑戰**：3,000 個分塊 × 768 維 Float32 原始二進位為 8.79 MiB。若採純 Base64 字串內嵌，體積會膨脹約 33% 達 11.72 MiB；若加上文本、樣式與程式碼，極易逼近 15MB 門檻。
2. **多檔案 vs 單檔案**：若拆分為 `app.html` 與 `embeddings.bin` 雙檔案 (C3)，在離線發布或非技術人員傳遞時，極易遺失二進位關聯檔。

## 決策 (Decision)
1. **物理隔離架構**：Runtime 模式發布之 Portable HTML，**徹底剔除所有 Ingestion 解析庫（如 pdf.js / mammoth）**，僅保留渲染與檢索核心。
2. **採用 C2 打包方案**：
   - 向量二進位資料與文本 JSON 在編譯時先經由 Gzip (Level 9) 壓縮。
   - 壓縮後二進位資料轉為 Base64 字串，內嵌於 HTML 獨立標籤中。
   - 瀏覽器載入時，透過現代瀏覽器原生 `DecompressionStream('gzip')` 串流解壓，還原為記憶體平坦化 `Float32Array`。

## 後果影響 (Consequences & Empirical Metrics)
- **正面優勢（Spike C 實測驗證數據）**：
  - **總檔案大小**：3,000 分塊 × 768 維度之單一 HTML 總體積僅 **10.85 MB**，相較純 Base64 (12.56 MB) 減少 1.71 MB，遠低於 15MB 門檻（具備 4.15 MB 餘量）。
  - **解壓延遲**：V8 引擎原生解壓耗時僅 **36.5 ms**，完全不阻礙首屏渲染與檢索啟動。
  - **便攜性**：維持純正「單一 `.html` 檔案」，免去雙檔案遺失問題。
- **潛在限制**：
  - 需依賴現代瀏覽器對 `DecompressionStream` 之原生支援（Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+ 均已全面支援）。
