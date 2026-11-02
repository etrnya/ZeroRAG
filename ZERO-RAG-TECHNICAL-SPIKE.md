# 🧪 ZeroRAG 技術驗證計畫 (Technical Spike Plan) — Phase 0.5

> **狀態**：COMPLETED (Spikes B, C, D, E Passed; Spike A 依循 BYOK 規範由使用者手動執行)  
> **規格基準**：PRD / ARCHITECTURE / SECURITY / GLOSSARY **v1.1.1 (Approved)**  
> **目的**：在任何正式程式碼進入 `src/` 之前，先證明 5 個最危險的技術假設。  
> **原則**：**沒有通過 Spike 的技術假設，不得寫入 Core。**  

---

## 0. 為什麼要先做 Spike

v1.1.0 的產品與領域模型已經可以定案，但有 5 個假設**目前只存在文件上，還沒有實際驗證過**。如果其中任何一個在瀏覽器裡跑不起來，Phase 1~6 就得重做。

| 假設 | 出處 | 如果假設錯了，會影響什麼 |
| :--- | :--- | :--- |
| 瀏覽器可以在合理時間內呼叫 `gemini-embedding-2` 算完 3,000 個分塊 | PRD §3.1 | Ingest 流程、批次策略、免費額度能不能用 |
| IndexedDB 存取 3,000 筆分塊加向量夠快，暴力法 cosine 能達到 P95 < 30ms | PRD §7.1 | Storage 結構、要不要用 Worker |
| 3,000×768 的單一 HTML 可以壓在 15MB 以內 | PRD §7.2 | Portable HTML 到底要不要做成單檔 |
| `file://` 底下 IndexedDB / fetch / Worker 都能用 | PRD §5.2 | Offline Bundle 能不能成立 |
| 瀏覽器可以直接（CORS）呼叫 Gemini REST，含 `null` origin | PRD §2.1 | 整個 BYOK 架構 |

---

## 1. Spike 執行規則 (Spike Rules)

1. **拋棄式程式碼**：Spike 程式碼一律放在 `SPIKES/<spike-id>/`，**不得**移入 `src/`。目的是取得數據，不是產出可用的程式碼。
2. **時間盒 (Timebox)**：每個 Spike 最多 0.5~1 天。超時就以「目前結論 + 未知項目」結案，不要無限延長。
3. **只用公開測試資料**：一律使用公開法規（例如《政府採購法》及施行細則）或合成資料。**Spike 期間不得放入任何機密文件**，因為測試時可能使用免費金鑰 (SECURITY Level：免費層級)。
4. **API 金鑰**：在執行時輸入（記憶體 / `sessionStorage`），**不得**寫入任何檔案或 commit（適用 S1 / S2）。
5. **能用合成資料就不要燒額度**：Spike B、C、D 使用隨機產生的 `Float32Array` 向量即可，只有 A、E 需要真正的 API 金鑰。
6. **結果判定只有三種**：`PASS` / `PASS-WITH-CONSTRAINTS`（可行但有附帶條件）/ `FAIL`。
7. **3-Strike 熔斷**：同一個 Spike 的同一個問題連續失敗 3 次 → 停止，寫進 `MEMORY.md`，交給使用者裁決。
8. **結果文件**：每個 Spike 結束時產出 `SPIKES/<spike-id>/RESULT.md`（模板見 §8）。

---

## 2. Spike A — `gemini-embedding-2` 瀏覽器端向量化吞吐量

**要驗證的假設**：純瀏覽器呼叫 Gemini Embedding API，可以在可接受的時間內完成 3,000 個分塊的向量化，而且失敗可以恢復。

**要回答的問題**
1. 模型名稱、端點、批次端點（`batchEmbedContents` 或目前的正式等效端點）實際上是什麼？
2. 單次批次最多能放幾筆？每批延遲多少？
3. 指定 768 維時，回傳的向量**有沒有經過 L2 正規化**？（這會決定 `EmbeddingConfig.normalization` 的值，以及 cosine 能不能簡化成 dot product）
4. 是否支援 `task_type`（document / query 分開）？效果有沒有差？
5. 免費層級與付費層級各會在第幾筆撞到 429？指數退避後能不能完整跑完？

**方法**
- 資料：公開法規切成約 300 個分塊做**真實**測試；3,000 筆的規模用 300 筆的結果推估（若額度允許，再實跑 3,000 筆）。
- 記錄：總耗時、每批 P50/P95 延遲、429 次數、重試次數、最終成功率。
- 檢查回傳向量的 L2 norm 分布。

