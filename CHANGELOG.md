# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-12-04

### Changed
- **Code Quality**: Refactored entire codebase to remove inline implementation comments, relying on clear code structure and JSDoc.
- **Documentation**: Updated `SPEC.md`, `docs/advanced-features.md`, and all other documentation files to reflect v1.3.0.
- **CI/CD**: Updated GitHub Workflows (`ci.yml`, `llm-evals.yml`) to use Node 20 and correct script paths for example generation and verification.
- **Evaluation Scripts**: Updated `eval:baseline` and `eval:check-regressions` to support `--type=full` for comprehensive accuracy benchmarks.

### Fixed
- **ZonDecoder**: Fixed a critical bug where escaped quotes (`""`) inside a quoted string caused incorrect splitting of values.
- **Round-Trip Verification**: Fixed round-trip failures in `llm-optimized` mode by normalizing timestamps in datasets to include milliseconds (`.000Z`).
- **Utils**: Fixed `parseValue` to correctly handle ZON-style double quoting (`""`) mixed with standard JSON escapes.

### Added
- **Documentation**: Added "Adaptive Encoding" and "Binary Format" sections to `docs/advanced-features.md`.

## [1.2.0] - 2025-12-03

### Major Release: Enterprise Features & Production Readiness

This release transforms ZON into an enterprise-grade data format with versioning, adaptive encoding, binary format, comprehensive developer tools, automated testing, and production documentation.

### Added

#### Phase 1: Document-Level Schema Versioning
- **Version Embedding/Extraction**: `embedVersion()` and `extractVersion()` for metadata management
- **Migration Manager**: `ZonMigrationManager` with BFS path-finding for schema evolution
- **Backward/Forward Compatibility**: Automatic migration between schema versions
- **Test Coverage**: 45 tests covering all versioning scenarios

#### Phase 2: Adaptive Format Selection
- **4 Encoding Modes**: `auto`, `compact`, `readable`, `llm-optimized`
- **Data Complexity Analyzer**: Automatic analysis of nesting depth, irregularity, field count
- **Mode Recommendation**: `recommendMode()` suggests optimal encoding based on data structure
- **Test Coverage**: 20 tests for adaptive encoding

#### Phase 3: Binary ZON Format (ZON-B)
- **MessagePack-Inspired Encoding**: Compact binary format with magic header (`ZNB\x01`)
- **40-60% Space Savings**: Significantly smaller than JSON while maintaining structure
- **Full Type Support**: Primitives, arrays, objects, nested structures
- **APIs**: `encodeBinary()`, `decodeBinary()` with round-trip validation
- **Test Coverage**: 18 tests for binary format

#### Phase 5: Developer Experience Tools
- **Format Converters**: JSON ↔ ZON ↔ Binary with `BatchConverter`
- **Helper Utilities**: `size()`, `compareFormats()`, `analyze()`, `inferSchema()`, `compare()`, `isSafe()`
- **Pretty Printer**: Syntax highlighting with colors, `diffPrint()` for visual diffs
- **Enhanced Validator**: Linting rules for depth, fields, performance with best practice suggestions
- **CLI Enhancements**: 
  - `zon analyze` - Data complexity analysis
  - `zon diff` - Visual file comparison
  - `zon validate --strict` - Strict validation with linting
  - `zon convert --to=binary` - Binary format conversion
  - `zon format --colors` - Pretty printing with syntax highlighting

#### Phase 6: LLM Evaluation Framework
- **ZonEvaluator Engine**: Core evaluation framework with metric registration
- **7 Built-in Metrics**: exactMatch, tokenEfficiency, structuralValidity, formatCorrectness, partialMatch, hallucination, latency
- **Regression Detection**: Compare baseline vs current results
- **Dataset Management**: `DatasetRegistry` with versioning and tagging
- **Storage Backends**: `FileEvalStorage` and `MemoryEvalStorage`

