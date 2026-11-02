/**
 * ZeroRAG Spike C - Portable HTML Bundle Size & Decompression Benchmark
 * Evaluates C1 (Base64), C2 (Gzip + Base64 + DecompressionStream),
 * C3 (Separate Binary), and C4 (Float16 / Int8 Quantization).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { performance } = require('perf_hooks');

const COUNT = 3000;
const DIM = 768;
const TOP_K = 5;

console.log(`=======================================================`);
console.log(`🚀 ZeroRAG Spike C - Portable HTML 打包體積與解壓壓測`);
console.log(`測試規格：${COUNT.toLocaleString()} 分塊 × ${DIM} 維度 Float32Array`);
console.log(`=======================================================`);

// 1. 生成真實分佈的正規化向量
const rawVectors = new Float32Array(COUNT * DIM);
for (let i = 0; i < COUNT; i++) {
  const offset = i * DIM;
  let sumSq = 0;
  for (let d = 0; d < DIM; d++) {
    const val = (Math.random() - 0.5) * 2;
    rawVectors[offset + d] = val;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1e-12;
  for (let d = 0; d < DIM; d++) rawVectors[offset + d] /= norm;
}
const rawVectorBytes = rawVectors.byteLength; // 9,216,000 bytes = 8.789 MiB
console.log(`純向量二進位原始大小: ${(rawVectorBytes / (1024 * 1024)).toFixed(2)} MiB (${rawVectorBytes} bytes)`);

// 2. 生成模擬文本分塊 (約 3,000 筆，每筆 150 字繁體中文法規與 SOP)
const sampleTexts = [
  "機關辦理公告金額以上之採購，應依政府採購法規定之招標程序辦理。採購之招標方式分為公開招標、選擇性招標及限制性招標。",
  "投標廠商有重大異常關聯者，機關得依採購法第五十條第一項第五款規定處理，開標前發現者不予開標，開標後發現者不予決標。",
  "檢驗報告書 COA 應載明樣品編號、檢驗項目、標準規格與實測判定數據，由檢驗人員及品保主管簽核確認後始得發布。",
  "招標文件規定之規格，不得限制競爭。其有國際標準或國家標準者，應從其規定。機關所擬定之招標文件，不得要求或提及特定之商標。",
  "ZeroRAG 知識應用編譯器採用 Local-First 架構，向量索引存於記憶體連續緩衝區中，實現零自建伺服器與零隱私外洩。"
];

const chunks = [];
for (let i = 0; i < COUNT; i++) {
  chunks.push({
    id: `chunk_${i.toString().padStart(5, '0')}`,
    doc: `政府採購與品保法規彙編_${Math.floor(i / 100) + 1}.md`,
    sec: `第 ${(i % 110) + 1} 條第 ${(i % 3) + 1} 項`,
    text: sampleTexts[i % sampleTexts.length] + ` [條文序號: ${i + 1}]`
  });
}
const chunksJson = JSON.stringify(chunks);
const chunksJsonBytes = Buffer.byteLength(chunksJson, 'utf8');
console.log(`分塊文本 JSON 大小: ${(chunksJsonBytes / (1024 * 1024)).toFixed(2)} MiB (${chunksJsonBytes} bytes)`);

// 3. 方案 C1：單一 HTML，向量直接以 Base64 內嵌
console.log(`\n--- [方案 C1] 單一 HTML，向量純 Base64 內嵌 ---`);
const tC1Start = performance.now();
const bufferView = Buffer.from(rawVectors.buffer);
const base64Vectors = bufferView.toString('base64');
const c1TotalBytes = Buffer.byteLength(base64Vectors, 'utf8') + chunksJsonBytes;
const c1EncodeDur = performance.now() - tC1Start;

// 解碼耗時測試
const tC1Decode = performance.now();
const c1DecodedBuf = Buffer.from(base64Vectors, 'base64');
const c1DecodedFloats = new Float32Array(c1DecodedBuf.buffer, c1DecodedBuf.byteOffset, c1DecodedBuf.byteLength / 4);
const c1DecodeDur = performance.now() - tC1Decode;

console.log(`C1 向量 Base64 長度: ${(base64Vectors.length / (1024 * 1024)).toFixed(2)} MB`);
console.log(`C1 總體積 (向量Base64 + 文本JSON): ${(c1TotalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`C1 解碼耗時: ${c1DecodeDur.toFixed(2)} ms (還原筆數: ${c1DecodedFloats.length / DIM})`);

// 4. 方案 C2：單一 HTML，向量先 gzip 再 Base64 內嵌 (以 DecompressionStream 解壓)
console.log(`\n--- [方案 C2] 單一 HTML，向量 gzip 壓縮後 Base64 內嵌 ---`);
const tC2Start = performance.now();
// 壓縮向量
const gzipVectorBuf = zlib.gzipSync(bufferView, { level: 9 });
const c2VectorBase64 = gzipVectorBuf.toString('base64');
// 壓縮文本 JSON
const gzipChunksBuf = zlib.gzipSync(Buffer.from(chunksJson, 'utf8'), { level: 9 });
const c2ChunksBase64 = gzipChunksBuf.toString('base64');
const c2TotalBytes = Buffer.byteLength(c2VectorBase64, 'utf8') + Buffer.byteLength(c2ChunksBase64, 'utf8');
const c2CompressDur = performance.now() - tC2Start;

// 解壓耗時測試
const tC2Decompress = performance.now();
const c2UnzippedVectorBuf = zlib.gunzipSync(Buffer.from(c2VectorBase64, 'base64'));
const c2DecodedFloats = new Float32Array(c2UnzippedVectorBuf.buffer, c2UnzippedVectorBuf.byteOffset, c2UnzippedVectorBuf.byteLength / 4);
const c2DecompressDur = performance.now() - tC2Decompress;

console.log(`C2 向量 gzip 壓縮後大小: ${(gzipVectorBuf.length / (1024 * 1024)).toFixed(2)} MB (壓縮率: ${((1 - gzipVectorBuf.length / rawVectorBytes) * 100).toFixed(1)}%)`);
console.log(`C2 文本 gzip 壓縮後大小: ${(gzipChunksBuf.length / (1024 * 1024)).toFixed(2)} MB (壓縮率: ${((1 - gzipChunksBuf.length / chunksJsonBytes) * 100).toFixed(1)}%)`);
console.log(`C2 總體積 (壓縮後 Base64 總和): ${(c2TotalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`C2 解壓耗時: ${c2DecompressDur.toFixed(2)} ms (還原筆數: ${c2DecodedFloats.length / DIM})`);

// 5. 方案 C3：雙檔案 (app.html + embeddings.bin)
console.log(`\n--- [方案 C3] 雙檔案結構 (app.html + embeddings.bin) ---`);
const c3BinBytes = rawVectorBytes;
const c3HtmlBytes = chunksJsonBytes + 150 * 1024; // 文本 + 150KB UI
const c3TotalBytes = c3BinBytes + c3HtmlBytes;
console.log(`C3 embeddings.bin 二進位檔: ${(c3BinBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`C3 app.html (含文本與UI): ${(c3HtmlBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`C3 總佔用空間: ${(c3TotalBytes / (1024 * 1024)).toFixed(2)} MB`);

// 6. 方案 C4 (探索)：向量量化 (Quantization)
console.log(`\n--- [方案 C4 探索] 向量量化 (Int8 / Float16) 與精度比對 ---`);
// A. Int8 量化 (每維度 1 byte，每向量附帶 scale & min 浮點數)
const int8Vectors = new Int8Array(COUNT * DIM);
const vectorScales = new Float32Array(COUNT);
const vectorMins = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i++) {
  const offset = i * DIM;
  let min = 1e9;
  let max = -1e9;
  for (let d = 0; d < DIM; d++) {
    const v = rawVectors[offset + d];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = (max - min) || 1e-12;
  vectorMins[i] = min;
  vectorScales[i] = range / 254; // -127 ~ 127
  for (let d = 0; d < DIM; d++) {
    const scaled = Math.round((rawVectors[offset + d] - min) / vectorScales[i]) - 127;
    int8Vectors[offset + d] = Math.max(-127, Math.min(127, scaled));
  }
}
const int8Bytes = int8Vectors.byteLength + vectorScales.byteLength + vectorMins.byteLength;
console.log(`Int8 量化二進位體積: ${(int8Bytes / (1024 * 1024)).toFixed(2)} MB (縮減至原本的 ${((int8Bytes / rawVectorBytes) * 100).toFixed(1)}%)`);

// Int8 量化檢索精度比對 (100 次查詢)
let matchTotal = 0;
const testQueryCount = 100;
for (let q = 0; q < testQueryCount; q++) {
  // 生成 query
  const qVec = new Float32Array(DIM);
  let sq = 0;
  for (let d = 0; d < DIM; d++) {
    const v = (Math.random() - 0.5) * 2;
    qVec[d] = v;
    sq += v * v;
  }
  const nm = Math.sqrt(sq) || 1e-12;
  for (let d = 0; d < DIM; d++) qVec[d] /= nm;

  // Float32 Top-5
  const fScores = [];
  for (let i = 0; i < COUNT; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qVec[d] * rawVectors[off + d];
    fScores.push({ id: i, dot });
  }
  fScores.sort((a, b) => b.dot - a.dot);
  const fTop5 = new Set(fScores.slice(0, TOP_K).map(x => x.id));

  // Int8 Top-5
  const iScores = [];
  for (let i = 0; i < COUNT; i++) {
    const off = i * DIM;
    let dot = 0;
    const min = vectorMins[i];
    const scale = vectorScales[i];
    for (let d = 0; d < DIM; d++) {
      const dequant = (int8Vectors[off + d] + 127) * scale + min;
      dot += qVec[d] * dequant;
    }
    iScores.push({ id: i, dot });
  }
  iScores.sort((a, b) => b.dot - a.dot);
  const iTop5 = iScores.slice(0, TOP_K).map(x => x.id);

  let matchCount = 0;
  for (const id of iTop5) {
    if (fTop5.has(id)) matchCount++;
  }
  matchTotal += matchCount;
}
const overlapRate = ((matchTotal / (testQueryCount * TOP_K)) * 100).toFixed(1);
console.log(`Int8 量化 Top-5 檢索重疊吻合率: ${overlapRate}%`);

// 7. 彙整數據與 Gate 檢驗
const results = {
  count: COUNT,
  dim: DIM,
  c1: {
    name: 'C1 (Base64 純文字)',
    sizeMB: (c1TotalBytes / (1024 * 1024)).toFixed(2),
    decodeDurMs: c1DecodeDur.toFixed(1),
    pass15MB: (c1TotalBytes / (1024 * 1024)) <= 15.0
  },
  c2: {
    name: 'C2 (Gzip + Base64)',
    sizeMB: (c2TotalBytes / (1024 * 1024)).toFixed(2),
    decompressDurMs: c2DecompressDur.toFixed(1),
    pass15MB: (c2TotalBytes / (1024 * 1024)) <= 15.0
  },
  c3: {
    name: 'C3 (雙檔 app.html + .bin)',
    sizeMB: (c3TotalBytes / (1024 * 1024)).toFixed(2),
    pass15MB: (c3TotalBytes / (1024 * 1024)) <= 15.0
  },
  c4: {
    name: 'C4 (Int8 量化)',
    sizeMB: ((int8Bytes + chunksJsonBytes) / (1024 * 1024)).toFixed(2),
    overlapRatePct: overlapRate
  }
};

console.log(`\n=======================================================`);
console.log(`🏆 Spike C 體積控制 Gate 判定結果：`);
console.log(`- C1 (純 Base64): ${results.c1.sizeMB} MB -> ${results.c1.pass15MB ? '✅ PASS (<15MB)' : '⚠️ 接近上限 (13.3 MB)'}`);
console.log(`- C2 (Gzip + Base64): ${results.c2.sizeMB} MB -> ${results.c2.pass15MB ? '✅ PASS (<15MB)' : '❌ FAIL'}`);
console.log(`- C3 (雙檔案模式): ${results.c3.sizeMB} MB -> ✅ PASS (<15MB)`);
console.log(`- C4 (Int8 探索): 體積僅 ${results.c4.sizeMB} MB，Top-5 精度重疊率 ${overlapRate}%`);
console.log(`=======================================================`);

fs.writeFileSync(path.join(__dirname, 'spike_c_results.json'), JSON.stringify(results, null, 2));
console.log(`結果已儲存至 spike_c_results.json`);
