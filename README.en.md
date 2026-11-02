<div align="center">

# ⚡ ZeroRAG

**Serverless Knowledge-to-Application Compiler (Knowledge → Evidence → Application)**

*Digest regulations, SOPs, and technical specifications in your browser, and compile them into self-contained, verifiable micro-applications with strict factual audit trails.*

🌐 **Languages / 語言 / 言語**:  
[ English ](README.en.md) • [ 繁體中文 ](README.md) • [ 简体中文 ](README.zh-CN.md) • [ 日本語 ](README.ja.md)

---

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First%20%7C%20Zero--Backend-38bdf8.svg)](ARCHITECTURE.md)
[![Vector: gemini--embedding--2](https://img.shields.io/badge/Vector-gemini--embedding--2%20(768d)-a855f7.svg)](ADR/ADR-0001-gemini-embedding-2-and-binary-store.md)
[![Benchmark: P95 < 3ms](https://img.shields.io/badge/Latency-P95%20%3D%202.88ms-10b981.svg)](SPIKES/spike-b/RESULT.md)
[![Bundle: 10.8MB < 15MB](https://img.shields.io/badge/Bundle-10.85MB%20%E2%89%A4%2015MB-success.svg)](ADR/ADR-0004-standalone-bundle-format.md)
[![Tests: 17 Passed](https://img.shields.io/badge/Tests-17%20Passed-10b981.svg)](#-automated-tests--verification)

[✨ Live Demo (GitHub Pages)](#-quick-start) •
[📖 Glossary](GLOSSARY.md) •
[🏛️ Architecture Spec](ARCHITECTURE.md) •
[🛡️ Security Invariants](SECURITY.md) •
[🧪 Spike Benchmark Reports](ZERO-RAG-TECHNICAL-SPIKE.md)

</div>

---

## 💡 Why ZeroRAG? (The Mission)

Traditional RAG (Retrieval-Augmented Generation) has largely stagnated as a "chat with your docs" gimmick, burdened by three fatal flaws:
1. **Expensive Maintenance**: Ongoing monthly fees for hosted vector databases (Pinecone, Milvus, Qdrant) and dedicated backend servers.
2. **Hallucination & Over-extrapolation**: Even when citing the correct passage, LLMs routinely extrapolate beyond the facts (e.g., source says *"Inspection records must be kept for 5 years"*, but the AI extrapolates to *"All government documents must be retained for 5 years"*).
3. **Fragile Delivery**: Knowledge cannot be packaged and handed over as an offline, standalone artifact (like a PDF or Word document) for stakeholders, regulators, or trainees.

**The ZeroRAG Paradigm Shift**:
> **ZeroRAG is a browser-native "Serverless Knowledge Application Compiler"**.  
> Its mission is not open-ended conversation, but parsing regulatory, operational, or technical documents directly on the client side, then **compiling them into lightweight, verifiable, standalone single-file micro-apps (Portable HTML) with explicit Claim-Evidence Mapping**.

---

## 🌟 Key Engineering Highlights

### 1. 💰 $0 Infrastructure Cost
- **Zero Developer Server**: 100% serverless on client side. Hostable on GitHub Pages or static S3 buckets with zero ongoing server costs.
- **Transparent BYOK (Bring Your Own Key)**: Users bring their own Google Gemini API key. Free-tier users leverage Google's daily quota; enterprise users bill directly to Google Cloud without intermediary markups.

### 2. ⚖️ Claim-Evidence Mapping (Defeating Over-Extrapolation)
- Replaces vague "sources at the bottom" with discrete, atomic claims (`ClaimVerification`).
- **Verbatim Quote Verification**: Highlights and warns immediately if quoted text does not match the source text word-for-word.
- **Context Scope Warnings (`scope_warning`)**: Mandates the audit model to flag boundary limits (e.g., *"Applies strictly to laboratory audit records, not administrative memos"*), eliminating unwarranted legal or technical generalizations.

### 3. ⚡ 8.79 MiB Binary Vector Store with Sub-3ms Retrieval (V8 Optimized)
- Replaces bloated JSON arrays with a continuous 64-byte aligned binary buffer (`embeddings.bin`), requiring only **8.79 MiB for 3,000 chunks**.
- Powered by a Loop-Unrolled (x4) pure memory dot-product Top-K scan in V8: **benchmarked at P95 latency of 2.88 ms** (10x faster than our <30ms target), reaching 416+ QPS.

### 4. 📦 10.85 MB Standalone Artifact Standard (Portable HTML ≤ 15MB)
- Implements **ADR-0004 C2 Architecture**: Raw binary embeddings are compressed with Gzip (Level 9) and embedded as Base64 strings. The browser's native `DecompressionStream('gzip')` decompresses in just **36.5 ms**.
- Decouples heavy parsers from the runtime viewer, guaranteeing that a 3,000-chunk compiled application sits at just **10.85 MB** (with a comfortable 4.15 MB safety margin).

### 5. 🛡️ Eight Security Invariants (S1 ~ S8)
Enforces the zero-leak principle: **"Credentials never enter chat, source code, Git repositories, or exported artifacts"**. API keys exist solely in memory for the active browser session.

---

## 📊 Benchmark & Validation Matrix

Real-world benchmark data executed under Node.js / Chrome V8 (2026-11-02):

| Metric | Target Specification | Actual Benchmark | Result |
| :--- | :--- | :--- | :---: |
| **P95 Retrieval Latency (3,000 chunks)** | < 30 ms | **2.88 ms** (QPS: 416.7) | 🟢 **Surpassed (10x)** |
| **P95 Retrieval Latency (10,000 chunks)** | < 100 ms | **9.38 ms** (QPS: 106.6) | 🟢 **Surpassed (10x)** |
| **Standalone HTML File Size (3,000 chunks)** | ≤ 15.0 MB | **10.85 MB** (Uncompressed: 14.5MB) | 🟢 **Compliant** |
| **Binary Quantization Size (Int8)** | ≤ 3.0 MB | **2.22 MB** (Top-5 Overlap: 98.8%) | 🟢 **Reserved Option** |
| **Decompression Latency** | < 500 ms | **36.5 ms** (`DecompressionStream`) | 🟢 **Instantaneous** |
| **Automated Unit Tests** | 100% Pass | **17 / 17 Passed** | 🟢 **Green** |

---

## 🚀 Quick Start

### 1. Run Locally

```bash
# Clone the repository
git clone https://github.com/etrnya/ZeroRAG.git
cd ZeroRAG

# Launch with any static HTTP server (or Node.js)
npm start
# Alternatively: npx serve src/ui -l 8765
# Or Python: python -m http.server 8765 --directory src/ui
```

Open your browser at `http://localhost:8765` to access the **ZeroRAG Studio** interface.

### 2. Run Automated Unit Tests

```bash
npm test
# Executes node src/test_core.js covering Chunking, Vector Dot-product,
# Claim-Evidence verification, Gemini Client and IndexedDB schema.
```

---

## 🛠️ Architecture & Core Pipeline

```
ZeroRAG/
├── src/
│   ├── core/                      <-- Domain Core Layer
│   │   ├── types.js               <-- Entity definitions & schemas
│   │   ├── chunking.js            <-- Regulation-aware text chunker & SHA-256
│   │   ├── vector_index.js        <-- Binary 64-byte vector buffer & dot product
│   │   └── claim_verification.js  <-- Claim-Evidence mapper & anti-hallucination
│   ├── infra/                     <-- Infrastructure Layer
│   │   ├── gemini_client.js       <-- Direct REST client with prefix formatting
│   │   └── indexed_db.js          <-- Binary ArrayBuffer persistence adapter
│   ├── ui/                        <-- Presentation Layer (Bento-Grid Neon Studio)
│   │   ├── index.html             <-- ZeroRAG Studio layout
│   │   ├── app.js                 <-- Client orchestration
│   │   └── style.css              <-- Modern glassmorphism design
│   └── test_core.js               <-- Automated test suite (17 tests)
├── ARCHITECTURE.md                <-- Full Architecture Specification
├── GLOSSARY.md                    <-- Domain Glossary (Dictionary First)
├── PRD.md                         <-- Product Requirements Document (v1.1.1)
├── SECURITY.md                    <-- Security Invariants & Guardrails
└── LICENSE                        <-- Apache 2.0 License
```

---

## 🧪 Automated Tests & Verification

```bash
> node src/test_core.js

[PASS] Types: default constants match spec
[PASS] Chunking: sliding window produces expected chunk count
[PASS] Chunking: law regulation structure boundary detection
[PASS] Chunking: chunk sha256 hashes generated correctly
[PASS] VectorIndex: binary header serialization and roundtrip
[PASS] VectorIndex: cosine similarity identifies closest vector
[PASS] VectorIndex: top-k returns correct ordering
[PASS] VectorIndex: zero-vector cosine similarity returns 0 without NaN
[PASS] ClaimEvidenceMapper: verifies exact quote match correctly
[PASS] ClaimEvidenceMapper: flags quote mismatch as hallucination warning
[PASS] ClaimEvidenceMapper: generates valid JSON prompt structure with anti-extrapolation
[PASS] GeminiClient: formats query with required prefix
[PASS] GeminiClient: builds correct headers without key in URL query
[PASS] IndexedDBAdapter: initialization succeeds in browser/mock environment
[PASS] IndexedDBAdapter: roundtrip save and load binary bundle
[PASS] IndexedDBAdapter: delete cleans up stored knowledge pack
[PASS] End-to-End Pipeline: Chunk -> Vector Index -> Query Top-K Search

==================================================
Total Tests: 17, Passed: 17, Failed: 0
==================================================
```

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE) with complete patent and trademark protections.  
Crafted with precision by **etrnya** (2026).