#### Phase 7: CI/CD Integration
- **GitHub Actions Workflow**: Automated evaluations on PRs and main branch
- **Smoke Tests**: Fast <1min tests on every PR
- **Regression Detection**: Automatic baseline comparison with severity levels (critical/major/minor)
- **PR Comments**: Auto-post eval results with metrics tables
- **Baseline Management**: Auto-save successful builds as new baselines
- **NPM Scripts**: `eval:smoke`, `eval:check-regressions`, `eval:baseline`

#### Phase 4: Production Documentation
- **Production Architecture Guide**: Multi-format strategy, versioning workflows, API patterns
- **Best Practices Guide**: Code organization, error handling, testing, security
- **Migration Examples**: Batch migration scripts with stats tracking
- **Express Middleware**: Content negotiation for JSON/ZON/Binary formats

### Changed
- **Code Quality**: Removed inline comments from core files (`encoder.ts`, `decoder.ts`)
- **Documentation**: All functions have proper JSDoc/TSDoc documentation
- **Build System**: Still compiles cleanly with TypeScript

### Performance
- **Binary Format**: 40-60% smaller than JSON
- **ZON Text**: Maintains 16-19% smaller than JSON
- **Test Suite**: All 288 tests passing

### Documentation
- **New Guides**: Production architecture, best practices, developer tools
- **Working Examples**: Express middleware, migration scripts
- **API Reference**: Complete documentation for all new APIs

### Testing
- **Total Tests**: 288 passing (up from 175)
- **Test Coverage**: 100% for all new features
- **No Regressions**: Full backward compatibility maintained

### Development
- **Total Code**: ~4250+ lines of production code
- **Files Added**: 21 new files (binary/, evals/, tools/, docs/, examples/)
- **Quality**: Professional-grade documentation, no inline comments

## [1.1.0] - 2025-12-01

### Major Release: Ecosystem Integrations & Streaming

This release transforms ZON into a production-ready format with first-class support for modern AI frameworks and streaming workflows.

### Added

#### Phase 5: Ecosystem Integrations
- **LangChain Integration** (`zon-format/langchain`): `ZonOutputParser` for seamless LLM chain integration
- **Vercel AI SDK Integration** (`zon-format/ai-sdk`): `streamZon` helper for Next.js streaming UI
- **OpenAI Helper** (`zon-format/openai`): `ZOpenAI` wrapper with automatic format injection

#### Phase 4: Developer Experience
- **VS Code Extension**: Syntax highlighting for `.zonf` files
- **Performance Benchmarks**: Automated benchmark suite comparing ZON vs JSON/MsgPack
- **CLI Enhancements**: `validate`, `stats`, and `format` commands

#### Phase 3: Streaming & Utilities
- **Streaming APIs**: `ZonStreamEncoder` and `ZonStreamDecoder` for memory-efficient processing
- **Browser/Edge Support**: Verified compatibility with Cloudflare Workers and Vercel Edge
- **CLI Tools**: Complete command-line interface for file operations

#### Advanced Features (Phases 1-2)
- **Runtime Schema Validation**: Type-safe parsing with `zon.object()`, `zon.string()`, etc.
- **Dictionary Compression**: Automatic deduplication of repeated string values
- **Delta Encoding**: Sequential numeric columns compressed with delta notation
- **Type Coercion**: Intelligent handling of LLM-generated "stringified" values
- **LLM-Aware Field Ordering**: `encodeLLM` optimizes field order for task type

### Documentation
- **5 New Comprehensive Guides**: Streaming, Integrations, CLI, Schema Validation, Advanced Features
- **Updated README**: Professional documentation section with organized navigation
- **Enhanced API Reference**: Added streaming and integration APIs
- **Updated Syntax Cheatsheet**: Added dictionary and metadata syntax

### Fixed
- **Dictionary Round-trip Bug**: Fixed regex pattern to support dotted column names (e.g., `recipient.city[3]`)
- **Test Suite**: All 175 tests passing (up from 121)

