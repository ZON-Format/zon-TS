# ZON Production Architecture Guide

## Overview

This guide provides comprehensive patterns and best practices for deploying ZON in production environments. It covers format selection, versioning strategies, performance optimization, and integration patterns.

## Multi-Format Strategy

### Decision Tree

```
┌─────────────────────────────────┐
│   What is your use case?       │
└─────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
 External API          Internal Service
    │                       │
    ▼                       ▼
┌─────────┐           ┌──────────┐
│ ZON Text│           │  Binary  │
│ (Human  │           │   ZON    │
│readable)│           │(Fast,    │
└─────────┘           │compact)  │
                      └──────────┘
```

### Format Selection Guidelines

| Use Case | Format | Rationale |
|----------|--------|-----------|
| **LLM Context** | ZON Text | Token-efficient, LLM-readable |
| **Storage (DB)** | Binary ZON | 40-60% space savings |
| **APIs (External)** | ZON Text or JSON | Compatibility, debugging |
| **APIs (Internal)** | Binary ZON | Performance, bandwidth |
| **Caching** | ZON Text | Fast decode for LLMs |
| **Logging** | ZON Text | Human-readable |

## Versioning Workflows

### Schema Evolution Pattern

```typescript
import { embedVersion, ZonMigrationManager } from 'zon-format';

// Define migrations
const migrationManager = new ZonMigrationManager();

migrationManager.registerMigration('1.0.0', '2.0.0', (data) => {
  // Add new email field with default
  data.users = data.users.map(u => ({
    ...u,
    email: u.email || `${u.name.toLowerCase()}@example.com`
  }));
  return data;
});

// Save with version
const versioned = embedVersion(data, '2.0.0', 'user-schema');
const zon = encode(versioned);

// Load and migrate
const loaded = decode(zon);
const migrated = migrationManager.migrate(loaded, '2.0.0');
```

### Backward Compatibility

**Expand → Switch → Contract Pattern:**

1. **Expand**: Add new fields with defaults
2. **Switch**: Update clients to use new fields
3. **Contract**: Remove old fields after migration

```typescript
// Step 1: Expand (v1.1.0)
type UserV1_1 = {
  id: number;
  name: string;
  fullName?: string;  // NEW: optional
};

// Step 2: Switch (v2.0.0)
type UserV2 = {
  id: number;
  fullName: string;   // Required now
};

// Step 3: Contract (v2.1.0)
// name field removed, all clients migrated
```

## Adaptive Encoding Patterns

### Mode Selection
 
 ```typescript
 import { encodeAdaptive } from 'zon-format';
 
 // Encode with compact mode (default)
 const compact = encodeAdaptive(data, { mode: 'compact' });
 
 // Encode with readable mode for debugging
 const readable = encodeAdaptive(data, { mode: 'readable' });
 ```

### Use Case-Specific Modes

```typescript
// LLM-optimized for AI context
const llmData = encodeAdaptive(data, {
  mode: 'llm-optimized',
  complexityThresholds: {
    maxNesting: 5,
    maxIrregularity: 0.3
  }
});

// Compact for storage
const storageData = encodeAdaptive(data, {
  mode: 'compact'
});

// Readable for debugging
const debugData = encodeAdaptive(data, {
  mode: 'readable'
});
```

## Binary Format Usage

### Storage Optimization

```typescript
import { encodeBinary, decodeBinary } from 'zon-format';

// Save to database
const binary = encodeBinary(data);
await db.put('users', binary);

// Load from database
const loaded = await db.get('users');
const data = decodeBinary(loaded);
```

### API Transmission

```typescript
// Server sends binary for performance
app.get('/api/data', (req, res) => {
  const data = getDataFromDB();
  const binary = encodeBinary(data);
  
  res.type('application/zon-binary');
  res.send(Buffer.from(binary));
});

// Client receives and decodes
const response = await fetch('/api/data');
const buffer = await response.arrayBuffer();
const data = decodeBinary(new Uint8Array(buffer));
```

## API Gateway Pattern

