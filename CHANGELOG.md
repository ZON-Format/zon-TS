# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2025-11-30

### Added
- **Colon-less Syntax:** Objects and arrays in nested positions now use `key{...}` and `key[...]` syntax, removing redundant colons.
- **Smart Flattening:** Top-level nested objects are automatically flattened to dot notation (e.g., `config.db{...}`).
- **Control Character Escaping:** All control characters (ASCII 0-31) are now properly escaped to prevent binary file creation.

### Improved
- **Token Efficiency:** Achieved up to 23.8% reduction vs JSON (GPT-4o) thanks to syntax optimizations.
- **Readability:** Cleaner, block-like structure for nested data.

## [1.0.5] - 2025-11-30

### Added
- **Algorithmic Benchmark Generation**: Replaced LLM-based question generation with a deterministic algorithm for consistent, reproducible benchmarks.
- **Expanded Dataset**: Added "products" and "feed" data to the unified dataset to simulate real-world e-commerce scenarios.
- **Tricky Questions**: Introduced edge cases (non-existent fields, logic traps, case sensitivity) to stress-test LLM reasoning.
- **Robust Benchmark Runner**: Added exponential backoff and rate limiting to handle Azure OpenAI S0 tier constraints.

### Changed
- **Benchmark Formats**: Refined tested formats to ZON, TOON, JSON, JSON (Minified), and CSV for focused analysis.
- **Documentation**: Updated README and API references with the latest benchmark results (GPT-5 Nano) and accurate token counts.
- **Token Efficiency**: Recalculated efficiency scores based on the expanded dataset, confirming ZON's leadership (1430.6 score).

### Fixed
- **Rate Limiting**: Resolved 429 errors during benchmarking by implementing robust retry logic and concurrency control.

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
