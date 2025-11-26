# ZON vs TOON vs JSON Benchmark

This directory contains comprehensive benchmarks comparing **ZON**, **TOON**, and **JSON** formats for token efficiency using the GPT-5 `o200k_base` tokenizer.

## 🎯 Purpose

Measure and compare:
- **Token counts** using the `o200k_base` tokenizer (GPT-4o, GPT-5)
- **Byte sizes** for each format
- **Compression ratios** across different data structures

## 📁 Files

- **`datasets.js`** - Test datasets covering various data structures:
  - E-commerce orders (nested structures)
  - Employee records (uniform tabular)
  - Time-series analytics (numerical data)
  - Hike data (mixed structures)
  - GitHub repositories (tabular)
  - Deep configuration (deeply nested)
  - Event logs (semi-uniform)

- **`run.js`** - Main benchmark runner that:
  - Encodes each dataset in ZON, TOON, and JSON formats
  - Counts tokens using `gpt-tokenizer` with `o200k_base`
  - Displays detailed comparison with visual bars
  - Shows overall statistics and winners

## 🚀 Running the Benchmark

```bash
node benchmarks/run.js
```

## 📊 What Gets Measured

For each dataset, the benchmark measures:

1. **Token Counts** - Using GPT-5's o200k_base tokenizer
   - ZON encoding
   - TOON encoding
   - JSON (formatted with 2-space indentation)
   - JSON (compact/minified)

2. **Byte Sizes** - Raw size in bytes for each format

3. **Comparison Metrics**
   - Percentage differences between formats
   - Visual bar charts
   - Winner identification (minimum tokens)

## 🔍 About the Tokenizer

The benchmark uses `gpt-tokenizer` with the `o200k_base` encoding, which is:
- Used by GPT-4o and GPT-5
- ~200,000 token vocabulary
- Optimized for multilingual text
- The current standard for modern LLM tokenization

## 📈 Expected Results

### ZON Strengths
- **Mixed structures** with context + tabular data
- **Semi-uniform** arrays with optional fields
- **Compact** key-value notation

### TOON Strengths
- **Uniform tabular** data (CSV-like)
- **Multiple objects** with identical schemas
- **Explicit structure** with type declarations

### When JSON Might Win
- **Deeply nested** non-uniform objects
- **Very small** datasets (overhead not amortized)
- **Single objects** without arrays

## 🔬 Datasets Explained

### 1. E-commerce Orders
Nested structures with customer info and order items. Tests how formats handle:
- Nested objects
- Arrays within objects
- Mixed data types

### 2. Employee Records
Perfect uniform tabular data. Tests:
- Array of objects with identical structure
- Mixed string/number/boolean types
- Pure tabular efficiency

### 3. Time-Series Analytics
Numerical metrics over time. Tests:
- Floating-point numbers
- Date strings
- Uniform numerical data

### 4. Hike Data (Mixed)
Context + arrays + tabular. Tests:
- Top-level key-value pairs
- Simple arrays
- Tabular data
- Mixed structure handling

### 5. GitHub Repositories
Tabular with mixed types. Tests:
- String and number columns
- Large numbers
- Consistent schema

### 6. Deep Configuration
Deeply nested config object. Tests:
- Multi-level nesting
- Non-tabular structure
- Object hierarchy

### 7. Event Logs (Semi-uniform)
Variable fields across records. Tests:
- Optional fields
- Irregular schemas
- Real-world logging scenarios

## 🎭 Understanding the Output

The benchmark displays:
- Visual bars showing relative token counts
- Winner crown (👑) for the most efficient format
- Percentage comparisons vs all other formats
- Total statistics across all datasets

## 📝 Notes

- Token counts are measured using the same tokenizer TOON uses in their benchmarks
- Byte sizes are UTF-8 encoded
- Percentages show improvement (negative = better) or regression (positive = worse)
- The "winner" is determined solely by token count, not bytes
