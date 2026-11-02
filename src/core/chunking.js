/**
 * ZeroRAG Chunking Pipeline
 * High-precision sliding window text chunking with legal/heading structure recognition.
 */

/**
 * Computes SHA-256 hash string for text content (Browser & Node.js compatible)
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function computeSha256(text) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Node.js fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex');
  } catch (e) {
    // Simple fallback hash if crypto unavailable
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

/**
 * Chunking Options
 * @typedef {Object} ChunkingOptions
 * @property {number} [maxChars] - Maximum characters per chunk (default: 450 chars, ~300 tokens)
 * @property {number} [overlapChars] - Overlap window (default: 80 chars)
 * @property {boolean} [detectHeadings] - Detect Markdown headers / law articles (default: true)
 */

/**
 * Chunking Pipeline Implementation
 */
export class ChunkingPipeline {
  /**
   * @param {ChunkingOptions} [options]
   */
  constructor(options = {}) {
    this.maxChars = options.maxChars || 450;
    this.overlapChars = options.overlapChars || 80;
    this.detectHeadings = options.detectHeadings !== false;
  }

  /**
   * Process raw text into structured TextChunkItems
   * @param {string} rawText
   * @param {string} sourceName
   * @param {string} [workspaceId="default"]
   * @returns {Promise<import('./types.js').TextChunkItem[]>}
   */
  async process(rawText, sourceName, workspaceId = 'default') {
    if (!rawText || !rawText.trim()) return [];

    const sourceId = await computeSha256(rawText);
    const normalizedText = rawText.replace(/\r\n/g, '\n');

    // Split into structural blocks (paragraphs / markdown blocks)
    const blocks = normalizedText.split(/\n{2,}/);
    const chunks = [];

    let currentSection = '序言 / 總則';
    let currentArticle = '';
    let paragraphIndex = 0;

    let chunkBuffer = '';
    let chunkStartIndex = 0;

    const regexLawArticle = /(?:第\s*([0-9\u4e00-\u9fa5]+)\s*條(?:\s*第\s*([0-9\u4e00-\u9fa5]+)\s*項)?)/;
    const regexHeading = /^(#{1,6})\s+(.+)$/;

    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;

      paragraphIndex++;

      // If new structural heading or law article is encountered, flush previous article buffer first
      const headingMatch = trimmedBlock.match(regexHeading);
      const lawMatch = trimmedBlock.match(regexLawArticle);

      if ((headingMatch || lawMatch) && chunkBuffer.trim().length > 0) {
        chunks.push(this._createChunk(
          chunks.length,
          workspaceId,
          sourceId,
          sourceName,
          currentSection,
          currentArticle,
          paragraphIndex - 1,
          chunkBuffer.trim()
        ));
        chunkBuffer = '';
      }

      if (headingMatch) {
        currentSection = headingMatch[2].trim();
      }
      if (lawMatch) {
        currentArticle = lawMatch[0].trim();
        if (!headingMatch) {
          currentSection = currentArticle;
        }
      }

      // If adding this block exceeds maxChars, flush buffer
      if (chunkBuffer.length + trimmedBlock.length > this.maxChars && chunkBuffer.length > 0) {
        chunks.push(this._createChunk(
          chunks.length,
          workspaceId,
          sourceId,
          sourceName,
          currentSection,
          currentArticle,
          paragraphIndex,
          chunkBuffer.trim()
        ));

        // Retain overlap tail
        const overlapStart = Math.max(0, chunkBuffer.length - this.overlapChars);
        chunkBuffer = chunkBuffer.slice(overlapStart) + '\n' + trimmedBlock;
      } else {
        chunkBuffer = chunkBuffer ? (chunkBuffer + '\n\n' + trimmedBlock) : trimmedBlock;
      }

      // If a single block itself exceeds maxChars, split it by sentence boundaries
      while (chunkBuffer.length > this.maxChars) {
        // Find best split point near maxChars (prefer punctuation: 。, ；, \n, ., ;)
        let splitPoint = -1;
        const searchWindow = chunkBuffer.slice(Math.floor(this.maxChars * 0.7), this.maxChars);
        const puncMatches = [...searchWindow.matchAll(/[。；\n\.;]/g)];

        if (puncMatches.length > 0) {
          const lastPunc = puncMatches[puncMatches.length - 1];
          splitPoint = Math.floor(this.maxChars * 0.7) + lastPunc.index + 1;
        } else {
          splitPoint = this.maxChars;
        }

        const part = chunkBuffer.slice(0, splitPoint).trim();
        if (part) {
          chunks.push(this._createChunk(
            chunks.length,
            workspaceId,
            sourceId,
            sourceName,
            currentSection,
            currentArticle,
            paragraphIndex,
            part
          ));
        }

        const overlapStart = Math.max(0, splitPoint - this.overlapChars);
        chunkBuffer = chunkBuffer.slice(overlapStart).trim();
      }
    }

    // Flush any remaining text in buffer
    if (chunkBuffer.trim()) {
      chunks.push(this._createChunk(
        chunks.length,
        workspaceId,
        sourceId,
        sourceName,
        currentSection,
        currentArticle,
        paragraphIndex,
        chunkBuffer.trim()
      ));
    }

    return chunks;
  }

  _createChunk(index, workspaceId, sourceId, sourceName, section, article, pIndex, content) {
    const chunkId = `chunk_${sourceId.slice(0, 8)}_${index.toString().padStart(4, '0')}`;
    return {
      chunk_id: chunkId,
      workspace_id: workspaceId,
      location: {
        source_id: sourceId,
        source_name: sourceName,
        printed_page_number: article || `段落 #${pIndex}`,
        section: section || '未分類章節',
        paragraph_index: pIndex
      },
      content,
      token_count: Math.ceil(content.length / 1.5) // Approximate CJK token ratio
    };
  }
}
