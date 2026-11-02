/**
 * ZeroRAG Claim-Evidence Mapper
 * Implements ClaimVerification structure, Anti-Extrapolation Prompts, and Grounding Validation.
 */

export class ClaimEvidenceMapper {
  /**
   * Builds system & user prompt for rigorous Claim-Evidence Verification
   * @param {string} auditQuery - The subject or question being audited (e.g. "機關招標是否得指定特定廠牌？")
   * @param {Array<{ chunk_id: string, content: string, location: any, relevance_score: number }>} evidenceList
   * @returns {{ systemInstruction: string, promptText: string }}
   */
  static buildAuditPrompt(auditQuery, evidenceList) {
    const systemInstruction = `你是一位資深法規與品質保證 (QA/QC) 查核審計專家。
你的任務是根據所提供的【精確證據段落】，對使用者的【查核事項】進行嚴格的單一事實主張查核 (Claim Verification)。

【不可違背之審計守則】：
1. 嚴禁無中生有或自由發揮。所有結論 MUST 100% 來自提供的證據段落。
2. 拆解為獨立的單一事實主張 (Atomic Claims)。每個 Claim 只能包含一個事實判斷。
3. 嚴防「過度擴張解釋 (Anti-Extrapolation)」：
   - 假使原文僅提及「檢驗結果紀錄應保存五年」，不得推論為「所有行政文件均應保存五年」。
   - 若結論包含原文未提及之對象、情境或範圍，狀態必須標記為 "UNVERIFIED"，並在 scope_warning 欄位明確指出警示（例如：「原文僅適用於檢驗紀錄，不包含其他公文」）。
4. 嚴格輸出合規的 JSON 結構，不得輸出任何 Markdown 外框（如 \`\`\`json）。`;

    let contextText = evidenceList.map((e, idx) => {
      const loc = e.location;
      const ref = `[來源: ${loc.source_name} | 條款/章節: ${loc.section || loc.printed_page_number || '無'}]`;
      return `【證據 #${idx + 1}】(Chunk ID: ${e.chunk_id})\n${ref}\n原文內容：\n${e.content.trim()}\n`;
    }).join('\n----------------------------------------\n');

    const promptText = `請針對以下【查核事項】，對照後方提供的【證據段落】，產出嚴格的主張查核報告。

【待查核事項】：
${auditQuery}

【可用證據資料庫】：
${contextText}

請以 JSON 格式回傳，格式範例如下：
{
  "audit_subject": "${auditQuery}",
  "overall_compliance": "COMPLIANT" | "NON_COMPLIANT" | "UNCERTAIN",
  "summary": "1~2 句總結查核結論",
  "claims": [
    {
      "claim_id": "C-01",
      "claim_text": "單一事實主張陳述",
      "verification_status": "SUPPORTED" | "CONTRADICTED" | "UNVERIFIED",
      "scope_warning": "若有範圍過度擴張或未涵蓋情境請填寫此欄，否則為 null",
      "primary_evidence": {
        "chunk_id": "對應之 Chunk ID",
        "exact_quote": "必須為對應證據中完全一模一樣的原文引句",
        "reference": "出處章節/條號"
      }
    }
  ]
}`;

    return { systemInstruction, promptText };
  }

  /**
   * Parses and validates raw LLM JSON response with Grounding verification
   * @param {string} rawLlmOutput
   * @param {Array<{ chunk_id: string, content: string, location: any }>} evidenceList
   * @returns {Object} Validated audit report
   */
  static parseAndValidate(rawLlmOutput, evidenceList) {
    // 1. Silent fix: Strip markdown blocks or leading/trailing whitespace
    let cleanJson = rawLlmOutput.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
    cleanJson = cleanJson.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error(`JSON 解析失敗: ${e.message}\n原始文字: ${cleanJson.slice(0, 200)}...`);
    }

    const chunkMap = new Map(evidenceList.map(e => [e.chunk_id, e]));

    // 2. Validate Claims & Verbatim Quotes
    if (Array.isArray(parsed.claims)) {
      for (const claim of parsed.claims) {
        if (!claim.primary_evidence || !claim.primary_evidence.chunk_id) {
          claim.verification_status = 'UNVERIFIED';
          claim.scope_warning = '缺少實體證據關聯 (Missing Chunk ID)';
          continue;
        }

        const chunk = chunkMap.get(claim.primary_evidence.chunk_id);
        if (!chunk) {
          claim.verification_status = 'UNVERIFIED';
          claim.scope_warning = `引用的 Chunk ID (${claim.primary_evidence.chunk_id}) 不在候選證據集中`;
          continue;
        }

        // Check verbatim quote
        const quote = (claim.primary_evidence.exact_quote || '').trim();
        if (quote && !chunk.content.includes(quote)) {
          // If quote does not exist verbatim, mark warning
          claim.scope_warning = (claim.scope_warning ? claim.scope_warning + '；' : '') +
            '警示：引文未在原文中精確字對字匹配，可能存在 AI 改寫或幻覺';
        }

        // Attach verified location
        claim.primary_evidence.source_location = chunk.location;
      }
    }

    return parsed;
  }
}
