# ADR-0002: 嚴格憑證隔離與匯出安全守則 (S1 Invariant)

## 狀態 (Status)
ACCEPTED (已通過) - 2026-10-05

## 背景脈絡 (Context)
ZeroRAG 允許使用者將知識庫編譯並匯出為單一 HTML 檔案 (`my-rag.html`) 分享給他人或發布至 GitHub Pages。
若直接將建立者的 Google API Key 序列化打包進該檔案中，等同於向全球公開該金鑰，將導致帳單被盜刷與嚴重的資安事故。

## 決策 (Decision)
1. **確立 S1 鐵律 (`NEVER_BUNDLE_KEY`)**：匯出的 HTML 檔案與 `.ragpack` 知識包中，**絕對嚴禁包含任何 API Key**。
2. **Data-Credential 分離模式**：
   - 知識資料與向量特徵由建立者打包。
   - 使用者取得 HTML 後，於本地第一次開啟時，必須自行輸入個人 API Key。
3. **Session-Only 預設機制**：輸入之金鑰預設儲存於 JS 記憶體變數中，關閉分頁即刻銷毀；不盲目寫入 `localStorage`。

## 後果影響 (Consequences)
- **正面優勢**：
  - 徹底杜絕金鑰外洩與連帶帳單風險。
  - 符合 Google 官方關於 client-side API Key 安全性指導原則。
- **潛在限制**：
  - 最終接收到 HTML 檔案的使用者，需自備 Gemini API Key 才能執行提問推論。
