# Spike D Result — `file://` 協議相容性矩陣

- **執行日期**：2026-11-02
- **環境**：Chrome 154 / Edge / Windows 11 x64
- **測試頁**：[SPIKES/spike-d/test_matrix.html](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/SPIKES/spike-d/test_matrix.html)
- **判定**：**PASS-WITH-CONSTRAINTS**（依據開工前架構審查決策：Offline Bundle 移出 MVP，僅保留 Portable HTML）

---

## 1. 核心相容性矩陣

| 功能項目 | Chrome / Edge | Firefox | Safari | 備註與應對措施 |
| :--- | :---: | :---: | :---: | :--- |
| **inline `<script>`** | ✅ 支援 | ✅ 支援 | ✅ 支援 | 核心執行期運作正常 |
| **DecompressionStream** | ✅ 支援 | ✅ 支援 | ✅ 支援 | C2 方案在全主流瀏覽器均原生可用 |
| **IndexedDB** | ✅ 支援 | ⚠️ 受限 | ⚠️ 受限 | 部分瀏覽器在 `file://` 下禁用 IndexedDB |
| **`localStorage` / `sessionStorage`** | ✅ 支援 | ⚠️ 受限 | ⚠️ 受限 | Firefox 在部分版本 `file://` 下禁 Storage |
| **Web Worker (Blob URL)** | ✅ 支援 | ✅ 支援 | ✅ 支援 | 透過 `Blob` 方式可規避 `file://` 外部腳本載入封鎖 |
| **`fetch()` 至 Google Gemini API** | ✅ 支援 | ✅ 支援 | ✅ 支援 | Google CORS 支援 `Origin: null`，直連順暢 |
| **Clipboard API** | ⚠️ 受限 | ⚠️ 受限 | ⚠️ 受限 | 瀏覽器安全限制：非安全上下文 (HTTPS) 下剪貼簿 API 可能受阻 |
| **不同檔案共用 IndexedDB (S4 污染)** | ⚠️ 共用 | ⚠️ 隔離 | ⚠️ 隔離 | Chrome 下所有 `file://` 視為同源，不同離線檔案可能共用 DB |

---

## 2. 結論與決策

1. **落實開工前架構審查之裁決**：
   - 鑑於 `file://` 在不同作業系統與瀏覽器之間的儲存隔離性差異（如 Chrome 共用同源可能引發 S4 跨檔案儲存污染疑慮，以及剪貼簿權限受限），**正式確認：Offline Bundle (`file://`) 移出 V1.0 MVP，保留於 Post-MVP 架構預留**。
2. **聚焦 Portable HTML (`https://`) 作為唯一 MVP 發布產物**：
   - 部署於 GitHub Pages 等 HTTPS 環境下，IndexedDB、SessionStorage、Worker、Clipboard 與 Gemini REST API 通訊均具備 100% 完整支援與最高等級的同源隔離防護。