### Content Negotiation

```typescript
import express from 'express';
import { encode, decode, encodeBinary, decodeBinary } from 'zon-format';

function zonMiddleware() {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];
    const accept = req.headers.accept || '';
    
    // Decode request
    if (contentType === 'application/zonf') {
      req.body = decode(req.body.toString());
    } else if (contentType === 'application/zon-binary') {
      req.body = decodeBinary(req.body);
    }
    
    // Wrap response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (accept.includes('application/zon-binary')) {
        res.type('application/zon-binary');
        return res.send(Buffer.from(encodeBinary(data)));
      } else if (accept.includes('application/zonf')) {
        res.type('application/zonf');
        return res.send(encode(data));
      }
      return originalJson(data);
    };
    
    next();
  };
}

app.use(zonMiddleware());
```

## Performance Optimization

### Caching Strategy

```typescript
import { encode, decode } from 'zon-format';
import Redis from 'ioredis';

const redis = new Redis();

async function getCachedData(key: string) {
  // Cache stores ZON text for fast decode + LLM usage
  const cached = await redis.get(key);
  if (cached) {
    return decode(cached);
  }
  
  const data = await fetchFromDB(key);
  await redis.set(key, encode(data), 'EX', 3600);
  return data;
}
```

### Batch Operations

```typescript
import { BatchConverter } from 'zon-format';

async function migrateBatch(files: string[]) {
  const converter = new BatchConverter();
  
  files.forEach(file => {
    const data = readFile(file);
    converter.add(data, 'json', 'zon');
  });
  
  const results = converter.convert();
  // Process all conversions in parallel
}
```

## Monitoring & Observability

### Size Tracking

```typescript
import { compareFormats } from 'zon-format';

function logFormatStats(data: any, label: string) {
  const stats = compareFormats(data);
  
  console.log(`[${label}] Format Sizes:`);
  console.log(`  ZON:    ${stats.zon} bytes`);
  console.log(`  Binary: ${stats.binary} bytes (${stats.savings.binaryVsZon.toFixed(1)}% savings)`);
  console.log(`  JSON:   ${stats.json} bytes`);
}
```

### Validation in Production

```typescript
import { validateZon, lintZon } from 'zon-format';

app.post('/api/data', (req, res) => {
  const zon = req.body;
  
  // Validate before processing
  const result = validateZon(zon);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  
  // Log warnings
  if (result.warnings.length > 0) {
    logger.warn('ZON has warnings', { warnings: result.warnings });
  }
  
  const data = decode(zon);
  // Process...
});
```

## Migration Patterns

### Gradual Rollout

```typescript
// Phase 1: Dual-write (write both JSON and ZON)
async function saveData(data: any) {
  await db.put('data:json', JSON.stringify(data));
  await db.put('data:zon', encode(data));
}

// Phase 2: Dual-read (read ZON, fallback to JSON)
async function loadData(): Promise<any> {
  const zon = await db.get('data:zon');
  if (zon) return decode(zon);
  
  const json = await db.get('data:json');
  return JSON.parse(json);
}

// Phase 3: ZON-only (remove JSON writes)
async function saveDataV2(data: any) {
  await db.put('data:zon', encode(data));
}
```

## Security Considerations

### Input Validation

```typescript
import { isSafe, validateZon } from 'zon-format';

function secureProcess(untrustedZon: string) {
  // Always validate untrusted input
  const validation = validateZon(untrustedZon);
  if (!validation.valid) {
    throw new Error('Invalid ZON');
  }
  
  const data = decode(untrustedZon);
  
  // Check for unsafe content
  const safety = isSafe(data);
  if (!safety.safe) {
    throw new Error(`Unsafe data: ${safety.issues.join(', ')}`);
  }
  
  return data;
}
```

## Next Steps

- See [Best Practices](./best-practices.md) for coding guidelines
- See [Migration Guide](./migration-guide.md) for detailed migration steps
- See [Performance Guide](./performance-guide.md) for optimization tips
- Check [examples/production/](../examples/production/) for working code
