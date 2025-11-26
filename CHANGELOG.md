# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
