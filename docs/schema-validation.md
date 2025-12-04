# Schema Validation Guide

**Version:** 1.3.0  
**Status:** Stable

## Overview

ZON includes runtime schema validation to ensure data integrity and type safety when working with LLM outputs or untrusted data sources.

## Quick Start

```typescript
import { zon, validate } from 'zon-format';

// Define schema
const UserSchema = zon.object({
  name: zon.string(),
  age: zon.number(),
  email: zon.string().email()
});

// Validate data
const result = validate(zonOutput, UserSchema);

if (result.success) {
  console.log(result.data); // { name: 'Alice', age: 30, email: '...' }
} else {
  console.error(result.errors);
}
```

## Schema Types

### Primitives

```typescript
// String
zon.string()
zon.string().min(3)
zon.string().max(100)
zon.string().email()
zon.string().email()
zon.string().url()
zon.string().uuid()
zon.string().regex(/^[A-Z]+$/)
zon.string().datetime() // ISO 8601
zon.string().date()     // YYYY-MM-DD
zon.string().time()     // HH:MM:SS

// Number
zon.number()
zon.number().min(0)
zon.number().max(100)
zon.number().int() // Integer only

// Boolean
zon.boolean()

// Null
zon.null()

// Literal
zon.literal('active')
zon.literal(42)
zon.literal(true)
```

### Objects

```typescript
const PersonSchema = zon.object({
  name: zon.string(),
  age: zon.number(),
  address: zon.object({
    street: zon.string(),
    city: zon.string(),
    zip: zon.string()
  })
});
```

### Arrays

```typescript
// Array of strings
zon.array(zon.string())

// Array of objects
zon.array(zon.object({
  id: zon.number(),
  name: zon.string()
}))

// Array with min/max length
zon.array(zon.string()).min(1).max(10)
```

### Enums

```typescript
const RoleSchema = zon.enum(['admin', 'user', 'guest']);

// Validation
validate('admin', RoleSchema); // ✅ Success
validate('superadmin', RoleSchema); // ❌ Error
```

### Optional & Nullable

```typescript
const Schema = zon.object({
  required: zon.string(),
  optional: zon.string().optional(), // Can be undefined
  nullable: zon.string().nullable(), // Can be null
  both: zon.string().optional().nullable(), // Can be undefined or null
  withDefault: zon.string().default("guest") // Defaults to "guest" if undefined
});
```

## LLM Guardrails

### Self-Correcting Prompts

Feed validation errors back to the LLM for self-correction:

```typescript
const ProductSchema = zon.object({
  name: zon.string(),
  price: zon.number().min(0),
  category: zon.enum(['Electronics', 'Books', 'Clothing'])
});

let attempts = 0;
let result;

while (attempts < 3) {
  const llmOutput = await callLLM(prompt);
  result = validate(llmOutput, ProductSchema);
  
  if (result.success) {
    break;
  }
  
  // Add errors to next prompt
  prompt += `\n\nPrevious errors:\n${result.errors.join('\n')}\nPlease fix and try again.`;
  attempts++;
}

if (result.success) {
  console.log('Valid data:', result.data);
} else {
  console.error('Failed after 3 attempts');
}
```

### Prompt Generation

Generate schema documentation for system prompts:

```typescript
const UserSchema = zon.object({
  name: zon.string().describe("User's full name"),
  age: zon.number().describe("Age in years"),
  role: zon.enum(['admin', 'user']).describe("Access level")
});

const prompt = UserSchema.toPrompt();
console.log(prompt);
/*
object:
  - name: string - User's full name
  - age: number - Age in years
  - role: enum(admin, user) - Access level
*/
```

Use in system messages:

```typescript
const systemMessage = `
You are an API. Respond in ZON format with this structure:
${UserSchema.toPrompt()}
`;
```

## Common Patterns

### API Response Validation

```typescript
const ApiResponseSchema = zon.object({
  success: zon.boolean(),
  data: zon.array(zon.object({
    id: zon.number(),
    title: zon.string(),
    created: zon.string()
  })),
  error: zon.string().optional()
});

const response = await fetch('/api/data');
const zonData = await response.text();
const result = validate(zonData, ApiResponseSchema);

if (!result.success) {
  throw new Error(`Invalid API response: ${result.errors.join(', ')}`);
}
```

### Form Validation

```typescript
const FormSchema = zon.object({
  email: zon.string().email(),
  password: zon.string().min(8),
  confirmPassword: zon.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match"
});

const result = validate(formData, FormSchema);
if (!result.success) {
  displayErrors(result.errors);
}
```

### Database Inserts

```typescript
const InsertSchema = zon.object({
  userId: zon.number().int(),
  content: zon.string().min(1).max(1000),
  tags: zon.array(zon.string()).max(5)
});

const result = validate(userInput, InsertSchema);
if (result.success) {
  await db.insert('posts', result.data);
}
```

## Error Handling

### Error Format

```typescript
{
  success: false,
  errors: [
    "Invalid type: expected string, got number at path 'name'",
    "Value out of range: age must be >= 0",
    "Invalid enum value: role must be one of [admin, user]"
  ]
}
```

### Custom Error Messages

```typescript
const Schema = zon.object({
  age: zon.number().min(18, "Must be 18 or older"),
  email: zon.string().email("Invalid email address")
});
```

## Advanced

### Recursive Schemas

```typescript
interface Category {
  name: string;
  children?: Category[];
}

const CategorySchema: ZonSchema = zon.object({
  name: zon.string(),
  children: zon.array(zon.lazy(() => CategorySchema)).optional()
});
```

### Union Types

```typescript
const IdSchema = zon.union([
  zon.number(),
  zon.string()
]);

validate(123, IdSchema); // ✅
validate('abc-123', IdSchema); // ✅
validate(true, IdSchema); // ❌
```

### Custom Validators

```typescript
const PasswordSchema = zon.string().refine(
  (val) => /^(?=.*[A-Z])(?=.*[0-9])/.test(val),
  "Password must contain uppercase and number"
);
```

## Performance

- **Validation Time:** ~0.01ms per field
- **Memory:** O(depth) stack usage
- **Recommended:** Validate once at API boundaries, not in hot loops

## Best Practices

1. **Define schemas at module level** - Reuse across requests
2. **Use `.describe()`** - Document fields for LLM prompts
3. **Fail fast** - Validate early in your pipeline
4. **Log validation errors** - Help debug LLM outputs
5. **Don't over-constrain** - LLMs struggle with complex rules

## See Also

- [API Reference](api-reference.md) - Full schema API
- [LLM Best Practices](llm-best-practices.md) - Using schemas with LLMs
