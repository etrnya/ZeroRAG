/**
 * ZeroRAG Spike B - V8 Engine In-Memory Vector Retrieval Microbenchmark
 * Measures Float32Array 3000 x 768 brute-force dot product Top-K latency distribution.
 */

const fs = require('fs');
const { performance } = require('perf_hooks');

const COUNT = 3000;
const DIM = 768;
const QUERY_COUNT = 1000;
const TOP_K = 5;

console.log(`[ZeroRAG Spike B] Initializing V8 Engine Vector Benchmark...`);
console.log(`Dataset: ${COUNT.toLocaleString()} chunks × ${DIM} dimensions (Float32)`);
console.log(`Queries: ${QUERY_COUNT.toLocaleString()} random normalized vectors, Top-${TOP_K}`);

// 1. Generate L2-normalized vectors
const tGenStart = performance.now();
const flatVectors = new Float32Array(COUNT * DIM);
for (let i = 0; i < COUNT; i++) {
  const offset = i * DIM;
  let sumSq = 0;
  for (let d = 0; d < DIM; d++) {
    const val = (Math.random() - 0.5) * 2;
    flatVectors[offset + d] = val;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1e-12;
  for (let d = 0; d < DIM; d++) {
    flatVectors[offset + d] /= norm;
  }
}
const genDur = performance.now() - tGenStart;
const rawSizeMB = (flatVectors.byteLength / (1024 * 1024)).toFixed(2);
console.log(`✅ Generated in ${genDur.toFixed(1)}ms | Binary Size: ${rawSizeMB} MB (${flatVectors.byteLength} bytes)`);

// 2. Generate Queries
const queries = [];
for (let q = 0; q < QUERY_COUNT; q++) {
  const qVec = new Float32Array(DIM);
  let sumSq = 0;
  for (let d = 0; d < DIM; d++) {
    const val = (Math.random() - 0.5) * 2;
    qVec[d] = val;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1e-12;
  for (let d = 0; d < DIM; d++) {
    qVec[d] /= norm;
  }
  queries.push(qVec);
}

// 3. Search Kernel (Loop unrolled dot product + sorted Top-K)
function searchKernel(flatVectors, count, dim, query, topK) {
  const topIndices = new Int32Array(topK);
  const topScores = new Float32Array(topK);
  for (let k = 0; k < topK; k++) {
    topIndices[k] = -1;
    topScores[k] = -1e9;
  }

  const unrollLimit = dim - 3;
  for (let i = 0; i < count; i++) {
    const offset = i * dim;
    let dot = 0.0;
    let d = 0;
    for (; d < unrollLimit; d += 4) {
      dot += query[d] * flatVectors[offset + d]
           + query[d + 1] * flatVectors[offset + d + 1]
           + query[d + 2] * flatVectors[offset + d + 2]
           + query[d + 3] * flatVectors[offset + d + 3];
    }
    for (; d < dim; d++) {
      dot += query[d] * flatVectors[offset + d];
    }

    if (dot > topScores[topK - 1]) {
      let pos = topK - 1;
      while (pos > 0 && dot > topScores[pos - 1]) {
        topScores[pos] = topScores[pos - 1];
        topIndices[pos] = topIndices[pos - 1];
        pos--;
      }
      topScores[pos] = dot;
      topIndices[pos] = i;
    }
  }

  return { indices: topIndices, scores: topScores };
}

// Warm-up JIT
for (let w = 0; w < 50; w++) {
  searchKernel(flatVectors, COUNT, DIM, queries[w], TOP_K);
}

// 4. Run Benchmark
console.log(`Starting ${QUERY_COUNT} search queries benchmark...`);
const durations = new Float64Array(QUERY_COUNT);
const tBenchStart = performance.now();

for (let q = 0; q < QUERY_COUNT; q++) {
  const t0 = performance.now();
  searchKernel(flatVectors, COUNT, DIM, queries[q], TOP_K);
  durations[q] = performance.now() - t0;
}
const totalBenchDur = performance.now() - tBenchStart;

// 5. Compute Percentiles
const sorted = Array.from(durations).sort((a, b) => a - b);
const p = (pct) => sorted[Math.floor(sorted.length * pct)];
const sum = sorted.reduce((a, b) => a + b, 0);

const stats = {
  count: COUNT,
  dim: DIM,
  queryCount: QUERY_COUNT,
  rawSizeMB,
  totalDurMs: totalBenchDur.toFixed(1),
  qps: (QUERY_COUNT / (totalBenchDur / 1000)).toFixed(0),
  min: sorted[0].toFixed(3),
  p50: p(0.50).toFixed(3),
  p90: p(0.90).toFixed(3),
  p95: p(0.95).toFixed(3),
  p99: p(0.99).toFixed(3),
  max: sorted[sorted.length - 1].toFixed(3),
  mean: (sum / sorted.length).toFixed(3)
};

console.log(`====================================================`);
console.log(`Spike B Retrieval Results (V8 Optimization Engine):`);
console.log(`P50 Latency:  ${stats.p50} ms  (Gate target: < 10.0 ms) -> ${p(0.50) < 10 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`P95 Latency:  ${stats.p95} ms  (Gate target: < 30.0 ms) -> ${p(0.95) < 30 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`P99 Latency:  ${stats.p99} ms  (Gate target: < 50.0 ms) -> ${p(0.99) < 50 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Mean Latency: ${stats.mean} ms | QPS: ${stats.qps}`);
console.log(`====================================================`);

// Output JSON for result integration
fs.writeFileSync(__dirname + '/benchmark_results.json', JSON.stringify(stats, null, 2));
console.log(`Results saved to benchmark_results.json`);
