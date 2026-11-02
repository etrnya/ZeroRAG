# ADR-0005: 本機向量模型 (Local Embedding / WASM) 作為架構預留 (Architecture Reserved)

## 狀態 (Status)
PROPOSED (架構預留，非 MVP 範圍) - 2026-11-02

## 背景脈絡 (Context)
ZeroRAG 在 L0 傳輸等級中定義了「完全本機離線 (Zero Data Egress)」之願景。然而：
1. **繁體中文專業語意瓶頸**：目前在瀏覽器端透過 WASM/WebGPU 運行的純本機小型嵌入模型（如 Xenova/all-MiniLM-L6-v2 或 bge-small），對臺灣法律條文與專業品保 SOP 之語義理解度遠遜於 `gemini-embedding-2`，極易產出低質量的查核結果。
2. **模型下載體積**：本機模型權重通常介於 50MB~300MB，會徹底摧毀 Portable HTML「體積 ≤ 15MB、秒級載入」的核心承諾。

## 決策 (Decision)
1. **MVP 範圍排除**：V1.0 MVP 專注於提供極致高品質、具備商業查核公信力的 Google AI Studio BYOK (Level 1 / Level 2) 模式。
2. **介面保留**：在 `EmbeddingConfig` 與領域抽象中保留 `provider: "google" | "local_wasm"` 定義，未來待 WebGPU 小型本土模型成熟後，再於 V2.0 作為擴充選項引入，絕不在 MVP 階段引入半成品增加維護包袱。
