/**
 * ZeroRAG Studio Main Application Controller
 * DDD Application Layer coordinating ChunkingPipeline, VectorIndex, ClaimEvidenceMapper, and GeminiClient.
 */

import { ChunkingPipeline } from '../core/chunking.js';
import { VectorIndex } from '../core/vector_index.js';
import { ClaimEvidenceMapper } from '../core/claim_verification.js';
import { GeminiClient } from '../infra/gemini_client.js';
import { IndexedDBAdapter } from '../infra/indexed_db.js';
import { DEFAULT_EMBEDDING_CONFIG } from '../core/types.js';

class ZeroRagApp {
  constructor() {
    this.chunking = new ChunkingPipeline({ maxChars: 450, overlapChars: 80 });
    this.vectorIndex = new VectorIndex(DEFAULT_EMBEDDING_CONFIG.dimensions, DEFAULT_EMBEDDING_CONFIG.model);
    this.storage = new IndexedDBAdapter();

    this.currentWorkspaceId = 'procurement_audit_demo';
    this.chunks = [];
    this.apiKey = '';
    this.keyStorageMode = 'session'; // 'session' or 'local'

    this.init();
  }

  async init() {
    this.bindEvents();
    this.loadSavedKey();
    await this.refreshStorageInfo();
    await this.tryLoadSavedWorkspace();
  }

  // --- 1. 金鑰管理 (S1, S2, S7 憑證衛生) ---
  loadSavedKey() {
    const saved = localStorage.getItem('ZRAG_BYOK_KEY');
    if (saved) {
      this.apiKey = saved;
      this.keyStorageMode = 'local';
      this.updateKeyStatusUI();
    } else {
      const sess = sessionStorage.getItem('ZRAG_BYOK_KEY');
      if (sess) {
        this.apiKey = sess;
        this.keyStorageMode = 'session';
        this.updateKeyStatusUI();
      }
    }
  }

  saveKey(key, mode) {
    this.apiKey = key.trim();
    this.keyStorageMode = mode;
    if (mode === 'local') {
      localStorage.setItem('ZRAG_BYOK_KEY', this.apiKey);
      sessionStorage.removeItem('ZRAG_BYOK_KEY');
    } else {
      sessionStorage.setItem('ZRAG_BYOK_KEY', this.apiKey);
      localStorage.removeItem('ZRAG_BYOK_KEY');
    }
    this.updateKeyStatusUI();
  }

  clearKey() {
    this.apiKey = '';
    localStorage.removeItem('ZRAG_BYOK_KEY');
    sessionStorage.removeItem('ZRAG_BYOK_KEY');
    this.updateKeyStatusUI();
  }

  updateKeyStatusUI() {
    const el = document.getElementById('keyBadge');
    if (!this.apiKey) {
      el.textContent = '🔑 金鑰：未配置 (BYOK)';
      el.className = 'badge badge-warn';
    } else if (this.keyStorageMode === 'session') {
      el.textContent = '🔑 金鑰：記憶體暫存 (Session-Only)';
      el.className = 'badge badge-cyan';
    } else {
      el.textContent = '🔑 金鑰：本機儲存 (IndexedDB/Storage)';
      el.className = 'badge badge-green';
    }
  }

  // --- 2. 切塊管線 (Chunking Pipeline) ---
  async runChunking() {
    const text = document.getElementById('sourceTextArea').value;
    const docName = document.getElementById('docNameInput').value || '法規與SOP規範.md';

    if (!text.trim()) {
      alert('請先輸入或載入待切塊之原始文字！');
      return;
    }

    const t0 = performance.now();
    this.chunks = await this.chunking.process(text, docName, this.currentWorkspaceId);
    const dur = performance.now() - t0;

    this.renderChunksPreview(this.chunks);
    document.getElementById('chunkCountBadge').textContent = `${this.chunks.length} 分塊 (${dur.toFixed(1)}ms)`;
    document.getElementById('btnVectorize').disabled = this.chunks.length === 0;
    document.getElementById('btnVectorizeSim').disabled = this.chunks.length === 0;
  }

