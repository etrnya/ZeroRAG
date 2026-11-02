# ADR-0003: 定義 .ragpack 標準知識封裝格式與雙軌交付

## 狀態 (Status)
ACCEPTED (已通過) - 2026-10-05

## 背景脈絡 (Context)
若系統僅以 HTML 作為產物，會產生兩大限制：
1. **備份與遷移困難**：使用者無法將已處理好的多個知識庫與分塊特徵移轉到另一台電腦或備份。
2. **機密文件防外洩**：若直接將所有內容編譯為 HTML 丟給他人，容易誤將機密推送到公開的 GitHub Pages。

## 決策 (Decision)
1. **確立 `.ragpack` 知識包格式**：
   - 採標準 ZIP 封裝，內含 `manifest.json`、`chunks.json`、`embeddings.bin` 與 `metadata.json`。
   - 作為 Studio 工作區匯出 (Export) 與匯入 (Import) 的權威格式。
2. **雙軌交付架構 (Dual-Track Delivery)**：
   - **公開資料**：走 Portable HTML 部署至 GitHub Pages，搭配 App Portal 總目錄。
   - **機密資料**：走 `.ragpack` 或 Local-First 離線單檔 (`file://`)，不上公開雲端。

## 後果影響 (Consequences)
- **正面優勢**：
  - 實現跨設備遷移與冷備份能力。
  - 將「資料交換格式 (`.ragpack`)」與「視覺呈現產物 (`.html`)」完全解耦，架構極度清晰。
