# ZON Syntax Cheatsheet

Copyright (c) 2025 ZON-FORMAT (Roni Bhakta)

Quick reference for ZON format syntax. Cross-referenced with actual implementation in v1.3.0.

## Basic Types

### Primitives

```zonf
# String (unquoted when safe)
name:Alice

# Number
score:98.5
count:42

# Boolean (T/F)
active:T
disabled:F

# Null
value:null
```

### Objects

```zonf
# Simple object
name:ZON Format
version:1.1.0
active:T
score:98.5
```

**JSON equivalent:**
```json
{
  "name": "ZON Format",
  "version": "1.1.0",
  "active": true,
  "score": 98.5
}
```

### Nested Objects

**Colon-less Syntax (v1.1.0):**
```zonf
# Colon is optional if value starts with { or [
config{database{host:localhost,port:5432},cache{ttl:3600,enabled:T}}
```

**Legacy Quoted (v1.x):**
```zonf
config:"{database:{host:localhost,port:5432}}"
```

---

## Encoding Modes

ZON supports multiple encoding modes for different use cases:

### Mode Comparison

| Mode | Boolean Format | Table Compression | Indentation | Best For |
|------|----------------|-------------------|-------------|----------|

| **compact** | `T`/`F` | ✅ Yes | No | Production APIs |
| **readable** | `true`/`false` | ❌ No | ✅ Yes | Config files |
| **llm-optimized** | `true`/`false` | ✅ Yes | Optional | AI workflows |

### Readable Mode Syntax

YAML-like format with indentation and dash-separated lists:

```zonf
# Readable mode output
config:
  theme:dark
  version:1.0
users:
  - active:true
    id:1
    name:Alice
    role:admin
  - active:false
    id:2
    name:Bob
    role:user
```

**Indentation Control:**
- Default: 2 spaces
- Configurable: `encodeAdaptive(data, { mode: 'readable', indent: 4 })`
- Flat: `indent: 0` removes indentation

---

## Arrays

### Primitive Arrays (Inline)

```zonf
tags:"[nodejs,typescript,llm]"
numbers:"[1,2,3,4,5]"
flags:"[T,F,T]"
```

### Tabular Arrays (Uniform Objects)

**Most efficient form - ZON's specialty**

```zonf
users:@(3):active,id,name,role
T,1,Alice,admin
T,2,Bob,user
F,3,Carol,guest
```

**Breakdown:**
- `@(3)` = 3 rows
- `:active,id,name,role` = column headers
- Data rows follow

**JSON equivalent:**
```json
{
  "users": [
    { "id": 1, "name": "Alice", "role": "admin", "active": true },
    { "id": 2, "name": "Bob", "role": "user", "active": true },
    { "id": 3, "name": "Carol", "role": "guest", "active": false }
  ]
}
```

### Mixed / Non-Uniform Arrays

```zonf
# Quoted as JSON array
items:"[{id:1,name:Alice},{id:2,name:Bob,role:admin}]"
```

### Empty Containers

```zonf
# Empty object
metadata:"{}"

# Empty array
tags:"[]"
```

---

## Quoting Rules

### When Strings NEED Quotes

1. **Contains special characters**:
   - Commas: `"hello, world"`
   - Colons: `"key:value"`
   - Brackets: `"[test]"`
   - Braces: `"{test}"`

2. **Looks like a literal**:
   - `"true"` (string, not boolean)
   - `"123"` (string, not number)
   - `"false"` (string, not boolean)
   - `"null"` (string, not null)

3. **Leading/trailing spaces**:
   - `" padded "`

4. **Empty string**:
   - `""` (MUST quote, otherwise parses as `null`)

### Safe Unquoted Strings

```zonf
# Alphanumeric + dash, underscore, dot
name:john-doe
file:data_v1.json
host:api.example.com
```

---

## Table Headers

### Basic Header (without count)

```zonf
users:@:id,name,active
1,Alice,T
2,Bob,F
```

### Full Header (with count)

