/**
 * ZeroRAG Domain Types & Constants
 * Aligned with GLOSSARY.md v1.1.1
 */

/**
 * @typedef {Object} SourceLocation
 * @property {string} source_id - SHA-256 hash of the source document
 * @property {string} source_name - Name of the source file (e.g. "procurement_law.md")
 * @property {number} [page_index] - 0-based page index (for paginated files)
 * @property {string} [printed_page_number] - Internal printed page (e.g. "第 26 條")
 * @property {string} [section] - Section title or clause
 * @property {number} [paragraph_index] - Paragraph sequence index
 */

/**
 * @typedef {Object} TextChunkItem
 * @property {string} chunk_id - Unique chunk UUID
 * @property {string} workspace_id - ID of the owning workspace
 * @property {SourceLocation} location - Detailed provenance location
 * @property {string} content - Raw chunk text
 * @property {number} [token_count] - Estimated token count
 */

/**
 * @typedef {Object} EmbeddingConfig
 * @property {"google" | "local_wasm"} provider - Vector provider
 * @property {string} model - "gemini-embedding-2"
 * @property {number} dimensions - 768 (MVP standard)
 * @property {"gemini-embedding-2-prefix"} task_format - Prompt prefix convention
 * @property {"l2"} normalization - L2 normalized
 * @property {"cosine"} distance_metric - Cosine similarity via dot product
 * @property {string} version - Version identifier
 */

/**
 * @typedef {Object} Evidence
 * @property {string} chunk_id
 * @property {SourceLocation} location
 * @property {string} quote - Exact quote from original text
 * @property {number} relevance_score - 0.00 ~ 1.00
 * @property {"vector" | "keyword" | "hybrid"} retrieval_method
 * @property {"HIGH" | "MEDIUM" | "LOW"} [confidence]
 * @property {string} generated_at - ISO timestamp
 */

/**
 * @typedef {Object} ClaimVerification
 * @property {string} claim_id - Claim sequence identifier
 * @property {string} claim_text - Single concrete atomic assertion
 * @property {"SUPPORTED" | "CONTRADICTED" | "UNVERIFIED"} verification_status
 * @property {string} [scope_warning] - Warning if conclusion overextends scope
 * @property {{ chunk_id: string, exact_quote: string, source_location: SourceLocation }} primary_evidence
 */

/**
 * Default MVP Embedding Configuration
 * @type {EmbeddingConfig}
 */
export const DEFAULT_EMBEDDING_CONFIG = Object.freeze({
  provider: 'google',
  model: 'gemini-embedding-2',
  dimensions: 768,
  task_format: 'gemini-embedding-2-prefix',
  normalization: 'l2',
  distance_metric: 'cosine',
  version: '2026-10'
});

export const MAGIC_HEADER = 'ZRAG';
export const HEADER_SIZE_BYTES = 64;
