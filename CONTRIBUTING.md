# 🤝 ZeroRAG 貢獻指南 (Contributing Guidelines)

感謝您對 **ZeroRAG (Knowledge → Evidence → Application Compiler)** 的關注與貢獻！  
為確保專案程式碼之高內聚、低耦合、不可違背的資安不變性 (S1~S8) 與統一的術語標準，請所有貢獻者在提交 PR 或 Issue 前詳閱以下規範。

---

## 1. 開發核心鐵律 (Non-Negotiable Invariants)

1. **字典先行 (Dictionary First)**：
   - 所有的程式碼變數、實體欄位、文件術語，**必須 100% 與 [GLOSSARY.md](GLOSSARY.md) 對齊**。
   - 若需新增領域概念或資料欄位，必須先更新 `GLOSSARY.md` 獲得核准後始得動工。
2. **安全不變性守則 (S1 ~ S8)**：
   - **S1 (`NEVER_BUNDLE_KEY`)**：匯出的 HTML 與 `.ragpack` 產物絕不包含 API Key。
   - **S2 (`NO_GIT_KEY`)**：任何 Commit 或測試腳本中嚴禁硬編碼任何真實 API Key。
   - **S3 (`ZERO_DEVELOPER_STORAGE`)**：嚴禁將使用者的文件或向量上傳至第三方自建伺服器。
   - **S8 (`OUTPUT_SANITIZATION`)**：所有由 LLM 生成之內容渲染前必須經過 DOMPurify 與 Schema 驗證。
3. **無伺服器與本機優先 (Local-First)**：
   - 所有運算（切塊、二進位索引、點積計算）必須可在純瀏覽器環境運行。

---

## 2. 開發與測試流程 (Workflow)

### 2.1 環境需求
- Node.js v18+（推薦 v20+）
- 現代瀏覽器（支援 ES Modules、IndexedDB、DecompressionStream）

### 2.2 執行自動化測試
在提交任何代碼修改前，**必須確保所有單元測試全數綠燈通過**：

```bash
# 執行核心管線單元測試與靜態斷言
npm test

# 執行 Spike B 向量檢索微基準壓測
npm run benchmark:b

# 執行 Spike C 打包體積與解壓縮壓測
npm run benchmark:c
```

### 2.3 啟動本地開發伺服器
```bash
# 啟動本機 HTTP 伺服器
npm start

# 在瀏覽器開啟 Studio 介面
# http://localhost:8765/src/ui/index.html
```

---

## 3. 提交規範 (Commit Message Guidelines)

本專案採用 **Conventional Commits** 規範：

- `feat(core): 新增 ClaimVerification 適用範圍警示校驗`
- `fix(chunking): 修復遇到特殊法規章節時分塊邊界截斷問題`
- `docs(glossary): 新增 StudioCompiler 與 RuntimeViewer 術語定義`
- `test(vector): 增加 10,000 筆向量點積極限壓測斷言`
- `refactor(ui): 優化 Bento Grid 儀表板深色卡片對比度`

---

## 4. Pull Request 驗收清單

在送出 PR 前，請確認已勾選：
- [ ] 執行 `npm test`，所有 17+ 項測試綠燈通過。
- [ ] 代碼中無任何 hardcoded 金鑰、本機絕對路徑或敏感個資。
- [ ] 變數名稱與 [GLOSSARY.md](GLOSSARY.md) 完全一致。
- [ ] 產物未破壞單檔 Portable HTML ≤ 15MB 之體積目標。
