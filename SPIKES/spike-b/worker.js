/**
 * ZeroRAG Spike B - Vector Retrieval Worker
 * Dedicated Web Worker for In-Memory Brute Force Cosine / Dot-Product Top-K Retrieval
 */

let vectorBuffer = null;      // Flat Float32Array
let chunkCount = 0;
let dimensions = 768;

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    // payload: { buffer: ArrayBuffer, count: number, dimensions: number }
    chunkCount = payload.count;
    dimensions = payload.dimensions;
    vectorBuffer = new Float32Array(payload.buffer);
    self.postMessage({ type: 'INIT_DONE', success: true, count: chunkCount, dimensions });
  } else if (type === 'SEARCH') {
    // payload: { queryVector: Float32Array or Array, topK: number, queryId?: number }
    if (!vectorBuffer) {
      self.postMessage({ type: 'SEARCH_ERROR', error: 'Worker not initialized with vectors' });
      return;
    }

    const t0 = performance.now();
    const query = payload.queryVector instanceof Float32Array ? payload.queryVector : new Float32Array(payload.queryVector);
    const topK = payload.topK || 5;

    // Vectors are L2 normalized, so Cosine Similarity is equivalent to Dot Product
    // Use a min-heap or a small sorted array for Top-K
    // For small Top-K (<= 10), maintaining a small sorted array of size Top-K is extremely fast
    const topIndices = new Int32Array(topK);
    const topScores = new Float32Array(topK);
    for (let k = 0; k < topK; k++) {
      topIndices[k] = -1;
      topScores[k] = -1e9;
    }

    const dim = dimensions;
    const len = chunkCount;

    for (let i = 0; i < len; i++) {
      const offset = i * dim;
      let dot = 0.0;

      // Unroll loop by 4 for SIMD/JIT optimization
      let d = 0;
      const unrollLimit = dim - 3;
      for (; d < unrollLimit; d += 4) {
        dot += query[d] * vectorBuffer[offset + d]
             + query[d + 1] * vectorBuffer[offset + d + 1]
             + query[d + 2] * vectorBuffer[offset + d + 2]
             + query[d + 3] * vectorBuffer[offset + d + 3];
      }
      for (; d < dim; d++) {
        dot += query[d] * vectorBuffer[offset + d];
      }

      // Check if dot qualifies for topK
      if (dot > topScores[topK - 1]) {
        // Insert into sorted array
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

    const duration = performance.now() - t0;
    const results = [];
    for (let k = 0; k < topK; k++) {
      if (topIndices[k] !== -1) {
        results.push({ index: topIndices[k], score: topScores[k] });
      }
    }

    self.postMessage({
      type: 'SEARCH_RESULT',
      queryId: payload.queryId,
      results,
      duration
    });
  } else if (type === 'BATCH_SEARCH') {
    // Run multiple queries in one batch to measure worker-only loop time without postMessage overhead per query
    const { queries, topK } = payload;
    const queryCount = queries.length;
    const durations = new Float32Array(queryCount);
    const allResults = [];

    const dim = dimensions;
    const len = chunkCount;
    const kVal = topK || 5;

    const tStart = performance.now();

    for (let q = 0; q < queryCount; q++) {
      const t0 = performance.now();
      const query = queries[q] instanceof Float32Array ? queries[q] : new Float32Array(queries[q]);

      const topIndices = new Int32Array(kVal);
      const topScores = new Float32Array(kVal);
      for (let k = 0; k < kVal; k++) {
        topIndices[k] = -1;
        topScores[k] = -1e9;
      }

      for (let i = 0; i < len; i++) {
        const offset = i * dim;
        let dot = 0.0;
        let d = 0;
        const unrollLimit = dim - 3;
        for (; d < unrollLimit; d += 4) {
          dot += query[d] * vectorBuffer[offset + d]
               + query[d + 1] * vectorBuffer[offset + d + 1]
               + query[d + 2] * vectorBuffer[offset + d + 2]
               + query[d + 3] * vectorBuffer[offset + d + 3];
        }
        for (; d < dim; d++) {
          dot += query[d] * vectorBuffer[offset + d];
        }

        if (dot > topScores[kVal - 1]) {
          let pos = kVal - 1;
          while (pos > 0 && dot > topScores[pos - 1]) {
            topScores[pos] = topScores[pos - 1];
            topIndices[pos] = topIndices[pos - 1];
            pos--;
          }
          topScores[pos] = dot;
          topIndices[pos] = i;
        }
      }

      durations[q] = performance.now() - t0;
      if (q === 0) {
        // save sample result
        const res = [];
        for (let k = 0; k < kVal; k++) {
          if (topIndices[k] !== -1) res.push({ index: topIndices[k], score: topScores[k] });
        }
        allResults.push(res);
      }
    }

    const totalBatchDuration = performance.now() - tStart;
    self.postMessage({
      type: 'BATCH_SEARCH_RESULT',
      durations: Array.from(durations),
      totalBatchDuration,
      sampleResult: allResults[0]
    });
  }
};