```zonf
users:@(2):id,name,active
1,Alice,T
2,Bob,F
```



### Dictionary Compression (v1.1.0)

For columns with repeated values:

```zonf
status[3]:delivered,in-transit,pending
shipments:@(100):id,status
1,2      # status index 2 = "pending"
2,0      # status index 0 = "delivered"
3,1      # status index 1 = "in-transit"
```

**Automatically applied when beneficial**

### Metadata Optimization (v1.1.0)

Grouped object syntax for nested metadata:

```zonf
context{location:Boulder,season:spring_2025,task:Our favorite hikes}
hikes:@(3):companion,distance,id
ana,7.5,1
luis,9.2,2
sam,5.1,3
```

---

## Type Conversions

| ZON | JSON | Notes |
|-----|------|-------|
| `T` | `true` | Boolean true |
| `F` | `false` | Boolean false |
| `null` | `null` | Null value |
| `42` | `42` | Number (integer) |
| `3.14` | `3.14` | Number (float) |  
| `hello` | `"hello"` | Unquoted string |
| `"hello"` | `"hello"` | Quoted string |

---

## Common Patterns

### Config with nested data

```zonf
environment:production
version:"1.1.0"
database:"{host:db.example.com,port:5432,ssl:T}"
features:"{darkMode:F,betaAccess:T}"
```

### Mixed structure (tables + metadata)

```zonf
created:"2025-11-28"
total:150
users:@(3):id,name,status
1,Alice,active
2,Bob,inactive
3,Carol,active
```

### Root-level table

```zonf
@(2):id,name,active
1,Alice,T
2,Bob,F
```

---

##  Escape Sequences

Within quoted strings:
- `\"` - Double quote
- `\\` - Backslash
- `\n` - Newline
- `\r` - Carriage return
- `\t` - Tab

**Example:**
```zonf
message:"Line 1\nLine 2"
path:"C:\\Users\\data"
```

---

## Complete Example

**JSON:**
```json
{
  "metadata": { "version": "1.1.0", "env": "production" },
  "users": [
    { "id": 1, "name": "Alice", "active": true, "loginCount": 42 },
    { "id": 2, "name": "Bob", "active": true, "loginCount": 17 },
    { "id": 3, "name": "Carol", "active": false, "loginCount": 3 }
  ],
  "config": { "database": { "host": "localhost", "port": 5432 } }
}
```

**ZON:**
```zonf
metadata{env:production,version:1.1.0}
users:@(3):active,id,loginCount,name
T,1,42,Alice
T,2,17,Bob
F,3,3,Carol
config.database{host:localhost,port:5432}
```

**Token count:**
- JSON (formatted): 151 tokens
- ZON: 87 tokens  
- **Savings: 42% fewer tokens**

---

## Tips for LLMs

1. **Use code blocks**: Wrap ZON in ` ```zon` for syntax highlighting
2. **No hints needed**: Format is self-documenting
3. **Explicit headers**: `@(N)` count helps LLMs validate
4. **Column names**: Listed once, clear schema

**Example prompt:**
````
Here's the data in ZON format:

```zon
users:@(3):id,name,active
1,Alice,T
2,Bob,F
3,Carol,T
```

Question: How many active users are there?
````

---

## Quick Comparison

| Feature | JSON | TOON | ZON |
|---------|------|------|-----|
| **Uniform arrays** | Verbose | Tabular | Tabular |
| **Nested objects** | Native | Quoted | Quoted |
| **Booleans** | `true`/`false` | `true`/`false` | `T`/`F` |
| **Null** | `null` | `null` | `null` |
| **Headers** | No | `[N]{fields}` | `@(N):fields` |
| **LLM accuracy** | 91.7% | 100% | **100%** ✅ |
| **Tokens (unified)** | 28,042 | 20,988 | **19,995** 👑 |

---

**See also:**
- [Format Specification](../SPEC.md) - Formal grammar
- [API Reference](./api-reference.md) - encode/decode functions
- [LLM Best Practices](./llm-best-practices.md) - Usage guide
