# Spike E Result — 瀏覽器直連 Gemini（BYOK 通訊路徑）

- **狀態**：🟡 **進行中（PARTIAL）**：無金鑰項目已完成；需要真實金鑰的項目、`file://` 與 GitHub Pages 尚待執行
- **執行日期**：2026-10-05（文件核實、curl）／2026-10-07（瀏覽器測試）
- **測試頁**：[SPIKES/spike-e/index.html](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/SPIKES/spike-e/index.html)
- **瀏覽器**：Chrome 154.0.0.0 / Windows 10 x64（UA 字串）
- **金鑰**：目前只用過假金鑰（`FAKE_KEY_FOR_SPIKE_E` 和 `AIzaFAKE…E123`），**還沒有用過真實金鑰**

---

## 1. 官方文件核實（E17 誠實性門禁）

查閱日期 2026-10-05，以下全部是我自己讀官方頁面原文後的摘錄。

### 1.1 Embeddings — https://ai.google.dev/gemini-api/docs/embeddings

| 項目 | 官方原文重點 | 對 ZeroRAG 的影響 |
| :-- | :-- | :-- |
| 最新模型 | 「The latest model, gemini-embedding-2, is the first multimodal embedding model」；「For text-only use cases, gemini-embedding-001 remains available」 | ✅ 和 ADR-0001 一致 |
| 端點 | `POST /v1beta/models/gemini-embedding-2:embedContent`，金鑰放在 `x-goog-api-key` header | ✅ 金鑰可以不放在 URL |
| 維度 | 預設 3072；可以用 `output_dimensionality` 縮小；建議 768 / 1536 / 3072 | ✅ 768 可行 |
| 正規化 | 「Gemini Embedding 2 also auto-normalizes truncated dimensions (e.g., 768, 1536)」 | → `normalization: "l2"`；cosine 可以簡化成 dot product（待真實金鑰驗證） |
| 輸入上限 | 8,192 tokens | 分塊大小上限的依據 |
| 🆕 **task_type** | 「**You cannot use the task_type field for the gemini-embedding-2 model.** Instead, include the task as an instruction in your prompt」 | ❗ **Errata E2 要改**：不是新增 `task_type` 欄位，而是改成「task 前綴格式」 |
| 🆕 **多段輸入** | 「Gemini Embedding 2 produces **a single aggregated embedding for multiple inputs**」；要產生多個向量，請用 Batch API 或 `batchEmbedContents` 的多個 request | ❗ **新發現**：批次向量化**必須**拆成多個 request，否則 3 段文字只會得到 1 個向量 |

官方建議的 task 前綴格式（非對稱檢索，用於問答）：
- 查詢：`task: question answering | query: {content}`
- 文件：`title: {title} | text: {content}`（沒有標題時寫 `title: none`）

### 1.2 Pricing — https://ai.google.dev/gemini-api/docs/pricing

- **Free**：「Content used to improve our products」
- **Paid**：「Content not used to improve our products」
- **Enterprise**：「powered by Gemini Enterprise Agent Platform」

### 1.3 Zero data retention — https://ai.google.dev/gemini-api/docs/zdr

- Paid Services：Google 不會用 prompt（含 system instructions、cached content、files）和 response 來改善產品。
- **但是**：「for Paid Services, Google logs prompts and responses for a limited period of time solely for detecting violations of the Prohibited Use Policy.」
- 「If your workload requires guaranteed zero data retention or enterprise data processing agreements, use Vertex AI.」
- 其他會保留資料的情況：Grounding with Google Search / Maps（保留 30 天，**無法關閉**）、Interactions API（預設會儲存狀態，需要設定 `store: false`）、File API（要手動刪除）、Explicit Context Caching。

**結論**：你的判斷是對的。「付費 = 零保留」是過度承諾。UI 文案應該寫成「不用於改善產品，但仍會為了濫用偵測短期記錄」。另外 ZeroRAG **不應該使用 Grounding、File API 和 Interactions API**（新增約束，見 §5）。

---

## 2. 伺服器端 CORS 證據（curl，2026-10-05）

| 測試 | Origin | 結果 |
| :-- | :-- | :-- |
| OPTIONS 預檢 | `http://localhost:8765` | 200，`Access-Control-Allow-Origin: http://localhost:8765`，允許 `content-type,x-goog-api-key` |
| OPTIONS 預檢 | `https://etrnya.github.io` | 200，回傳同一個 origin |
| OPTIONS 預檢 | `null`（`file://`） | 200，`Access-Control-Allow-Origin: null` |
| POST + 假金鑰 | `https://etrnya.github.io` | 400 `API key not valid`，**錯誤回應也帶 CORS 標頭** |
| POST + 假金鑰 | `null` | 400，同上 |

⚠️ 這只代表**伺服器願意放行**。瀏覽器實際上會不會送出（例如 `file://` 的限制），還是要在真實瀏覽器裡驗證。

