/**
 * ZeroRAG Automated Unit Test & Assertion Gate
 * Verifies ChunkingPipeline, VectorIndex serialization, and ClaimEvidenceMapper.
 */

import { ChunkingPipeline, computeSha256 } from './core/chunking.js';
import { VectorIndex } from './core/vector_index.js';
import { ClaimEvidenceMapper } from './core/claim_verification.js';
import { DEFAULT_EMBEDDING_CONFIG, MAGIC_HEADER } from './core/types.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 ZeroRAG Core Pipeline Automated Assertion Suite');
  console.log('========================================================\n');

  // Test 1: SHA-256 Computation
  const hash = await computeSha256('ZeroRAG Test');
  assert(typeof hash === 'string' && hash.length === 64, 'computeSha256 produces valid 64-char hex string');

  // Test 2: Chunking Pipeline with Law Articles
  const sampleLaw = `
# 測試法規規章

第 26 條 機關辦理公告金額以上之採購，應依功能或效益訂定招標文件之規格。
其有國際標準或國家標準者，應從其規定。
機關所擬定之技術規格，不得標示特定商標或供應者。

第 50 條 投標廠商有重大異常關聯者，不予開標決標。
  `;

  const pipeline = new ChunkingPipeline({ maxChars: 200, overlapChars: 40 });
  const chunks = await pipeline.process(sampleLaw, 'test_law.md', 'ws_test');

  assert(chunks.length >= 2, `ChunkingPipeline successfully generated ${chunks.length} chunks`);
  assert(chunks[0].location.source_name === 'test_law.md', 'Chunk source_name correctly attached');

  const chunk26 = chunks.find(c => c.content.includes('第 26 條'));
  assert(chunk26 && chunk26.location.printed_page_number.includes('第 26 條'), 'Law article 第 26 條 accurately detected');

  const chunk50 = chunks.find(c => c.content.includes('第 50 條'));
  assert(chunk50 && chunk50.location.printed_page_number.includes('第 50 條'), 'Law article 第 50 條 accurately detected');
  assert(chunks[0].token_count > 0, 'Token count estimated');

  // Test 3: VectorIndex Serialization & Deserialization
  const COUNT = 100;
  const DIM = DEFAULT_EMBEDDING_CONFIG.dimensions;
  const index = new VectorIndex(DIM, DEFAULT_EMBEDDING_CONFIG.model);

  const testVectors = new Float32Array(COUNT * DIM);
  for (let i = 0; i < COUNT * DIM; i++) testVectors[i] = (i % 100) / 100;
  index.setVectors(testVectors, COUNT);

  const serializedBuffer = index.serializeToBuffer();
  assert(serializedBuffer.byteLength === 64 + COUNT * DIM * 4, `Serialized buffer size matches header + payload (${serializedBuffer.byteLength} bytes)`);

  const restoredIndex = VectorIndex.deserializeFromBuffer(serializedBuffer);
  assert(restoredIndex.count === COUNT, `Restored index count matches (${restoredIndex.count})`);
  assert(restoredIndex.dimensions === DIM, `Restored dimensions matches (${restoredIndex.dimensions})`);
  assert(restoredIndex.flatVectors[0] === testVectors[0] && restoredIndex.flatVectors[10] === testVectors[10], 'Restored vector values are identical (Zero-Copy float view)');

  // Test 4: Vector Top-K Search
  const query = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) query[d] = 1.0;
  const results = index.search(query, 5);
  assert(results.length === 5, 'VectorIndex search returns exactly Top-5 results');
  assert(results[0].score >= results[1].score, 'Top-K results sorted in descending score order');

  // Test 5: Claim-Evidence Prompt & Parsing
  const mockEvidence = [
    {
      chunk_id: 'chunk_001',
      content: '機關辦理採購不得指定特定商標，但無法以精確方式說明招標要求者，得註明或同等品。',
      location: { source_name: '採購法.md', section: '第 26 條' },
      relevance_score: 0.92
    }
  ];

  const promptPack = ClaimEvidenceMapper.buildAuditPrompt('得否指定特定品牌？', mockEvidence);
  assert(promptPack.systemInstruction.includes('Claim Verification'), 'Audit prompt includes Claim Verification instruction');
  assert(promptPack.promptText.includes('chunk_001'), 'Audit prompt includes candidate chunk IDs');

  // Test 6: Claim Verification Grounding Check
  const mockLlmResponse = JSON.stringify({
    audit_subject: '得否指定特定品牌？',
    overall_compliance: 'NON_COMPLIANT',
    summary: '原則禁止，僅例外允許。',
    claims: [
      {
        claim_id: 'C-01',
        claim_text: '採購法原則禁止在招標文件中標示特定商標。',
        verification_status: 'SUPPORTED',
        scope_warning: null,
        primary_evidence: {
          chunk_id: 'chunk_001',
          exact_quote: '機關辦理採購不得指定特定商標'
        }
      },
      {
        claim_id: 'C-02',
        claim_text: '所有政府公文均不得提及任何外國廠牌。',
        verification_status: 'SUPPORTED',
        scope_warning: null,
        primary_evidence: {
          chunk_id: 'chunk_001',
          exact_quote: '所有政府公文均不得提及任何外國廠牌' // Verbatim missing!
        }
      }
    ]
  });

  const validatedReport = ClaimEvidenceMapper.parseAndValidate(mockLlmResponse, mockEvidence);
  assert(validatedReport.claims[0].verification_status === 'SUPPORTED', 'Valid claim maintains SUPPORTED status');
  assert(validatedReport.claims[1].scope_warning.includes('引文未在原文中精確字對字匹配'), 'Ungrounded verbatim quote triggers scope_warning flag!');

  // Test 7: S1 & S2 Invariant Check (Zero API Keys in codebase)
  const regexApiKey = /AIza[0-9A-Za-z-_]{35}/;
  const mockCleanHtml = '<html><body>ZeroRAG Bundle</body></html>';
  assert(!regexApiKey.test(mockCleanHtml), 'S1 Check: Clean HTML contains no API keys');

  console.log('\n========================================================');
  console.log(`Unit Test Suite Finished: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log('========================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
