# CLI Guide

**Version:** 1.3.0
**Status:** Stable

## Overview

The `zon` command-line interface provides tools for working with ZON files, including encoding, decoding, validation, formatting, and analysis.

## Installation

```bash
npm install -g zon-format
```

Verify installation:

```bash
zon --help
```

## Commands

### `zon encode`

Convert JSON to ZON format.

**Usage:**

```bash
zon encode <file.json> > output.zonf
```

**Examples:**

```bash
# Encode JSON file
zon encode users.json > users.zonf

# Encode from stdin
cat data.json | zon encode > data.zonf

# View output directly
zon encode config.json
```

**Options:** None currently

---

### `zon decode`

Convert ZON back to JSON.

**Usage:**

```bash
zon decode <file.zonf> > output.json
```

**Examples:**

```bash
# Decode ZON file
zon decode users.zonf > users.json

# Decode from stdin
cat data.zonf | zon decode

# Pretty-print to console
zon decode config.zonf | jq
```

**Options:** None currently

---

### `zon convert`

Convert between JSON and ZON formats (auto-detects).

**Usage:**

```bash
zon convert <input-file> > output-file
```

**Examples:**

```bash
# Convert JSON to ZON
zon convert data.json > data.zonf

# Convert ZON to JSON
zon convert data.zonf > data.json
```

**Auto-detection:**
- `.json` extension → encodes to ZON
- `.zonf` extension → decodes to JSON
- Unknown extension → attempts to parse as JSON first

---

### `zon validate`

Validate ZON file syntax.

**Usage:**

```bash
zon validate <file.zonf>
```

**Examples:**

```bash
# Validate file
zon validate users.zonf
# ✅ Valid ZON file.

# Validate invalid file
zon validate broken.zonf
# ❌ Invalid ZON file.
# Error: [E001] Row count mismatch in table 'users'
```

**Exit Codes:**
- `0` - Valid
- `1` - Invalid

**Use in Scripts:**

```bash
#!/bin/bash
if zon validate data.zonf; then
  echo "Processing data..."
  zon decode data.zonf | process-data
else
  echo "Invalid data file!"
  exit 1
fi
```

---

### `zon stats`

Display statistics about a ZON file.

**Usage:**

```bash
zon stats <file.zonf>
```

**Output:**

```
📊 ZON Statistics
File: users.zonf

Size:
  ZON:  1,234 bytes
  JSON: 2,456 bytes (estimated)
  Savings: 49.8%

Parsing:
  Time: 12.3 ms
  Records: 150
```

**Examples:**

```bash
# Analyze file
zon stats large-dataset.zonf

# Compare compression
zon stats *.zonf
```

---

### `zon format`

Canonicalize and pretty-print a ZON file.

**Usage:**

```bash
zon format <file.zonf> > formatted.zonf
```

**What it does:**
1. Decodes the ZON file
2. Re-encodes with deterministic formatting
3. Sorts keys alphabetically

**Examples:**

```bash
# Format file
zon format messy.zonf > clean.zonf

# Format in-place (bash)
zon format data.zonf > tmp && mv tmp data.zonf

# Check if file is formatted
diff <(zon format data.zonf) data.zonf
```

**Use Cases:**
- **Version Control:** Normalize files before committing
- **Diffing:** Consistent formatting makes diffs meaningful
- **Linting:** Enforce canonical format in CI

---

## File Extensions

### `.zonf`

**ZON Format** - The standard extension for ZON files.

```bash
users.zonf
config.zonf
data.zonf
```

### `.zon`

Alternative extension (also supported by VS Code extension).

---

## Pipeline Examples

### JSON → ZON → Processing

```bash
# Download, convert, and analyze
curl https://api.example.com/data.json \
  | zon encode \
  | zon stats
```

### Validation + Processing

```bash
# Only process valid files
for file in *.zonf; do
  if zon validate "$file"; then
    zon decode "$file" | process-each-record
  fi
done
```

### Format Check in CI

```bash
# .github/workflows/lint.yml
- name: Check ZON formatting
  run: |
    for file in data/*.zonf; do
      if ! diff <(zon format "$file") "$file" > /dev/null; then
        echo "File $file is not formatted. Run: zon format $file"
        exit 1
      fi
    done
```

---

## Advanced Usage

### Combining with `jq`

```bash
# Extract specific fields
zon decode users.zonf | jq '.users[] | select(.role == "admin")'

# Transform and re-encode
zon decode data.zonf \
  | jq '.records |= map(select(.active))' \
  | zon encode > filtered.zonf
```

### Performance Testing

```bash
# Measure encode/decode speed
time zon encode large.json > /dev/null
time zon decode large.zonf > /dev/null
```

### Batch Conversion

```bash
# Convert all JSON files
for file in *.json; do
  zon encode "$file" > "${file%.json}.zonf"
done
```

---

## Troubleshooting

### Command Not Found

```bash
# Install globally
npm install -g zon-format

# Or use npx
npx zon-format encode data.json
```

### Permission Denied

```bash
# Make sure binary is executable
chmod +x $(which zon)
```

### Invalid ZON Errors

Common errors and fixes:

**E001: Row count mismatch**
```
Error: [E001] Row count mismatch in table 'users': expected 100, got 99
```
→ File is corrupted or manually edited. Use `zon format` to fix.

**E002: Field count mismatch**
```
Error: [E002] Field count mismatch on row 42: expected 5 fields, got 4
```
→ Missing column value. Check row 42 in the file.

---

## See Also

- [API Reference](api-reference.md) - Programmatic API
- [Syntax Cheatsheet](syntax-cheatsheet.md) - ZON syntax reference
- [Streaming Guide](streaming-guide.md) - Processing large files
