# Benchmark Results: ZON vs TOON vs JSON

**Date:** November 26, 2025  
**Tokenizer:** GPT-5 o200k_base (via gpt-tokenizer)  
**Datasets:** 7 different data structures

---

## 🏆 Executive Summary

**ZON wins on ALL 7 datasets!** 👑

- **56.9% fewer tokens** than JSON (formatted)
- **27.5% fewer tokens** than JSON (compact)
- **13.8% fewer tokens** than TOON

### Overall Token Counts (All Datasets Combined)

| Format | Total Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|-------------|---------------------|-------------------|---------|
| **ZON** 👑 | **1,344** | **-56.9%** | **-27.5%** | — |
| TOON | 1,560 | -49.9% | -15.8% | +16.1% |
| JSON (formatted) | 3,116 | — | +68.2% | +131.8% |
| JSON (compact) | 1,853 | -40.5% | — | +37.9% |

---

## 📊 Dataset-by-Dataset Results

### 1. E-commerce Orders (Nested Structures)
*Nested structures with customer info and order items*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **228** | **-57.7%** | **-28.3%** | — |
| TOON | 266 | -50.6% | -16.4% | +16.7% |
| JSON (formatted) | 539 | — | +69.5% | +136.4% |
| JSON (compact) | 318 | -41.0% | — | +39.5% |

**ZON advantage:** Compact key-value notation handles nested objects efficiently.

---

### 2. Employee Records (Uniform Tabular)
*Uniform tabular data - perfect for compression*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **154** | **-67.4%** | **-41.2%** | — |
| TOON | 164 | -65.3% | -37.4% | +6.5% |
| JSON (formatted) | 472 | — | +80.2% | +206.5% |
| JSON (compact) | 262 | -44.5% | — | +70.1% |

**Note:** Even on TOON's ideal use case (uniform tabular), ZON is 6.1% more efficient!

---

### 3. Time-Series Analytics (Numerical Data)
*Uniform numerical data with metrics over time*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **267** | **-56.8%** | **-32.2%** | — |
| TOON | 268 | -56.6% | -32.0% | +0.4% |
| JSON (formatted) | 618 | — | +56.9% | +131.5% |
| JSON (compact) | 394 | -36.2% | — | +47.6% |

**Nearly tied!** ZON and TOON are almost identical on pure numerical data.

---

### 4. Hike Data (Mixed Structure)
*Mixed structure with context, arrays, and tabular data*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **125** | **-62.8%** | **-38.7%** | — |
| TOON | 136 | -59.5% | -33.3% | +8.8% |
| JSON (formatted) | 336 | — | +64.7% | +168.8% |
| JSON (compact) | 204 | -39.3% | — | +63.2% |

**ZON sweet spot:** Mixed structures with context + tabular data.

---

### 5. GitHub Repositories (Tabular)
*Tabular data with mixed string and numerical values*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **170** | **-67.1%** | **-42.6%** | — |
| TOON | 188 | -63.6% | -36.5% | +10.6% |
| JSON (formatted) | 516 | — | +74.3% | +203.5% |
| JSON (compact) | 296 | -42.6% | — | +74.1% |

**Impressive:** ZON beats TOON by 9.6% even on tabular string/number data.

---

### 6. Deep Configuration (Deeply Nested)
*Deeply nested object - challenging for tabular formats*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **113** | **-51.1%** | **-8.9%** | — |
| TOON | 149 | -35.5% | +20.2% | +31.9% |
| JSON (formatted) | 231 | — | +86.3% | +104.4% |
| JSON (compact) | 124 | -46.3% | — | +9.7% |

**ZON's largest margin vs TOON (24.2%)!** Deep nesting is where ZON really shines.

---

### 7. Event Logs (Semi-uniform)
*Semi-uniform data with some missing/variable fields*

| Format | Tokens | vs JSON (formatted) | vs JSON (compact) | vs ZON |
|--------|--------|---------------------|-------------------|---------|
| **ZON** 👑 | **287** | **-40.2%** | **-9.5%** | — |
| TOON | 389 | -19.0% | +22.7% | +35.5% |
| JSON (formatted) | 480 | — | +51.4% | +67.2% |
| JSON (compact) | 317 | -34.0% | — | +10.5% |

**ZON handles irregularity better:** 26.2% fewer tokens than TOON on semi-uniform data.

---

## 🎯 Key Findings

### When ZON Excels
1. **Mixed structures** (context + arrays + tabular) - up to 8.8% better than TOON
2. **Deeply nested objects** - up to 24.2% better than TOON
3. **Semi-uniform data** (optional fields) - up to 26.2% better than TOON
4. **All scenarios** - Never loses to TOON or JSON

### When ZON vs TOON is Close
- **Pure uniform numerical data** - Nearly tied (0.4% difference)
- **Perfect tabular data** - ZON still wins but by smaller margin (6.1%)

### When JSON Compact is Competitive
- **Small deeply nested objects** - Compact JSON is only 8.9% larger than ZON
- However, ZON still wins even in this scenario

---

## 🔬 Technical Notes

### Tokenizer Details
- **Package:** `gpt-tokenizer`
- **Encoding:** `o200k_base`
- **Used by:** GPT-4o, GPT-5, GPT-4o-mini
- **Vocabulary:** ~200,000 tokens

### Methodology
1. Same datasets encoded in all three formats
2. Token counts measured using identical tokenizer
3. Both formatted (2-space indent) and compact JSON tested
4. Byte sizes also measured for reference

### Why Token Count Matters
- **LLM API costs** are based on tokens, not bytes
- **Context windows** are limited by tokens
- **Processing speed** correlates with token count
- Fewer tokens = Lower cost + Faster processing + More context available

---

## 📈 Visual Summary

```
ZON Wins by Dataset Type:
├─ Nested structures:       ✓ (57.7% reduction vs JSON)
├─ Uniform tabular:         ✓ (67.4% reduction vs JSON)
├─ Numerical time-series:   ✓ (56.8% reduction vs JSON)
├─ Mixed structures:        ✓ (62.8% reduction vs JSON)
├─ Tabular mixed types:     ✓ (67.1% reduction vs JSON)
├─ Deeply nested:           ✓ (51.1% reduction vs JSON)
└─ Semi-uniform logs:       ✓ (40.2% reduction vs JSON)

Win Rate: 7/7 (100%)
```

---

## 💡 Recommendations

**Use ZON when:**
- You want the best token efficiency across all data types
- You have mixed structures (context + data)
- You need to handle irregular/semi-uniform data
- You're working with deeply nested objects
- Cost optimization is important

**TOON might be preferable when:**
- You need extremely explicit type declarations
- Your data is 100% uniform tabular (though ZON still wins)
- You prefer YAML-like syntax aesthetics

**JSON might be preferable when:**
- Universal compatibility is more important than efficiency
- You're using existing JSON-only tools
- Data size is negligible

---

## 🚀 Running Your Own Benchmarks

```bash
# Install dependencies
npm install

# Build ZON
npm run build

# Run benchmark
node benchmarks/run.js
```

See `benchmarks/README.md` for more details on the benchmark suite.
