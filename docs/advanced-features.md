# Advanced Features Guide

**Version:** 1.1.0  
**Status:** Stable

## Overview

ZON includes advanced compression and optimization features that dramatically reduce token count and improve LLM accuracy. These features are automatically applied by the encoder when beneficial.

## Table of Contents


- [Dictionary Compression](#dictionary-compression)
- [Type Coercion](#type-coercion)
- [LLM-Aware Field Ordering](#llm-aware-field-ordering)
- [Hierarchical Sparse Encoding](#hierarchical-sparse-encoding)

---

## Dictionary Compression

**Introduced:** v1.0.3  
**Purpose:** Deduplicate repeated string values

### How It Works

When a column has many repeated values, ZON creates a dictionary and stores indices:

```
# Without dictionary:
shipments:@(150):status,...
pending,...
delivered,...
pending,...
in-transit,...
pending,...
...

# With dictionary:
status[3]:delivered,in-transit,pending
shipments:@(150):status,...
2,...    # "pending"
0,...    # "delivered"
2,...    # "pending"
1,...    # "in-transit"
2,...    # "pending"
...
```

### When To Use

Dictionary compression is automatically applied when:

1. Column has **≥10 values**
2. Column has **≤10 unique values**
3. **Compression ratio > 1.2x**

### Examples

```typescript
const shipments = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  status: ['pending', 'delivered', 'in-transit'][i % 3]
}));

const zon = encode({ shipments });
/*
status[3]:delivered,in-transit,pending
shipments:@(100):id,status
0,2       # id:0, status:"pending"
1,0       # id:1, status:"delivered"
2,1       # id:2, status:"in-transit"
...
*/
```

### Nested Columns

Dictionary compression works with flattened nested fields:

```typescript
const data = {
  users: [
    { name: 'Alice', address: { city: 'NYC' } },
    { name: 'Bob', address: { city: 'LAX' } },
    { name: 'Carol', address: { city: 'NYC' } }
  ]
};

// Automatically creates dictionary for "address.city"
```

### Token Savings

Real-world examples:

| Dataset | Without Dict | With Dict | Savings |
|---------|--------------|-----------|---------|
| E-commerce orders | 45k tokens | 28k tokens | **38%** |
| Log files | 120k tokens | 65k tokens | **46%** |
| User roles | 8k tokens | 3k tokens | **63%** |

---

## Type Coercion

**Introduced:** v1.1.0  
**Purpose:** Handle "stringified" values from LLMs

### The Problem

LLMs sometimes return numbers or booleans as strings:

```json
{
  "age": "25",        // Should be number
  "active": "true"    // Should be boolean
}
```

### The Solution

Enable type coercion in the encoder:

```typescript
import { ZonEncoder } from 'zon-format';

const encoder = new ZonEncoder(
  undefined,  // anchor interval (default)
  true,       // dictionary compression (default)
  true        // ✅ Enable type coercion
);

const data = {
  users: [
    { age: "25", active: "true" },   // Strings
    { age: "30", active: "false" }
  ]
};

const zon = encoder.encode(data);
// users:@(2):active,age
// T,25      # Coerced to boolean and number
// F,30
```

### How It Works

1. Analyzes entire column
2. Detects if all values are "coercible" (e.g., `"123"` → `123`)
3. Coerces entire column to the target type

### Supported Coercions

| From | To | Example |
|------|-----|---------|
| `"123"` | `123` | Number strings |
| `"true"` | `T` | Boolean strings |
| `"false"` | `F` | Boolean strings |
| `"null"` | `null` | Null strings |

### Decoder Coercion

The decoder also supports type coercion for LLM-generated ZON:

```typescript
import { decode } from 'zon-format';

const options = { enableTypeCoercion: true };
const data = decode(llmOutput, options);
```

---

## LLM-Aware Field Ordering

**Introduced:** v1.1.0  
**Purpose:** Optimize field order for LLM attention

### The Problem

LLMs pay more attention to earlier tokens in a sequence. Default alphabetical sorting may not be optimal:

```
# Alphabetical (default):
users:@(100):active,age,country,email,id,name,role
```

### The Solution

Use `encodeLLM` to reorder fields based on usage pattern:

```typescript
import { encodeLLM } from 'zon-format';

const data = { users: [...] };

// For retrieval tasks: prioritize ID and name
const zon = encodeLLM(data, {
  task: 'retrieval',
  priorityFields: ['id', 'name']
});
/*
users:@(100):id,name,age,role,email,...
*/

// For generation/analysis: prioritize context
const zon2 = encodeLLM(data, {
  task: 'generation',
  priorityFields: ['role', 'country']
});
/*
users:@(100):role,country,id,name,...
*/
```

### Ordering Strategies

```typescript
// 1. Frequency-based: Most common values first
encodeLLM(data, { strategy: 'frequency' });

// 2. Entropy-based: High-information fields first
encodeLLM(data, { strategy: 'entropy' });

// 3. Custom: Your own ordering
encodeLLM(data, { 
  strategy: 'custom',
  fieldOrder: ['id', 'name', 'email', 'role']
});
```

### Measured Impact

| Task | Default Order | Optimized Order | Accuracy Gain |
|------|--------------|-----------------|---------------|
| Entity Extraction | 87% | 94% | **+7%** |
| Data Retrieval | 92% | 98% | **+6%** |
| Classification | 89% | 93% | **+4%** |

---

## Hierarchical Sparse Encoding

**Introduced:** v1.1.0  
**Purpose:** Efficiently encode nested objects with missing fields

### How It Works

Nested fields are flattened with dot notation:

```typescript
const data = {
  users: [
    { id: 1, profile: { bio: 'Developer' } },
    { id: 2, profile: null },
    { id: 3, profile: { bio: 'Designer' } }
  ]
};

// Encoded as:
// users:@(3):id,profile.bio
// 1,Developer
// 2,null
// 3,Designer
```

### Deep Nesting

Supports up to 5 levels of nesting:

```typescript
const data = {
  items: [{
    a: { b: { c: { d: { e: 'Deep!' } } } }
  }]
};

// Flattened to:
// items:@(1):a.b.c.d.e
// Deep!
```

### Sparse Columns

Missing values are preserved:

```typescript
const data = {
  products: [
    { id: 1, meta: { color: 'red', size: 'L' } },
    { id: 2 }, // No meta
    { id: 3, meta: { color: 'blue' } } // No size
  ]
};

// Core: id, meta.color
// Sparse (inline): meta.size
// products:@(3):id,meta.color
// 1,red,meta.size:L
// 2,null
// 3,blue
```

---

## Performance Tips


2. **Dictionary compression**: Best for categorical data (status, roles, countries)
3. **Type coercion**: Enable when dealing with LLM outputs
4. **Field ordering**: Use for retrieval-heavy applications
5. **Sparse encoding**: Automatic, no configuration needed

## See Also

- [API Reference](api-reference.md) - Full API documentation
- [SPEC.md](../SPEC.md) - Format specification
- [LLM Best Practices](llm-best-practices.md) - Using with LLMs