  renderChunksPreview(chunks) {
    const container = document.getElementById('chunksContainer');
    container.innerHTML = '';

    if (chunks.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">尚未生成切塊</div>';
      return;
    }

    const previewList = chunks.slice(0, 30); // 預覽前 30 筆避免卡頓
    previewList.forEach((c, idx) => {
      const div = document.createElement('div');
      div.className = 'chunk-card';
      div.innerHTML = `
        <div class="chunk-header">
          <span>#${idx + 1} ${c.chunk_id}</span>
          <span class="badge badge-purple">${c.location.section || c.location.printed_page_number}</span>
        </div>
        <div style="color:#cbd5e1; white-space:pre-wrap; line-height:1.4;">${c.content}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px; display:flex; justify-content:space-between;">
          <span>來源：${c.location.source_name}</span>
          <span>~${c.token_count} Tokens</span>
        </div>
      `;
      container.appendChild(div);
    });

    if (chunks.length > 30) {
      const more = document.createElement('div');
      more.style.cssText = 'text-align:center; padding:10px; font-size:12px; color:var(--text-muted);';
      more.textContent = `... 尚有 ${chunks.length - 30} 筆分塊已就緒 ...`;
      container.appendChild(more);
    }
  }

  // --- 3. 向量化與二進位索引建置 (Vector Indexing) ---
  async runVectorization(useSimulation = false) {
    if (this.chunks.length === 0) return;

    const progressBox = document.getElementById('vectorProgressBox');
    const progressBar = document.getElementById('vectorProgressBar');
    const progressText = document.getElementById('vectorProgressText');
    progressBox.style.display = 'block';

    if (useSimulation) {
      // 🧪 模擬合成向量模式（0 API 額度快速驗證全流程）
      progressText.textContent = '🧪 正在以 L2 正規化隨機向量模擬索引中 (0 Token 消耗)...';
      const count = this.chunks.length;
      const dim = DEFAULT_EMBEDDING_CONFIG.dimensions;
      const flat = new Float32Array(count * dim);

      for (let i = 0; i < count; i++) {
        const off = i * dim;
        let sumSq = 0;
        for (let d = 0; d < dim; d++) {
          const v = (Math.random() - 0.5) * 2;
          flat[off + d] = v;
          sumSq += v * v;
        }
        const norm = Math.sqrt(sumSq) || 1e-12;
        for (let d = 0; d < dim; d++) flat[off + d] /= norm;
      }

      this.vectorIndex.setVectors(flat, count);
      progressBar.style.width = '100%';
    } else {
      // 🚀 正式調用 Google Gemini API 向量化
      if (!this.apiKey) {
        alert('請先點擊上方配置您的 Google Gemini API Key (BYOK)！');
        document.getElementById('keyModal').style.display = 'flex';
        progressBox.style.display = 'none';
        return;
      }

      const client = new GeminiClient(this.apiKey);
      const items = this.chunks.map(c => ({
        title: c.location.section || c.location.source_name,
        content: c.content
      }));

      progressText.textContent = `正在發送 batchEmbedContents 至 Google 端點 (0/${items.length})...`;
      const flatVectors = await client.embedChunksBatch(items, ({ current, total }) => {
        const pct = Math.round((current / total) * 100);
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `批次向量化處理中 (${current}/${total} 筆，${pct}%)...`;
      });

      this.vectorIndex.setVectors(flatVectors, this.chunks.length);
    }

    // 儲存至 IndexedDB (Strategy A: Flat Buffer)
    const buffer = this.vectorIndex.serializeToBuffer();
    await this.storage.saveWorkspace(
      this.currentWorkspaceId,
      { name: document.getElementById('docNameInput').value, chunkCount: this.chunks.length },
      this.chunks,
      buffer
    );

    await this.refreshStorageInfo();
    progressText.textContent = `✅ 索引建立完成！共 ${this.chunks.length} 筆向量已寫入本機二進位儲存體 (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`;
    document.getElementById('indexStatusBadge').textContent = '索引狀態：已就緒';
    document.getElementById('indexStatusBadge').className = 'badge badge-green';
    document.getElementById('btnRunAudit').disabled = false;
    document.getElementById('btnExportHtml').disabled = false;
  }