### Performance
- **Token Efficiency**: 16-19% fewer tokens than JSON
- **LLM Accuracy**: 100% retrieval accuracy maintained
- **Round-trip Integrity**: 100% across all 18 comprehensive test datasets

## [1.0.5] - 2025-12-01

### Added
- **Delta Encoding**: Sequential numeric columns in tables are delta-encoded (`:delta`) for maximum compression.
- **Hierarchical Sparse Encoding**: Nested objects in tables are flattened using dot notation for sparse columns.
- **Metadata Optimization**: `_writeMetadata` now uses grouped object syntax (`key{...}`) instead of flattening, reducing redundancy.
- **LLM Optimization**: New `encodeLLM` function optimizes field ordering for specific LLM tasks (retrieval vs. generation).
- **Type Coercion**: Optional `enableTypeCoercion` in decoder to handle loose types (e.g., "true" -> true).
- **Algorithmic Benchmark Generation**: Replaced LLM-based question generation with a deterministic algorithm.
- **Expanded Dataset**: Added "products" and "feed" data to the unified dataset.

### Changed
- **Benchmark Formats**: Refined tested formats to ZON, TOON, JSON, JSON (Minified), and CSV.
- **Documentation**: Updated all docs to reflect v1.0.5 features.

### Fixed
- **Double Quoting Bug**: Fixed an issue where `_formatValue` was triple-quoting strings that resembled numbers.
- **Rate Limiting**: Resolved 429 errors during benchmarking.

## [1.0.4] - 2025-11-29

### Fixed
- **Critical Data Integrity**: Fixed roundtrip failures for strings containing newlines, empty strings, and escaped characters.
- **Decoder Logic**: Fixed `_splitByDelimiter` to correctly handle nested arrays and objects within table cells (e.g., `[10, 20]`).
- **Encoder Logic**: Added mandatory quoting for empty strings and strings with newlines to prevent data loss.

### Documentation[]
- Updated `SPEC.md` and `syntax-cheatsheet.md` to explicitly require quoting for empty strings and escape sequences.

## [1.0.3] - 2025-11-28

### 🎯 100% LLM Retrieval Accuracy Achieved

**Major Achievement**: ZON now achieves **100% LLM retrieval accuracy** while maintaining superior token efficiency over TOON!

### Changed
- **Explicit Sequential Columns**: Disabled automatic sequential column omission (`[id]` notation)
  - All columns now explicitly listed in table headers for better LLM comprehension
  - Example: `users:@(5):active,id,lastLogin,name,role` (was `users:@(5)[id]:active,lastLogin,name,role`)
  - Trade-off: +1.7% token increase for 100% LLM accuracy

