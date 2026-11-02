<div align="center">

# ⚡ ZeroRAG

**无服务器知识应用编译器 (Knowledge → Evidence → Application Compiler)**

*在浏览器中将法规、SOP 与专业规范文档消化提炼，一键编译为具备严谨事实证据链的便携独立微应用*

🌐 **语言 / Languages / 言語**:  
[ 简体中文 ](README.zh-CN.md) • [ English ](README.en.md) • [ 繁體中文 ](README.md) • [ 日本語 ](README.ja.md)

---

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First%20%7C%20Zero--Backend-38bdf8.svg)](ARCHITECTURE.md)
[![Vector: gemini--embedding--2](https://img.shields.io/badge/Vector-gemini--embedding--2%20(768d)-a855f7.svg)](ADR/ADR-0001-gemini-embedding-2-and-binary-store.md)
[![Benchmark: P95 < 3ms](https://img.shields.io/badge/Latency-P95%20%3D%202.88ms-10b981.svg)](SPIKES/spike-b/RESULT.md)
[![Bundle: 10.8MB < 15MB](https://img.shields.io/badge/Bundle-10.85MB%20%E2%89%A4%2015MB-success.svg)](ADR/ADR-0004-standalone-bundle-format.md)
[![Tests: 17 Passed](https://img.shields.io/badge/Tests-17%20Passed-10b981.svg)](#-自动化测试与质量验收)

[✨ 在线演示 (GitHub Pages)](#-快速开始-quick-start) •
[📖 术语词典](GLOSSARY.md) •
[🏛️ 架构规格](ARCHITECTURE.md) •
[🛡️ 安全不变性](SECURITY.md) •
[🧪 技术验证报告](ZERO-RAG-TECHNICAL-SPIKE.md)

</div>

---

## 💡 为什么需要 ZeroRAG？(The Mission)

传统的 RAG (检索增强生成) 大多停留在“让用户跟文档随意聊天”的玩具阶段，面临三大致命痛点：
1. **运维昂贵**：需要持续支付向量数据库 (Pinecone/Milvus) 与后端服务器的高额月租费用。
2. **幻觉与过度推论**：即便引用了正确段落，AI 也经常过度推断（例如：原文明确注明“检验记录保存五年”，AI 却推论为“所有行政公文均应保存五年”）。
3. **无法独立交付**：知识无法像 PDF 或 Word 一样封装成离线、独立的单一文件发送给主管、客户或审计员查阅。

**ZeroRAG 的全新解法**：
> **ZeroRAG 是一套运行于浏览器端的“无服务器知识应用编译器”**。  
> 它的任务不是简单闲聊，而是在前端本地解析法规、SOP、题库与合同后，**直接编译为具备事实主张映射 (Claim-Evidence Mapping) 的轻量、可独立发布的单文件微应用 (Portable HTML)**。

---

## 🌟 核心工程亮点 (Key Highlights)

### 1. 💰 $0 基础设施维护成本 ($0 Infrastructure Cost)
- **Zero Developer Server**：零自建后端服务器、零托管向量数据库，直接依托 GitHub Pages 免费静态托管。
- **透明 BYOK (自带 API 密钥)**：用户自备 Google Gemini API Key 调用，免费层享受每日官方额度，付费调用直接对齐 Google Cloud 官方账单，开发者不碰资金与账单。

### 2. ⚖️ Claim-Evidence Mapping（防范 AI 过度推断）
- 摒弃文末粗糙附带来源的做法，将核查结论拆解为原子化的具体事实主张 (`ClaimVerification`)。
- **字对字精准引述校验**：若大模型引用的原文语句未能在原文中精确匹配，系统立即亮起幻觉预警。
- **适用范围警示 (`scope_warning`)**：强制审计模型标明情境边界（例如：“原文仅适用于检验记录，不涵盖行政公文”），彻底杜绝过度引申。

### 3. ⚡ 8.79 MiB 纯二进制向量库与极速检索 (V8 优化)
- 废除臃肿的 JSON 数组，改用连续二进制缓冲区 (`embeddings.bin`)，3,000 个分块仅需 **8.79 MiB**。
- 采用 V8 JIT 展开 (Loop-unrolled by 4) 的纯内存点积 Top-K 检索，**实测 P95 延迟仅 2.88 ms**（优于目标值 10 倍！），吞吐量高达 416+ QPS。

### 4. 📦 10.85 MB 单文件发布标准 (Portable HTML ≤ 15MB)
- 遵循 **ADR-0004 C2 方案**：向量二进制数据先经 Gzip (Level 9) 压缩后再以 Base64 内嵌，前端利用原生 `DecompressionStream('gzip')` 在 **36.5 ms** 内完成秒级解压。
- 彻底剔除运行时的臃肿解析库，确保包含 3,000 分块的知识微应用体积稳稳控制在 **10.85 MB**（保留 4.15 MB 安全裕度）。

### 5. 🛡️ 八大安全不变性准则 (S1 ~ S8)
严格遵守**“凭证不入聊天记录、不入源代码、不入 Git、不入导出文件”**的铁律，架构与打包器完全隔离 API Key，默认使用“Session-Only 关闭即焚”模式。

---

## 📊 性能基准测试与指标对比

在 Node.js / Chrome V8 环境下的真实压测数据（2026-11-02）：

| 指标维度 | 目标规格 | 实测数据 | 状态判定 |
| :--- | :--- | :--- | :---: |
| **P95 检索延迟 (3,000 分块)** | < 30 ms | **2.88 ms** (QPS: 416.7) | 🟢 **大幅超越 (10倍)** |
| **P95 检索延迟 (10,000 分块)** | < 100 ms | **9.38 ms** (QPS: 106.6) | 🟢 **大幅超越 (10倍)** |
| **单档 HTML 导出体积 (3,000 分块)** | ≤ 15.0 MB | **10.85 MB** (未压缩: 14.5MB) | 🟢 **达标通过** |
| **Int8 二进制量化体积** | ≤ 3.0 MB | **2.22 MB** (Top-5 重合率: 98.8%) | 🟢 **架构预留方案** |
| **单档解压缩耗时** | < 500 ms | **36.5 ms** (`DecompressionStream`) | 🟢 **瞬间解压** |
| **自动化单元测试覆盖** | 100% 通过 | **17 / 17 全部 PASS** | 🟢 **绿灯全过** |

---

## 🚀 快速开始 (Quick Start)

### 1. 本地运行

```bash
# 克隆仓库
git clone https://github.com/etrnya/ZeroRAG.git
cd ZeroRAG

# 使用任意静态服务器启动
npm start
# 或者：npx serve src/ui -l 8765
# 或者 Python：python -m http.server 8765 --directory src/ui
```

在浏览器打开 `http://localhost:8765` 即可使用 **ZeroRAG Studio** 工作台。

### 2. 执行自动化测试

```bash
npm test
# 自动执行 node src/test_core.js，验证分块、向量点积、事实核查与数据库存储。
```

---

## 🧪 自动化测试与质量验收

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

## 📄 开源许可证 (License)

本项目采用 [Apache License 2.0](LICENSE) 开源许可证，具备完善的专利反制与商标防侵权保护。  
由 **etrnya** 于 2026 年精心打造。
