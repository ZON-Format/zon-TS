# ZON Best Practices

**Version:** 1.3.0

## Encoding Mode Selection

Choose the right encoding mode for your use case to balance token efficiency, readability, and LLM comprehension.

### Mode Selection Guide

| Use Case | Recommended Mode | Why |
|----------|------------------|-----|
| Production APIs | `compact` | Maximum token efficiency |
| Config files | `readable` | Human-editable, git-friendly |
| LLM prompts | `llm-optimized` | Best AI understanding |

| Development/debugging | `readable` | Easiest inspection |
| Caching for LLMs | `compact` or `llm-optimized` | Token efficiency + clarity |

### Example Usage

```typescript
import { encodeAdaptive } from 'zon-format';

// For production APIs (maximum efficiency)
const apiResponse = encodeAdaptive(data, { mode: 'compact' });

// For configuration files (human-editable)
const configFile = encodeAdaptive(config, { mode: 'readable', indent: 2 });

// For LLM prompts (best comprehension)
const llmPrompt = encodeAdaptive(context, { mode: 'llm-optimized' });


```

---

## Data Structure Design

### ✅ Flat Nesting (Highly Recommended)

ZON achieves maximum compression with flat, tabular data structures. Deep nesting reduces efficiency and increases token usage.

**Recommended Pattern:**
```typescript
// ✅ Good: Flat structure
{
  employees: [
    { id: 1, name: "Alice", department: "Engineering", role: "Senior" },
    { id: 2, name: "Bob", department: "Sales", role: "Manager" }
  ]
}
```

**Output (Compact Mode - 52 tokens):**
```zon
employees:@(2):department,id,name,role
Engineering,1,Alice,Senior
Sales,2,Bob,Manager
```

**Anti-Pattern (Avoid):**
```typescript
// ❌ Bad: Deep nesting
{
  company: {
    departments: {
      engineering: {
        employees: [
          { id: 1, name: "Alice", role: "Senior" }
        ]
      },
      sales: {
        employees: [
          { id: 2, name: "Bob", role: "Manager" }
        ]
      }
    }
  }
}
```

**Output (Compact Mode - 98 tokens - 88% more!):**
```zon
company{departments{engineering{employees[{id:1,name:Alice,role:Senior}]},sales{employees[{id:2,name:Bob,role:Manager}]}}}
```

### Why Flat is Better

1. **Table Format Works**: Uniform data → table encoding → massive token savings
2. **Key Compression**: Repeated keys eliminated via column headers

4. **LLM Friendly**: Tabular data is easier for AI to parse
5. **human Readable**: Even compact mode is clearer with tables

### Refactoring Deep Nesting

```typescript
// Before: Deep nesting
const badStructure = {
  users: {
    active: {
      premium: [/* users */],
      free: [/* users */]
    },
    inactive: [/* users */]
  }
};

// After: Flat with metadata
const goodStructure = {
  users: [
    { id: 1, status: "active", tier: "premium", ...data },
    { id: 2, status: "active", tier: "free", ...data },
    { id: 3, status: "inactive", tier: null, ...data }
  ]
};
```

---

## Indentation Configuration

When using `readable` mode, configure indentation to match your project's style guide.

```typescript
// Default: 2 spaces (most common)
encodeAdaptive(data, { mode: 'readable' });

// 4 spaces (Python-style)
encodeAdaptive(data, { mode: 'readable', indent: 4 });

// Compact/flat (0 spaces)
encodeAdaptive(data, { mode: 'readable', indent: 0 });
```

**Output Comparison:**

```zon
// indent: 2 (default)
config:
  theme:dark
  version:1.0

// indent: 4
config:
    theme:dark
    version:1.0

// indent: 0 (flat)
config:
theme:dark
version:1.0
```

---

## Code Organization

### Module Structure

```typescript
// Recommended: Centralize ZON utilities
// src/lib/zon-utils.ts
import { encode, decode, validateZon } from 'zon-format';

export const zonUtils = {
  safeEncode(data: any): string {
    try {
      return encode(data);
    } catch (error) {
      logError('ZON encode failed', error);
      throw error;
    }
  },
  
  safeDecode(zon: string): any {
    const validation = validateZon(zon);
    if (!validation.valid) {
      throw new Error(`Invalid ZON: ${validation.errors[0].message}`);
    }
    return decode(zon);
  }
};
```

## Error Handling

### Always Validate Untrusted Input

```typescript
// ❌ Bad: No validation
app.post('/api/data', (req, res) => {
  const data = decode(req.body);
  processData(data);
});

// ✅ Good: Validate first
app.post('/api/data', (req, res) => {
  try {
    const validation = validateZon(req.body);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid ZON',
        details: validation.errors 
      });
    }
    const data = decode(req.body);
    processData(data);
  } catch (error) {
    return res.status(500).json({ error: 'Processing failed' });
  }
});
```

### Graceful Degradation

```typescript
// Load data with fallback
async function loadUserData(userId: string): Promise<User> {
  try {
    const zon = await cache.get(`user:${userId}`);
    if (zon) return decode(zon);
  } catch (error) {
    logger.warn('Cache read failed, falling back to DB', error);
  }
  
  return await db.users.findById(userId);
}
```

## Performance

### Use Binary for Storage