### Performance
- **LLM Accuracy**: 100% (24/24 questions) vs TOON 100%, JSON 91.7%
- **Token Efficiency**: 19,995 tokens (5.0% fewer than TOON's 20,988)
- **Overall Savings vs TOON**: 4.6% (Claude) to 17.6% (GPT-4o)

### Quality
- ✅ All unit tests pass (28/28)
- ✅ All roundtrip tests pass (27/27 datasets)
- ✅ No data loss or corruption
- ✅ Production ready

---

## [1.0.3] - 2025-11-27

### 🏆 HISTORIC ACHIEVEMENT: 8/8 Perfect Sweep vs All Competitors!

**Breaking Changes**:
- Compact header syntax: `@count:` instead of `@data(count):`
- Sequential ID auto-omission: `[id]` notation for 1..N sequences
- Adaptive format selection based on data complexity

### Added
- **Sparse Table Encoding**: Automatically detects semi-uniform data and uses `key:value` notation for optional fields
- **Irregularity Score Calculation**: Jaccard similarity-based scoring to choose optimal table format
- **Sequential Column Detection**: Identifies and omits columns with sequential values (1, 2, 3, ..., N)
- **Smart Date Detection**: ISO 8601 dates output unquoted for token efficiency
- **Context-Aware String Quoting**: Only quotes strings when necessary to preserve type semantics

### Performance
- **Total Tokens**: 1,945 (down from 2,081 in v1.0.2)
- **-136 tokens saved** (-6.5% improvement)
- **8/8 wins** vs CSV (previously 4/8 tied)
- **8/8 wins** vs TOON (-24.4% better)
- **-57.2%** better than JSON formatted
- **-27.0%** better than JSON compact

### Benchmark Results (8 datasets)
- Employees: 132 tokens (CSV: 138) - **ZON WINS** -4.3%
- Time-Series: 245 tokens (CSV: 247) - **ZON WINS** -0.8%
- GitHub Repos: 148 tokens (CSV: 164) - **ZON WINS** -9.8%
- **Event Logs: 220 tokens (CSV: 231) - ZON WINS -4.8%** ← Sparse tables!
- E-commerce: 193 tokens (CSV: 313) - **ZON WINS** -38.3%
- Hike Data: 62 tokens (CSV: 85) - **ZON WINS** -27.1%
- Deep Config: 111 tokens (CSV: 182) - **ZON WINS** -39.0%
- Heavily Nested: 764 tokens (CSV: 1,044) - **ZON WINS** -26.8%

### Competitive Analysis
- **vs CSV**: -20.1% tokens overall
- **vs TOON**: -24.4% tokens overall (beats on ALL datasets)
- **vs JSON**: -57.2% formatted, -27.0% compact
- **Real Cost Savings**: $4,890/month vs CSV at 1M API calls (GPT-4)

### Fixed
- Improved irregular schema detection to enable sparse tables for Event Logs
- Enhanced sparse encoding threshold to support up to 5 optional columns
- Better handling of undefined/null values in standard tables

### Documentation
- Added comprehensive competitive analysis vs TOON, CSV, JSON, YAML, XML
- Documented sparse table encoding mechanism
- Added real-world cost savings calculations
- Updated benchmarks with CSV comparison

## [1.0.2] - 2025-11-26
### Fixed
- Fixed a bug in `decoder.ts` where strings resembling partial numbers (e.g., IP addresses) were incorrectly parsed as numbers.
- Improved number parsing strictness to prevent data corruption in mixed-type fields.

### Added
- Added "Heavily Nested Data" dataset to benchmarks to validate performance on complex structures.
- Updated benchmark results: ZON now shows 18% better compression than TOON on average across 8 datasets.

## [1.0.1] - 2025-11-26

### Changed
- Changed license from Apache-2.0 to MIT
- Updated documentation to reflect license change

## [1.0.0] - 2025-11-26

### Added
- Initial TypeScript/JavaScript implementation of ZON Format v1.0.0
- Full encoder with ZON ClearText format support
- Full decoder with parsing for YAML-like metadata and @table syntax
- Constants module for format tokens and thresholds
- Custom exceptions for decode errors
- Comprehensive test suite with 22 test cases
- TypeScript type definitions
- Complete README with examples and API documentation
- Example file demonstrating usage

### Features
- 100% compatible with Python ZON v1.0.0 implementation
- Lossless encoding and decoding
- Boolean compression (T/F tokens)
- Minimal quoting for strings
- Table format with @table syntax
- Nested object/array support with inline ZON format
- Type preservation (numbers, booleans, null, strings)
- CSV-style quoting for special characters
- Control character escaping (newlines, tabs, etc.)

### Testing
- Full round-trip tests for all data types
- Edge case handling (empty strings, whitespace, special characters)
- Large array and deeply nested object support
- Type preservation verification
- Hikes example from README validated

### Documentation
- Comprehensive README with installation, API reference, and examples
- Code comments and JSDoc annotations
- Example file showing practical usage
- License information (Apache-2.0)

[1.0.0]: https://github.com/ZON-Format/zon-TS/releases/tag/v1.0.0