---

## 3. 瀏覽器實測：`http://127.0.0.1:8765`（Chrome 154）

錄影：`spike_e_nokey_1791341198891.webp`（存放在 artifacts 目錄）

| 項目 | 結果 | 說明 |
| :-- | :-- | :-- |
| **E-A** REST 連線（假金鑰） | ✅ PASS | 434ms 收到 400，`readableError: true`，瀏覽器讀得到錯誤內容 |
| **E-A** REST `models.list` | ✅ 如預期 | 111ms，400 `API_KEY_INVALID`，錯誤 JSON 完整 |
| **E-2** 官方 SDK（jsdelivr CDN ESM） | ✅ PASS | 從 CDN 載入成功，沒有 module 或 CORS 錯誤；1226ms（含 SDK 下載）收到 400 |
| **E-E** 刪除金鑰後呼叫 | ✅ PASS | 在本機就被擋下，送出 0 筆請求 |
| **E-F** 對外請求 | ✅ PASS | 3 筆請求，全部送往 `generativelanguage.googleapis.com`；SDK 會多帶 `user-agent`、`x-goog-api-client` 兩個 header |
| Console 錯誤 | ✅ 無 | 0 行 |

### 紅隊檢查（假金鑰，記憶體模式）

| # | 檢查項目 | 結果 |
| :-- | :-- | :-- |
| 1 | 金鑰沒有出現在任何請求 URL | ✅ |
| 2 | 頁面網址不含金鑰 | ✅ |
| 3 | 金鑰沒有寫進 console | ✅ |
| 4 | 金鑰沒有寫進 IndexedDB（SDK 也沒有建立任何資料庫） | ✅ |
| 5 | Web Storage 狀態符合記憶體模式 | ✅ |
| 6 | DOM 不含金鑰 | ✅ |
| 7 | 模擬匯出 HTML 不含金鑰（S1） | ✅ |
| 8 | 模擬 .ragpack manifest 不含金鑰（S1） | ✅（只是模擬，真實打包器完成後要重測） |
| 9 | 請求 Body 不含金鑰 | ✅ |
| 10 | 沒有送往 Google 以外的主機（S3） | ✅ |
| 11 | 帶金鑰的請求只送往 generativelanguage.googleapis.com | ✅ |

---

## 4. 尚未完成的項目

| 項目 | 原因 | 誰來做 |
| :-- | :-- | :-- |
| **E-B** 真實 embedding（768 維、L2 norm、cosine 排序、多段輸入合併） | 需要真實金鑰 | 使用者手動 |
| **E-C** 真實生成、Structured Output、SSE 串流 | 需要真實金鑰 | 使用者手動 |
| 紅隊檢查（真實金鑰、sessionStorage / localStorage 模式） | 需要真實金鑰 | 使用者手動 |
| **E-D** `file://` 實測 | 瀏覽器自動化工具禁止開啟 `file://` | 使用者手動 |
| **E-D** GitHub Pages 實測 | 要先部署；**還沒有經過你同意就推上 GitHub** | 等你決定 |
| Edge / Firefox | 尚未測試 | 使用者手動（選做） |

---

## 5. 目前的結論與對規格的影響

**暫定判定：E 的致命項目（https 直連）目前看起來可以通過。** localhost 的瀏覽器實測和 GitHub Pages origin 的 curl 預檢都放行，但要等真實金鑰的 E-B / E-C 跑完，才能正式判定 PASS。

要加進 v1.1.1 的修改：

| # | 修改 |
| :-- | :-- |
| E2（修正） | `EmbeddingConfig` **不新增** `task_type`；改成 `task_format: "gemini-embedding-2-prefix"`，加上 `normalization: "l2"`、`distance_metric: "cosine"` |
| E19（新增） | 批次向量化一律使用 `batchEmbedContents`，每個分塊一個 request。**禁止**在單一 `embedContent` 裡放多段文字（會被合併成 1 個向量，造成資料錯誤，而且不會報錯） |
| E20（新增） | 禁止使用的 Gemini 功能：Grounding with Google Search / Maps、File API、Interactions API（除非 `store:false`）、Explicit Context Caching。這些都會在 Google 端保留資料，和 Local-First 的定位衝突 |
| E12（定案文案） | L1 免費：資料可能用於改善 Google 產品 ⚠ 不適合機密資料；L2 付費：不用於改善產品，但 Google 仍會為了濫用偵測短期記錄 prompt 與 response；L3 Vertex AI：依企業合約，才可能做到保證的零保留 |
| E21（新增） | REST 與 SDK 在瀏覽器都可以用。**建議 MVP 採用 REST**：零依賴、可以完全掌握送出的 header、可以 inline 進 Offline Bundle。SDK 保留成 `AIProvider` 的第二種實作 |