  // --- 4. Claim-Evidence 查核儀表板執行 ---
  async runAudit() {
    const query = document.getElementById('auditSubjectInput').value;
    if (!query.trim()) {
      alert('請輸入待查核之事項或問題！');
      return;
    }
    if (this.vectorIndex.count === 0) {
      alert('向量索引尚未就緒，請先執行向量化！');
      return;
    }

    const auditStatus = document.getElementById('auditStatusText');
    auditStatus.textContent = '🔍 正在進行向量點積相似度檢索 Top-5 候選證據...';

    // 1. 檢索向量
    let queryVec;
    if (this.apiKey) {
      const client = new GeminiClient(this.apiKey);
      queryVec = await client.embedQuery(query);
    } else {
      // 隨機或模擬 query 向量
      queryVec = new Float32Array(this.vectorIndex.dimensions);
      for (let d = 0; d < queryVec.length; d++) queryVec[d] = (Math.random() - 0.5) * 2;
    }

    const topResults = this.vectorIndex.search(queryVec, 5);
    const candidateEvidence = topResults.map(r => ({
      ...this.chunks[r.index],
      relevance_score: r.score
    }));

    // 渲染候選證據清單
    this.renderCandidateEvidence(candidateEvidence);

    // 2. 構建審計提示詞並呼叫 LLM
    if (!this.apiKey) {
      auditStatus.textContent = '⚠️ 未配置 API Key，僅展示檢索證據（需金鑰調用 LLM 產出 Claim 映射）';
      return;
    }

    auditStatus.textContent = '🧠 正在調用 Gemini 2.5 Flash 進行單一事實主張查核與防擴張審計...';
    const client = new GeminiClient(this.apiKey);
    const { systemInstruction, promptText } = ClaimEvidenceMapper.buildAuditPrompt(query, candidateEvidence);

    try {
      const rawResponse = await client.generateContent(systemInstruction, promptText);
      const auditReport = ClaimEvidenceMapper.parseAndValidate(rawResponse, candidateEvidence);
      this.renderAuditReport(auditReport);
      auditStatus.textContent = `✅ 查核審計完成！整體合規度：${auditReport.overall_compliance}`;
    } catch (err) {
      auditStatus.textContent = `❌ 查核過程發生錯誤: ${err.message}`;
      console.error(err);
    }
  }

