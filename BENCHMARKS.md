# ZON Performance Benchmarks

**Date:** 2025-12-01
**Version:** v1.0.5
**Environment:** Node.js (macOS)

## Overview

We compared ZON against JSON (native) and MsgPack (`msgpack-lite`) across three datasets:
1.  **Hiking (Small, Mixed)**: A typical LLM context object with metadata and a small table.
2.  **Large Array (1k items)**: A tabular dataset with 1000 rows, testing table compression.
3.  **Nested Object (Deep)**: A deeply nested structure to test recursion overhead.

## Results

### 1. Hiking Dataset (Small)

| Format | Size (bytes) | Tokens (GPT) | Encode (ms) | Decode (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **JSON** | 366 | 115 | 0.035 | 0.016 |
| **MsgPack** | 277 | N/A | 0.145 | 0.045 |
| **ZON** | 278 | **96** | 0.180 | 0.120 |

**Result:** ZON saves **16.5%** tokens vs JSON.

### 2. Large Array (1000 items)

| Format | Size (bytes) | Tokens (GPT) | Encode (ms) | Decode (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **JSON** | 97,891 | 31,002 | 1.520 | 0.850 |
| **MsgPack** | 88,903 | N/A | 3.200 | 1.800 |
| **ZON** | 68,904 | **25,004** | 15.400 | 8.500 |

**Result:** ZON saves **19.3%** tokens vs JSON.

### 3. Nested Object (Deep)

| Format | Size (bytes) | Tokens (GPT) | Encode (ms) | Decode (ms) |
| :--- | :--- | :--- | :--- | :--- |
| **JSON** | 4,012 | 1,480 | 0.014 | 0.033 |
| **MsgPack** | 2,689 | N/A | 0.199 | 0.124 |
| **ZON** | 3,330 | **1,366** | 0.221 | 0.916 |

**Result:** ZON saves **7.7%** tokens vs JSON.

## Analysis

- **Token Efficiency**: ZON consistently outperforms JSON in token count, with savings ranging from 7% to 19%. This directly translates to lower LLM costs and larger effective context windows.
- **Size**: ZON is significantly smaller than JSON in bytes, often approaching MsgPack's binary size for tabular data due to header deduplication.
- **Performance**: While slower than native JSON (as expected), ZON's performance is well within acceptable limits for real-world applications, processing 1000 items in ~15ms.

## Methodology

Benchmarks were run using `benchmarks/performance.ts`.
- **JSON**: `JSON.stringify` / `JSON.parse`
- **MsgPack**: `msgpack-lite`
- **ZON**: `zon-format` v1.0.5
- **Tokens**: Measured using `gpt-tokenizer` (GPT-3.5/4 encoding).
