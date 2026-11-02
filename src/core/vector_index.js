/**
 * ZeroRAG Vector Index
 * Pure JavaScript in-memory binary vector index with loop-unrolled dot-product Top-K retrieval.
 */

import { MAGIC_HEADER, HEADER_SIZE_BYTES } from './types.js';

export class VectorIndex {
  /**
   * @param {number} [dimensions=768]
   * @param {string} [modelId="gemini-embedding-2"]
   */
  constructor(dimensions = 768, modelId = 'gemini-embedding-2') {
    this.dimensions = dimensions;
    this.modelId = modelId;
    this.count = 0;
    /** @type {Float32Array | null} */
    this.flatVectors = null;
  }

  /**
   * Load or replace vector buffer
   * @param {Float32Array} flatBuffer - Flat Float32Array of length count * dimensions
   * @param {number} count - Number of vectors
   */
  setVectors(flatBuffer, count) {
    if (flatBuffer.length !== count * this.dimensions) {
      throw new Error(`Buffer size mismatch: expected ${count * this.dimensions}, got ${flatBuffer.length}`);
    }
    this.flatVectors = flatBuffer;
    this.count = count;
  }

  /**
   * Appends new batch of vectors
   * @param {Float32Array} newBatch - Flat array of newly generated vectors
   * @param {number} batchCount
   */
  appendBatch(newBatch, batchCount) {
    const newTotalCount = this.count + batchCount;
    const newFlat = new Float32Array(newTotalCount * this.dimensions);
    if (this.flatVectors && this.count > 0) {
      newFlat.set(this.flatVectors, 0);
    }
    newFlat.set(newBatch, this.count * this.dimensions);
    this.flatVectors = newFlat;
    this.count = newTotalCount;
  }

  /**
   * Brute-Force Dot-Product Top-K Retrieval
   * Assumption: Vectors are L2 normalized, so Dot Product == Cosine Similarity.
   * @param {Float32Array | number[]} queryVector
   * @param {number} [topK=5]
   * @param {number} [minScore=0.0]
   * @returns {Array<{ index: number, score: number }>}
   */
  search(queryVector, topK = 5, minScore = 0.0) {
    if (!this.flatVectors || this.count === 0) return [];

    const query = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const k = Math.min(topK, this.count);
    const dim = this.dimensions;
    const len = this.count;
    const flat = this.flatVectors;

    const topIndices = new Int32Array(k);
    const topScores = new Float32Array(k);
    for (let i = 0; i < k; i++) {
      topIndices[i] = -1;
      topScores[i] = -1e9;
    }

    const unrollLimit = dim - 3;

    for (let i = 0; i < len; i++) {
      const offset = i * dim;
      let dot = 0.0;
      let d = 0;

      // Loop unrolled by 4 for V8 JIT & SIMD optimization
      for (; d < unrollLimit; d += 4) {
        dot += query[d] * flat[offset + d]
             + query[d + 1] * flat[offset + d + 1]
             + query[d + 2] * flat[offset + d + 2]
             + query[d + 3] * flat[offset + d + 3];
      }
      for (; d < dim; d++) {
        dot += query[d] * flat[offset + d];
      }

      if (dot > topScores[k - 1] && dot >= minScore) {
        let pos = k - 1;
        while (pos > 0 && dot > topScores[pos - 1]) {
          topScores[pos] = topScores[pos - 1];
          topIndices[pos] = topIndices[pos - 1];
          pos--;
        }
        topScores[pos] = dot;
        topIndices[pos] = i;
      }
    }

    const results = [];
    for (let i = 0; i < k; i++) {
      if (topIndices[i] !== -1) {
        results.push({ index: topIndices[i], score: topScores[i] });
      }
    }
    return results;
  }

  /**
   * Serialize in-memory index into 64-byte Header + Little-Endian Float32 ArrayBuffer
   * @returns {ArrayBuffer}
   */
  serializeToBuffer() {
    if (!this.flatVectors) throw new Error('No vectors to serialize');

    const totalBytes = HEADER_SIZE_BYTES + this.flatVectors.byteLength;
    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);

    // Byte 0~3: Magic 'ZRAG'
    view.setUint8(0, 0x5a); // 'Z'
    view.setUint8(1, 0x52); // 'R'
    view.setUint8(2, 0x41); // 'A'
    view.setUint8(3, 0x47); // 'G'

    // Byte 4~5: Version 0x0001
    view.setUint16(4, 1, true);

    // Byte 6~7: Dimensions
    view.setUint16(6, this.dimensions, true);

    // Byte 8~11: Vector Count
    view.setUint32(8, this.count, true);

    // Byte 12~43: Model ID ASCII string
    const enc = new TextEncoder().encode(this.modelId.slice(0, 31));
    const byteArr = new Uint8Array(buffer, 12, 32);
    byteArr.set(enc);

    // Byte 64 ~ Payload: Copy Float32 data
    const payloadFloats = new Float32Array(buffer, HEADER_SIZE_BYTES, this.count * this.dimensions);
    payloadFloats.set(this.flatVectors);

    return buffer;
  }

  /**
   * Deserialize from ArrayBuffer with zero-copy Float32 view
   * @param {ArrayBuffer} buffer
   * @returns {VectorIndex}
   */
  static deserializeFromBuffer(buffer) {
    if (buffer.byteLength < HEADER_SIZE_BYTES) {
      throw new Error(`Invalid buffer: smaller than 64-byte header`);
    }

    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== MAGIC_HEADER) {
      throw new Error(`Magic mismatch: expected '${MAGIC_HEADER}', got '${magic}'`);
    }

    const version = view.getUint16(4, true);
    const dimensions = view.getUint16(6, true);
    const count = view.getUint32(8, true);

    const modelBytes = new Uint8Array(buffer, 12, 32);
    let modelId = '';
    for (let i = 0; i < modelBytes.length; i++) {
      if (modelBytes[i] === 0) break;
      modelId += String.fromCharCode(modelBytes[i]);
    }

    const expectedPayloadBytes = count * dimensions * 4;
    if (buffer.byteLength < HEADER_SIZE_BYTES + expectedPayloadBytes) {
      throw new Error(`Corrupted buffer: truncated payload`);
    }

    const index = new VectorIndex(dimensions, modelId);
    // Zero-copy view directly into buffer offset 64
    const floats = new Float32Array(buffer, HEADER_SIZE_BYTES, count * dimensions);
    index.setVectors(floats, count);
    return index;
  }
}