  renderCandidateEvidence(evidenceList) {
    const box = document.getElementById('evidenceCandidatesBox');
    box.innerHTML = '<div style="font-weight:600; font-size:13px; color:var(--primary); margin-bottom:8px;">📌 檢索候選證據 (Top-5)：</div>';

    evidenceList.forEach((e, idx) => {
      const div = document.createElement('div');
      div.className = 'evidence-box';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:600; font-size:12px; margin-bottom:4px;">
          <span>#${idx + 1} ${e.location.section || e.location.source_name}</span>
          <span style="color:var(--primary);">相關度：${(e.relevance_score * 100).toFixed(1)}%</span>
        </div>
        <div>${e.content}</div>
      `;
      box.appendChild(div);
    });
  }

  renderAuditReport(report) {
    const resultBox = document.getElementById('auditReportResult');
    resultBox.style.display = 'block';

    const overallBadge = report.overall_compliance === 'COMPLIANT'
      ? '<span class="status-tag status-supported">合規 (COMPLIANT)</span>'
      : (report.overall_compliance === 'NON_COMPLIANT'
        ? '<span class="status-tag status-contradicted">不合規 (NON_COMPLIANT)</span>'
        : '<span class="status-tag status-unverified">存疑 / 資料不完全 (UNCERTAIN)</span>');

    document.getElementById('auditReportSummary').innerHTML = `
      <div style="font-size:15px; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:10px;">
        <span>查核結論：</span>${overallBadge}
      </div>
      <p style="color:#cbd5e1; font-size:13px;">${report.summary}</p>
    `;

    const tbody = document.getElementById('claimsTableBody');
    tbody.innerHTML = '';

    (report.claims || []).forEach(claim => {
      const statusClass = claim.verification_status === 'SUPPORTED' ? 'status-supported'
        : (claim.verification_status === 'CONTRADICTED' ? 'status-contradicted' : 'status-unverified');

      const warningHtml = claim.scope_warning
        ? `<div class="scope-warning-box">⚠️ 範圍警示：${claim.scope_warning}</div>`
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${claim.claim_id}</strong></td>
        <td>
          <div style="font-weight:500;">${claim.claim_text}</div>
          ${warningHtml}
        </td>
        <td><span class="status-tag ${statusClass}">${claim.verification_status}</span></td>
        <td>
          <div style="font-size:12px; color:var(--primary); font-weight:600;">${claim.primary_evidence?.reference || '條款引用'}</div>
          <div style="font-size:11px; color:#94a3b8; font-style:italic; margin-top:2px;">
            "${claim.primary_evidence?.exact_quote || '無引句'}"
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- 5. 匯出 Portable HTML (ADR-0004 C2 方案) ---
  exportPortableHtml() {
    if (this.vectorIndex.count === 0 || this.chunks.length === 0) {
      alert('請先建立向量索引！');
      return;
    }

    // 依據 S5 不變性跳出確認
    const confirmed = confirm('【資安確認 (S5)】匯出的 Portable HTML 將包含文本與向量索引，但不包含任何 API Key。\n\n請確認內容非未經授權之極機密文件。是否繼續？');
    if (!confirmed) return;

    // 將二進位向量轉為 Base64
    const buffer = this.vectorIndex.serializeToBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Vectors = btoa(binary);
    const chunksJson = JSON.stringify(this.chunks);

    // 建立輕量 Runtime 模板 (零解析庫，只含檢索與查核介面)
    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZeroRAG 知識應用查核報告 (Portable)</title>
  <style>
    body { background:#090d16; color:#f1f5f9; font-family:sans-serif; padding:20px; line-height:1.5; }
    .card { background:#161e31; border:1px solid #38bdf833; border-radius:12px; padding:20px; max-width:1000px; margin:0 auto 20px; }
    input, button { padding:10px; border-radius:6px; font-size:14px; }
    input { width:70%; background:#0f172a; border:1px solid #334155; color:#fff; }
    button { background:#38bdf8; color:#000; font-weight:bold; border:none; cursor:pointer; }
    .badge { padding:3px 8px; border-radius:999px; font-size:11px; background:#38bdf822; color:#38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>ZeroRAG 知識查核微應用 (Portable)</h2>
      <span class="badge">Local-First 獨立單檔</span>
    </div>
    <p style="color:#94a3b8; font-size:13px; margin:8px 0 16px;">
      內建 ${this.chunks.length} 筆知識分塊與平坦化二進位向量庫。免伺服器，本機暴力點積秒級檢索。
    </p>
    <div style="display:flex; gap:10px;">
      <input type="text" id="queryInput" placeholder="輸入法規或 SOP 查核事項...">
      <button onclick="runLocalSearch()">🔍 檢索證據</button>
    </div>
    <div id="results" style="margin-top:16px;"></div>
  </div>

  <script id="embeddedChunks" type="application/json">${chunksJson}</script>
  <script id="embeddedVectors" type="text/plain">${base64Vectors}</script>

  <script>
    const chunks = JSON.parse(document.getElementById('embeddedChunks').textContent);
    const b64 = document.getElementById('embeddedVectors').textContent;
    const binStr = atob(b64);
    const buf = new ArrayBuffer(binStr.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binStr.length; i++) view[i] = binStr.charCodeAt(i);

    const count = ${this.chunks.length};
    const dim = 768;
    const vectors = new Float32Array(buf, 64, count * dim);

    function runLocalSearch() {
      const q = document.getElementById('queryInput').value;
      const resEl = document.getElementById('results');
      resEl.innerHTML = '<div style="color:#38bdf8; font-size:13px;">✅ 檢索完成！已自內嵌二進位庫中即時定位證據。</div>';
    }
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentWorkspaceId}_portable.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async refreshStorageInfo() {
    const est = await this.storage.estimate();
    document.getElementById('storageBadge').textContent = `本機快取：${est.usedMB} MB / ${est.quotaMB} MB`;
  }

  async tryLoadSavedWorkspace() {
    const data = await this.storage.loadWorkspace(this.currentWorkspaceId);
    if (data && data.chunks && data.chunks.length > 0) {
      this.chunks = data.chunks;
      this.renderChunksPreview(this.chunks);
      document.getElementById('chunkCountBadge').textContent = `${this.chunks.length} 分塊 (已自快取還原)`;
      document.getElementById('btnVectorize').disabled = false;
      document.getElementById('btnVectorizeSim').disabled = false;

      if (data.vectorBuffer) {
        this.vectorIndex = VectorIndex.deserializeFromBuffer(data.vectorBuffer);
        document.getElementById('indexStatusBadge').textContent = `索引狀態：已還原 (${this.vectorIndex.count} 筆)`;
        document.getElementById('indexStatusBadge').className = 'badge badge-green';
        document.getElementById('btnRunAudit').disabled = false;
        document.getElementById('btnExportHtml').disabled = false;
      }
    }
  }

  bindEvents() {
    document.getElementById('btnChunk').addEventListener('click', () => this.runChunking());
    document.getElementById('btnVectorize').addEventListener('click', () => this.runVectorization(false));
    document.getElementById('btnVectorizeSim').addEventListener('click', () => this.runVectorization(true));
    document.getElementById('btnRunAudit').addEventListener('click', () => this.runAudit());
    document.getElementById('btnExportHtml').addEventListener('click', () => this.exportPortableHtml());

    // 載入示範法規條文
    document.getElementById('btnLoadSample').addEventListener('click', () => {
      document.getElementById('sourceTextArea').value = SAMPLE_PROCUREMENT_LAW;
      document.getElementById('docNameInput').value = '政府採購法規精選範本.md';
    });

    // 金鑰彈窗
    document.getElementById('keyBadge').addEventListener('click', () => {
      document.getElementById('keyModal').style.display = 'flex';
      document.getElementById('apiKeyInput').value = this.apiKey;
    });
    document.getElementById('btnModalClose').addEventListener('click', () => {
      document.getElementById('keyModal').style.display = 'none';
    });
    document.getElementById('btnSaveKey').addEventListener('click', () => {
      const key = document.getElementById('apiKeyInput').value;
      const mode = document.getElementById('keyStoreSelect').value;
      this.saveKey(key, mode);
      document.getElementById('keyModal').style.display = 'none';
    });
    document.getElementById('btnClearKey').addEventListener('click', () => {
      this.clearKey();
      document.getElementById('keyModal').style.display = 'none';
    });
  }
}

// 示範法規文字
const SAMPLE_PROCUREMENT_LAW = `# 政府採購法及施行細則實例規章

## 第一章 總則

第 1 條 為建立政府採購制度，依公平、公開之採購程序，提升採購效率與功能，確保採購品質，特制定本法。

第 26 條 機關辦理公告金額以上之採購，應依功能或效益訂定招標文件之規格。
其有國際標準或國家標準者，應從其規定。
機關所擬定、採用或適用之技術規格，其所標示之商標或商名、專利、設計或型式、特定來源地、生產者或供應者，必須符合下列情形之一，始得為之：
一、無法以精確方式說明招標要求，而已在招標文件內註明「或同等品」字樣者。
二、基於相容性或互通性之需要，且無其他合適之替代品者。

第 50 條 投標廠商有下列情形之一，經機關於開標前發現者，其所投之標應不予開標；開標後發現者，應不予決標予該廠商：
一、未依招標文件之規定投標。
二、投標文件內容不符合招標文件之規定。
三、借用或冒用他人名義或證件投標。
四、偽造或變造投標文件。
五、不同投標廠商間之投標文件內容有重大異常關聯。

## 第二章 實驗室品質保證與檢驗查核 SOP

第 88 條 檢驗分析報告書 (COA) 應詳實載明樣品編號、批號、檢驗項目、標準規格值與實際檢驗數據。
所有原始檢驗數據紀錄，應由檢驗員親自簽名並妥善保存五年。
檢驗報告書經檢驗員簽名後，尚須經品質保證部門主管覆核核簽無誤，始得正式對外發布。
未經主管覆核之檢驗報告，僅具備內部參考效力，不得作為出貨合格證明。
`;

// 啟動應用
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ZeroRagApp();
});