```typescript
// ❌ Inefficient: Store as JSON
await db.put('data', JSON.stringify(data));

// ✅ Efficient: Store as Binary ZON (40-60% smaller)
await db.put('data', encodeBinary(data));
```

### Batch Operations

```typescript
// ❌ Slow: Individual conversions
for (const item of items) {
  const zon = encode(item);
  await save(zon);
}

// ✅ Fast: Batch converter
const converter = new BatchConverter();
items.forEach(item => converter.add(item, 'json', 'zon'));
const results = converter.convert();
await Promise.all(results.map(save));
```

### Cache Wisely

```typescript
// Cache ZON text for LLM retrieval (fast decode + token efficient)
const zonText = encode(data);
await redis.set(`llm:${key}`, zonText, 'EX', 3600);

// Cache binary for storage (space efficient)
const binary = encodeBinary(data);
await redis.setBuffer(`storage:${key}`, Buffer.from(binary));
```

## Schema Management

### Version All Schemas

```typescript
// ✅ Good: Always version schemas
const userSchema = {
  version: '2.0.0',
  fields: {
    id: zonNumber(),
    name: zonString(),
    email: zonString()
  }
};

// Embed version in data
const versioned = embedVersion(user, '2.0.0', 'user-schema');
```

### Backward Compatibility

```typescript
// ✅ Add default values for new fields
function migrateUser(old: UserV1): UserV2 {
  return {
    ...old,
    email: old.email || `${old.name}@unknown.com`,  // Default
    verified: old.verified ?? false  // Default to false
  };
}
```

## Testing

### Test Round-Trip Encoding

```typescript
test('ZON round-trip preserves data', () => {
  const original = { users: [{ id: 1, name: 'Alice' }] };
  const zon = encode(original);
  const decoded = decode(zon);
  
  expect(decoded).toEqual(original);
});
```

### Test Format Conversions

```typescript
test('Binary ZON equals text ZON', () => {
  const data = { count: 100, items: ['a', 'b'] };
  
  const textZon = encode(data);
  const binary = zonToBinary(textZon);
  const recovered = binaryToZon(binary);
  
  expect(decode(recovered)).toEqual(data);
});
```

### Validate Against Schema

```typescript
test('Data matches schema', () => {
  const schema = zonObject({
    id: zonNumber(),
    name: zonString()
  });
  
  const result = schema.parse({ id: 1, name: 'Test' });
  expect(result.success).toBe(true);
});
```

## Monitoring

### Track Format Usage

```typescript
const formatMetrics = {
  zonRequests: 0,
  jsonRequests: 0,
  binaryRequests: 0
};

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('zon-binary')) formatMetrics.binaryRequests++;
  else if (contentType.includes('zon')) formatMetrics.zonRequests++;
  else formatMetrics.jsonRequests++;
  
  next();
});
```

### Log Validation Failures

```typescript
if (!validation.valid) {
  logger.error('ZON validation failed', {
    errors: validation.errors,
    warnings: validation.warnings,
    source: req.ip,
    endpoint: req.path
  });
}
```

## Security

### Sanitize Input

```typescript
// Check for unsafe content before processing
const { safe, issues } = isSafe(data);
if (!safe) {
  throw new Error(`Unsafe data: ${issues.join(', ')}`);
}
```

### Limit Complexity

```typescript
// Prevent DoS with deeply nested data
const stats = analyze(data);
if (stats.depth > 20) {
  throw new Error('Data nesting too deep');
}
if (stats.totalNodes > 10000) {
  throw new Error('Data too complex');
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const zonLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per windowMs
  message: 'Too many requests'
});

app.use('/api/', zonLimiter);
```

## Documentation

### Document Format Choice

```typescript
/**
 * Get user data
 * 
 * @returns User data in ZON format (optimized for LLM consumption)
 */
async function getUser(id: number): Promise<string> {
  const user = await db.users.get(id);
  return encode(user);  // ZON for token efficiency
}
```

### Document Migration Path

```markdown
## Data Format Migration (v1.0 → v2.0)

**Changes:**
- Added `email` field (required)
- Renamed `username` → `name`
- Removed deprecated `age` field

**Migration:**
1. Run migration script: `npm run migrate:users`
2. Verify: `npm run validate:users`
3. Deploy new version
```

## Common Pitfalls

### Avoid Mixing Formats

```typescript
// ❌ Bad: Inconsistent storage
await db.users.set('1', JSON.stringify(user1));
await db.users.set('2', encode(user2));  // Mixed!

// ✅ Good: Consistent format
const format = 'zon';  // Single source of truth
await db.users.set('1', encode(user1));
await db.users.set('2', encode(user2));
```

### Don't Skip Validation

```typescript
// ❌ Bad: Trust all input
const data = decode(untrustedInput);

// ✅ Good: Validate first
const validation = validateZon(untrustedInput, schema);
if (!validation.valid) throw new Error('Invalid');
const data = decode(untrustedInput);
```

### Remember Format Compatibility

```typescript
// ❌ Bad: Send binary to JSON-only client
res.send(encodeBinary(data));

// ✅ Good: Negotiate format
const accept = req.headers.accept || '';
if (accept.includes('zon-binary')) {
  res.send(encodeBinary(data));
} else {
  res.json(data);  // Fallback to JSON
}
```