**通過標準（暫定，可依數據調整）**
- 300 筆可以零遺失完成；推估 3,000 筆 ≤ 10 分鐘（付費層級）。
- 撞到 429 時，退避加重試能恢復，而且可以從中斷點續跑。

**探索項目（不列入 Gate）**：`gemini-embedding-2` 原生 PDF embedding 和「自己抽文字再 embedding」比起來，檢索品質與 Evidence 定位的差別。原生 PDF 可能會失去 `SourceLocation` 的精細度，這點要特別記錄。

**影響的決策**：ADR-0001、`EmbeddingConfig` 欄位（task_type / normalization / distance_metric）、Ingest 批次策略。

---

## 3. Spike B — IndexedDB 儲存 + 記憶體內檢索效能

**要驗證的假設**：3,000 個分塊與 3,000×768 向量可以存進 IndexedDB，冷啟動載入夠快，暴力法 cosine Top-K 達到 PRD §7.1 的目標。

**要回答的問題**
1. 向量要怎麼存比較好：**一筆大的 `ArrayBuffer`**，還是**每個分塊一筆**？兩種寫入和讀取各花多少時間？
2. 冷啟動（重新整理後）從 IndexedDB 載入到可以檢索，總共要多久？
3. 暴力法 cosine Top-K 的 P50 / P95 / P99 是多少？主執行緒和 Web Worker 差多少？
4. `navigator.storage.estimate()` 的配額是多少？`navigator.storage.persist()` 會不會被授予？

**方法**
- 合成資料：3,000 筆隨機 `Float32Array(768)` 加上每筆約 500 字的假文字。
- 額外跑 1536 維與 10,000 筆，了解擴展時的曲線。
- 查詢跑 1,000 次，計算分位數。

**基準環境**：Chrome 154 / Windows 11 / x86-64（需要記錄 CPU 型號）。行動裝置（iOS Safari）只記錄數據，不列入 Gate。

**通過標準**
- 檢索：P50 < 10ms、P95 < 30ms、P99 < 50ms（3,000×768，桌機 Chrome）。
- 冷啟動載入 < 1 秒。

**影響的決策**：IndexedDB schema、要不要預設用 Worker、ADR-0001 的效能宣稱。

---

## 4. Spike C — Portable HTML 打包體積與載入

**要驗證的假設**：3,000×768 的知識庫可以做成單一 HTML，達到「15MB 目標、20MB 上限」，而且開啟速度可以接受。

**要比較的方案**

| 方案 | 說明 | 要量測的項目 |
| :--- | :--- | :--- |
| C1 | 單一 HTML，向量以 Base64 直接內嵌 | 檔案大小、解碼時間 |
| C2 | 單一 HTML，向量先 gzip 再 Base64，開啟時用 `DecompressionStream` 解壓 | 檔案大小、解壓時間、`file://` 可不可用 |
| C3 | `app.html` + `embeddings.bin` 兩個檔案 | 檔案大小、`file://` 下能不能 fetch 到 `.bin` |
| C4（探索） | 向量量化成 Float16 / Int8 | 體積縮減比例、檢索 Top-K 重疊率（和 Float32 比） |

**注意**：真實 embedding 的壓縮率和隨機資料不同（隨機 Float32 幾乎壓不下來）。C2 至少要用 Spike A 產生的真實向量量測一次。

**通過標準**
- 至少一個方案在 3,000×768 時 ≤ 15MB，而且在 Chrome 開啟到可檢索 < 3 秒。
- 若只有 C3 達標 → 結果為 `PASS-WITH-CONSTRAINTS`，PRD 必須把「單檔」改成「單資料夾」。

**影響的決策**：新增 ADR-0004（Standalone Bundle 格式）。

---

## 5. Spike D — `file://` 協議相容性矩陣

**要驗證的假設**：Offline Bundle 雙擊開啟後，核心功能都可以運作。

**測試矩陣**（每格填寫 ✅ / ❌ / ⚠️ 加備註）

| 功能 | Chrome | Edge | Firefox | Safari (macOS) |
| :--- | :---: | :---: | :---: | :---: |
| inline `<script>` / inline `<script type="module">` | | | | |
| 外部 `<script type="module" src>` | | | | |
| IndexedDB 可寫入 | | | | |
| IndexedDB 重開檔案後資料仍在 | | | | |
| 不同 HTML 檔是否共用同一個 IndexedDB（origin 隔離） | | | | |
| `localStorage` / `sessionStorage` | | | | |
| `fetch()` 同資料夾的 `.bin`（C3 方案需要） | | | | |
| Web Worker（外部檔 / Blob URL） | | | | |
| `fetch()` 到 Gemini API（`Origin: null`） | | | | |
| `DecompressionStream` | | | | |
| Clipboard 寫入（Notion 複製功能） | | | | |
| File input 讀取 PDF | | | | |

