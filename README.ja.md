<div align="center">

# ⚡ ZeroRAG

**サーバーレス知識アプリケーションコンパイラ (Knowledge → Evidence → Application Compiler)**

*ブラウザ上で法令・SOP・技術仕様書を解析し、厳密な事実証拠チェーンを備えた単一ポータブルアプリへ一発コンパイル*

🌐 **言語 / Languages / 語言**:  
[ 日本語 ](README.ja.md) • [ English ](README.en.md) • [ 繁體中文 ](README.md) • [ 简体中文 ](README.zh-CN.md)

---

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First%20%7C%20Zero--Backend-38bdf8.svg)](ARCHITECTURE.md)
[![Vector: gemini--embedding--2](https://img.shields.io/badge/Vector-gemini--embedding--2%20(768d)-a855f7.svg)](ADR/ADR-0001-gemini-embedding-2-and-binary-store.md)
[![Benchmark: P95 < 3ms](https://img.shields.io/badge/Latency-P95%20%3D%202.88ms-10b981.svg)](SPIKES/spike-b/RESULT.md)
[![Bundle: 10.8MB < 15MB](https://img.shields.io/badge/Bundle-10.85MB%20%E2%89%A4%2015MB-success.svg)](ADR/ADR-0004-standalone-bundle-format.md)
[![Tests: 17 Passed](https://img.shields.io/badge/Tests-17%20Passed-10b981.svg)](#-自動テストと品質検証)

[✨ オンラインデモ (GitHub Pages)](#-クイックスタート-quick-start) •
[📖 用語辞書](GLOSSARY.md) •
[🏛️ アーキテクチャ仕様](ARCHITECTURE.md) •
[🛡️ セキュリティ不変則](SECURITY.md) •
[🧪 検証レポート](ZERO-RAG-TECHNICAL-SPIKE.md)

</div>

---

## 💡 なぜ ZeroRAG なのか？(The Mission)

従来の RAG (検索拡張生成) は「ドキュメントとチャットするおもちゃ」に留まっており、3 つの致命的な課題を抱えています：
1. **高額な運用保守コスト**：ホスト型ベクトル DB (Pinecone 等) とバックエンドサーバーの月額費用が発生し続ける。
2. **ハルシネーションと過剰な拡大解釈**：正しい段落を引用していても、AI が過度に拡大解釈してしまう（例：原文「検査記録は 5 年保存」に対し、AI が「すべての行政公文書は 5 年保存」と拡大）。
3. **オフライン単体配布の不可能性**：知識を PDF や Word のように独立したファイルにパッケージ化し、クライアントや監査人に直接手渡せない。

**ZeroRAG の新しいアプローチ**：
> **ZeroRAG はブラウザネイティブで動作する「サーバーレス知識アプリケーションコンパイラ」です**。  
> その使命は単なる会話ではなく、クライアント側でドキュメントを直接解析し、**厳密な事実主張マッピング (Claim-Evidence Mapping) を備えた軽量・自己完結型の単一ファイル (Portable HTML) へコンパイルすること**です。

---

## 🌟 主な設計上の強み (Key Highlights)

### 1. 💰 インフラ運用費 $0 ($0 Infrastructure Cost)
- **Zero Developer Server**：専用サーバー不要、ホスト型ベクトル DB 不要。GitHub Pages などの静的ホスティングのみで完全動作。
- **透明な BYOK (API キー自己持参)**：ユーザー自身の Google Gemini API Key を利用。無料枠の利用が可能で、有料利用分も Google Cloud から直接請求されるため、開発者がインフラ代金を負担しません。

### 2. ⚖️ Claim-Evidence Mapping (拡大解釈の徹底排除)
- 曖昧な「文末の参考リンク」を廃止し、回答をアトミックな単一主張 (`ClaimVerification`) に細分化。
- **一字一句の引用検証**：AI が引用したテキストが原文と完全一致しない場合、即座に警告を表示。
- **適用範囲警告 (`scope_warning`)**：AI に「本規定は検査記録にのみ適用され、一般公文書には適用されない」などの文脈境界を明記させ、不当な法意拡大を防止。

### 3. ⚡ 8.79 MiB 純バイナリベクトルストアと高速検索 (V8 最適化)
- 肥大な JSON 配列を全廃し、連続バイナリバッファ (`embeddings.bin`) を採用。3,000 チャンクをわずか **8.79 MiB** に圧縮。
- V8 JIT ループ展開 (Loop-unrolled by 4) のメモリ内内積 Top-K 検索により、**P95 レイテンシ 2.88 ms** を実証（目標 30ms の 10 倍高速、416+ QPS）。

### 4. 📦 10.85 MB 単一ファイル配布基準 (Portable HTML ≤ 15MB)
- **ADR-0004 C2 方式**を採用：バイナリベクトルを Gzip (Level 9) 圧縮した上で Base64 埋め込み。ブラウザ標準の `DecompressionStream('gzip')` により **36.5 ms** で高速解凍。
- ランタイムから重いパーサーを完全排除し、3,000 チャンクのアプリを **10.85 MB**（余裕度 4.15 MB）に収めました。

### 5. 🛡️ 8 つのセキュリティ不変則 (S1 ~ S8)
**「認証情報はチャット・コード・Git・エクスポート成果物のいずれにも残さない」**を徹底。API Key はブラウザメモリのセッション中のみ保持されます。

---

## 📊 パフォーマンス検証マトリクス

Node.js / Chrome V8 環境での実測値 (2026-11-02)：

| 項目 | 目標仕様 | 実測値 | 判定 |
| :--- | :--- | :--- | :---: |
| **P95 検索レイテンシ (3,000 チャンク)** | < 30 ms | **2.88 ms** (QPS: 416.7) | 🟢 **10倍高速** |
| **P95 検索レイテンシ (10,000 チャンク)** | < 100 ms | **9.38 ms** (QPS: 106.6) | 🟢 **10倍高速** |
| **単一 HTML 出力サイズ (3,000 チャンク)** | ≤ 15.0 MB | **10.85 MB** (非圧縮: 14.5MB) | 🟢 **基準達成** |
| **Int8 バイナリ量子化サイズ** | ≤ 3.0 MB | **2.22 MB** (Top-5 一致率: 98.8%) | 🟢 **設計準備完了** |
| **単一ファイル解凍時間** | < 500 ms | **36.5 ms** (`DecompressionStream`) | 🟢 **瞬時解凍** |
| **自動単体テスト通過率** | 100% | **17 / 17 合格** | 🟢 **全テストクリア** |

---

## 🚀 クイックスタート (Quick Start)

### 1. ローカルでの実行

```bash
# リポジトリをクローン
git clone https://github.com/etrnya/ZeroRAG.git
cd ZeroRAG

# 任意の静的サーバーで起動
npm start
# または：npx serve src/ui -l 8765
# または Python：python -m http.server 8765 --directory src/ui
```

ブラウザで `http://localhost:8765` を開くと **ZeroRAG Studio** が起動します。

### 2. 単体テストの実行

```bash
npm test
# node src/test_core.js を実行し、チャンキング、内積計算、事実検証、DB永続化をテストします。
```

---

## 🧪 自動テストと品質検証

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

## 📄 ライセンス (License)

本プロジェクトは [Apache License 2.0](LICENSE) のもとで公開されており、完全な特許および商標保護条項を含みます。  
Crafted with care by **etrnya** (2026).
