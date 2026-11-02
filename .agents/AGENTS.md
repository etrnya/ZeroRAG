# ZeroRAG — 專案專屬 AI 開發規則 (Project-level Agent Rules)

> 本檔依全域 AGENTS.md 第 6 條建立。進入本專案時，AI 助理必須先讀這份文件。

## 1. 閱讀順序
1. `GLOSSARY.md`（命名的唯一標準）
2. `SECURITY.md`（S1~S8 不變性）
3. `PRD.md` → `ARCHITECTURE.md` → `ADR/`
4. `ZERO-RAG-TECHNICAL-SPIKE.md` 與 `PRD_v1.1.1_ERRATA.md`（目前進度與已知問題）

## 2. 目前階段：Phase 0.5（Technical Spike）
- v1.1.0 規格文件**已凍結**。不得直接修改 PRD / ARCHITECTURE / SECURITY / GLOSSARY；發現的問題一律寫進 `PRD_v1.1.1_ERRATA.md`。
- **`src/` 在 Spike Gate 通過、使用者核准之前不得建立。**
- Spike 程式碼只能放在 `SPIKES/<spike-id>/`，屬於拋棄式程式碼，不得搬進 `src/`。

## 3. Spike Gate 規則
- **沒有通過 Spike 的技術假設，不得寫入 Core。**
- 未驗證的效能數字、檔案大小、瀏覽器相容性，一律標成「目標值」或「待驗證」，不得寫成既成事實。
- 外部事實（模型名稱、停用日期、Google 資料條款）必須附官方連結與查閱日期。

## 4. 安全鐵律（摘要，完整內容見 SECURITY.md）
- **S1**：任何匯出產物（HTML / .ragpack）都不得包含 API Key。
- **S2**：任何檔案、任何 commit 都不得出現 API Key。金鑰只能在執行時輸入。
- **S8**：LLM 產出的內容不得直接寫進 `innerHTML`，必須先經過 Schema 驗證與 DOMPurify。
- Spike 與測試只能使用**公開資料或合成資料**。

## 5. Windows 環境防坑（繼承全域經驗）
- PowerShell 5.1 不支援 `&&`，請用 `;` 串接指令。
- 刪除、複製、移動檔案一律使用 `-LiteralPath`。
- Python 腳本開頭加上 `sys.stdout.reconfigure(encoding='utf-8')`。
- `.bat` 檔以 CP950 + CRLF 寫入。