**特別關注**：「不同 HTML 檔是否共用 IndexedDB」直接關係到 **S4 與威脅模型中的「跨來源儲存污染」**。如果某個瀏覽器讓所有 `file://` 共用同一個 origin，兩個不同知識庫的離線檔就可能互相讀到對方的資料。

**通過標準**
- Chrome 與 Edge 的核心功能（inline script、IndexedDB、fetch Gemini）全部 ✅。
- Firefox / Safari 的限制記錄下來，寫進「已知限制」即可，不阻擋 Gate。

**影響的決策**：Offline Bundle 是否列入 MVP、ADR-0004、使用者文件中的「支援瀏覽器」清單。

---

## 6. Spike E — 瀏覽器直連 Gemini（BYOK 通訊路徑）

**要驗證的假設**：靜態網頁可以不經過任何代理，直接從瀏覽器安全地呼叫 Gemini。

**要回答的問題**
1. 從 `https://<user>.github.io` 與 `file://`（`Origin: null`）呼叫 Gemini REST，CORS 能不能通過？
2. 金鑰要放 header（`x-goog-api-key`）還是 query string？哪一種不會讓金鑰出現在瀏覽器歷史紀錄或 log 裡？
3. 官方 JS SDK（例如 `@google/genai`）能不能在瀏覽器用 CDN ESM 載入？還是直接用 `fetch` 比較單純？
4. 串流（SSE）與 Structured Output（JSON Schema）在瀏覽器端能不能用？
5. 用 `models.list` 確認目前**真實可用**的 embedding 與生成模型名稱。
6. 錯誤碼（400 / 403 / 429 / 503）的實際格式，給 UI 做錯誤提示用。

**同時要做的文件核實**（誠實性門禁）
- 以 Google 官方文件核實：`text-embedding-004` 的停用日期、`gemini-embedding-2` 的維度與多模態規格、`gemini-embedding-001` 的停用時程。
- 核實 Free / Paid / Vertex AI 三種層級的資料使用條款**目前的原文**，作為 S7 條款確認畫面的文案依據。附上連結與查閱日期。

> ⚠️ 上述模型停用日期與條款內容，目前在 v1.1.0 文件中**都是引用審查意見，我還沒有自己對照官方文件核實過**。Spike E 必須完成核實，才能寫進 v1.1.1。

**通過標準**
- `https` origin 直連成功；金鑰不出現在 URL。
- `file://` 結果記錄即可（併入 Spike D 矩陣）。

**影響的決策**：GeminiClient 的實作方式、S7 文案、ADR-0002 的補充。

---

## 7. Gate 判定：什麼時候可以進 Phase 1

| Spike | 必須達成的結果 | 如果 FAIL 的備案 |
| :--- | :--- | :--- |
| A | PASS 或 PASS-WITH-CONSTRAINTS | 降低預設分塊數量、提示使用付費金鑰、改成背景續跑 |
| B | PASS | 預設改用 Worker；或改成量化向量 |
| C | 任一方案 PASS-WITH-CONSTRAINTS 以上 | Portable 改成「HTML + bin 資料夾」 |
| D | Chrome / Edge 核心功能 PASS | Offline Bundle 移出 MVP，只保留 Portable（https） |
| E | https 直連 PASS | **整個 BYOK 架構需要重新審查**（這是唯一的致命項目） |

全部 Gate 通過後：
1. 把結果合併進 PRD / ARCHITECTURE / SECURITY **v1.1.1**（含 [PRD_v1.1.1_ERRATA.md](file:///c:/Users/etrny/.gemini/antigravity/scratch/ZeroRAG/PRD_v1.1.1_ERRATA.md) 的待辦）。
2. 新增 ADR-0004（Standalone Bundle）與 ADR-0005（Local Embedding：架構預留，不列入 MVP）。
3. 使用者核准 → 才開始 Phase 0 / Phase 1。

---

## 8. RESULT.md 模板

```markdown
# Spike <ID> Result — <名稱>

- 日期 / 執行時間：
- 環境：瀏覽器版本 / OS / CPU / 金鑰層級 (Free | Paid)
- 判定：PASS | PASS-WITH-CONSTRAINTS | FAIL

## 原始數據
（表格：P50 / P95 / P99、檔案大小、錯誤次數…）

## 結論
## 附帶限制 (Constraints)
## 尚未確認的項目 (Unknowns)
## 對 PRD / ADR 的修改建議
```
