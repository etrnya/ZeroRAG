/**
 * ZeroRAG Gemini Client
 * Pure REST fetch client with strict header-based BYOK, prompt prefix formatting, and exponential backoff.
 * Complies with S1, S2, S6, S7, S8 Invariants.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiClient {
  /**
   * @param {string} apiKey - Google Gemini API Key
   * @param {Object} [options]
   * @param {string} [options.embeddingModel="gemini-embedding-2"]
   * @param {string} [options.chatModel="gemini-2.5-flash"]
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API Key 為必填項目 (BYOK)');
    }
    this.apiKey = apiKey.trim();
    this.embeddingModel = options.embeddingModel || 'gemini-embedding-2';
    this.chatModel = options.chatModel || 'gemini-2.5-flash';
    this.dimensions = 768; // MVP standard
  }

  /**
   * Internal request wrapper with Exponential Backoff + Random Jitter
   */
  async _request(endpoint, body, maxRetries = 3) {
    const url = `${BASE_URL}/${endpoint}`;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey // S1/S2: Never in URL query parameter!
          },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          return await response.json();
        }

        // Handle Rate Limit (429) or Server Overload (503)
        if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
          attempt++;
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 500;
          const delay = baseDelay + jitter;
          console.warn(`[GeminiClient] HTTP ${response.status} 遇阻，正在重試 (${attempt}/${maxRetries}) 等待 ${delay.toFixed(0)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Parse detailed error JSON
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error ? errJson.error.message : response.statusText;
        throw new Error(`Google API 錯誤 (${response.status}): ${errMsg}`);
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  /**
   * Format query according to gemini-embedding-2 prompt prefix convention
   * @param {string} queryText
   * @returns {string}
   */
  static formatQueryPrefix(queryText) {
    return `task: question answering | query: ${queryText.trim()}`;
  }

  /**
   * Format document chunk according to gemini-embedding-2 prompt prefix convention
   * @param {string} title
   * @param {string} chunkContent
   * @returns {string}
   */
  static formatDocumentPrefix(title, chunkContent) {
    const cleanTitle = (title || 'none').trim();
    return `title: ${cleanTitle} | text: ${chunkContent.trim()}`;
  }

  /**
   * Embed a single query vector
   * @param {string} queryText
   * @returns {Promise<Float32Array>}
   */
  async embedQuery(queryText) {
    const formatted = GeminiClient.formatQueryPrefix(queryText);
    const body = {
      model: `models/${this.embeddingModel}`,
      content: { parts: [{ text: formatted }] },
      outputDimensionality: this.dimensions
    };

    const data = await this._request(`models/${this.embeddingModel}:embedContent`, body);
    if (!data.embedding || !data.embedding.values) {
      throw new Error('未取得有效的向量回應');
    }

    const floats = new Float32Array(data.embedding.values);
    return floats;
  }

  /**
   * Batch embed document chunks using batchEmbedContents (Max 100 requests per batch)
   * Enforces E19: NEVER concatenate multiple texts in a single request!
   * @param {Array<{ title: string, content: string }>} chunkItems
   * @param {(progress: { current: number, total: number }) => void} [onProgress]
   * @returns {Promise<Float32Array>} Flat Float32Array of all vectors
   */
  async embedChunksBatch(chunkItems, onProgress) {
    const total = chunkItems.length;
    const flatResult = new Float32Array(total * this.dimensions);
    const BATCH_SIZE = 50; // Safe chunk size per batchEmbedContents

    let processed = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const slice = chunkItems.slice(i, i + BATCH_SIZE);
      const requests = slice.map(item => ({
        model: `models/${this.embeddingModel}`,
        content: { parts: [{ text: GeminiClient.formatDocumentPrefix(item.title, item.content) }] },
        outputDimensionality: this.dimensions
      }));

      const body = { requests };
      const data = await this._request(`models/${this.embeddingModel}:batchEmbedContents`, body);

      if (!data.embeddings || data.embeddings.length !== slice.length) {
        throw new Error(`批次向量返回筆數不符: 預期 ${slice.length}, 收到 ${data.embeddings?.length}`);
      }

      for (let j = 0; j < data.embeddings.length; j++) {
        const vec = data.embeddings[j].values;
        const targetOffset = (i + j) * this.dimensions;
        flatResult.set(vec, targetOffset);
      }

      processed += slice.length;
      if (onProgress) {
        onProgress({ current: processed, total });
      }
    }

    return flatResult;
  }

  /**
   * Generate structured content with System Instruction
   * @param {string} systemInstruction
   * @param {string} userPrompt
   * @returns {Promise<string>} Raw text output (guaranteed JSON when prompted properly)
   */
  async generateContent(systemInstruction, userPrompt) {
    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for high audit fidelity
        responseMimeType: 'application/json' // Enforce JSON Output
      }
    };

    const data = await this._request(`models/${this.chatModel}:generateContent`, body);
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('LLM 未回傳任何候選答案');
    }

    const candidate = data.candidates[0];
    const textPart = candidate.content?.parts?.[0]?.text;
    if (!textPart) {
      throw new Error('LLM 回應中未包含文字內容');
    }

    return textPart;
  }
}
