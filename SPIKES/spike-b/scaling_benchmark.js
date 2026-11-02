/**
 * ZeroRAG Spike B - Scaling Curve Benchmark
 * Tests 3,000 vs 10,000 chunks across 768 and 1,536 dimensions
 */

const { performance } = require('perf_hooks');

function runTest(count, dim, queryCount = 200, topK = 5) {
  // Generate data
  const flatVectors = new Float32Array(count * dim);
  for (let i = 0; i < count; i++) {
    const offset = i * dim;
    let sumSq = 0;
    for (let d = 0; d < dim; d++) {
      const v = (Math.random() - 0.5) * 2;
      flatVectors[offset + d] = v;
      sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq) || 1e-12;
    for (let d = 0; d < dim; d++) flatVectors[offset + d] /= norm;
  }

  // Generate queries
  const queries = [];
  for (let q = 0; q < queryCount; q++) {
    const qVec = new Float32Array(dim);
    let sumSq = 0;
    for (let d = 0; d < dim; d++) {
      const v = (Math.random() - 0.5) * 2;
      qVec[d] = v;
      sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq) || 1e-12;
    for (let d = 0; d < dim; d++) qVec[d] /= norm;
    queries.push(qVec);
  }

  // Search Kernel
  function search(query) {
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
    return topIndices;
  }

  // Warmup
  for (let w = 0; w < 20; w++) search(queries[w]);

  // Measure
  const durations = new Float64Array(queryCount);
  const tStart = performance.now();
  for (let q = 0; q < queryCount; q++) {
    const t0 = performance.now();
    search(queries[q]);
    durations[q] = performance.now() - t0;
  }
  const totalMs = performance.now() - tStart;

  const sorted = Array.from(durations).sort((a, b) => a - b);
  const p = (pct) => sorted[Math.floor(sorted.length * pct)];

  return {
    count,
    dim,
    sizeMB: (flatVectors.byteLength / (1024 * 1024)).toFixed(2),
    p50: p(0.50).toFixed(2),
    p95: p(0.95).toFixed(2),
    p99: p(0.99).toFixed(2),
    qps: (queryCount / (totalMs / 1000)).toFixed(0)
  };
}

const configs = [
  [3000, 768],
  [3000, 1536],
  [10000, 768],
  [10000, 1536]
];

console.log(`Running Scaling Benchmarks...`);
const results = configs.map(([c, d]) => {
  const r = runTest(c, d);
  console.log(`${c} Chunks × ${d} Dims (${r.sizeMB} MB) -> P50: ${r.p50}ms | P95: ${r.p95}ms | P99: ${r.p99}ms | QPS: ${r.qps}`);
  return r;
});

const fs = require('fs');
fs.writeFileSync(__dirname + '/scaling_results.json', JSON.stringify(results, null, 2));
