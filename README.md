# ZON Format v1.0.2 - TypeScript/JavaScript

**Zero Overhead Notation** - A human-readable data serialization format optimized for LLM token efficiency, JSON for LLMs.

[![npm version](https://img.shields.io/npm/v/zon-format.svg)](https://www.npmjs.com/package/zon-format)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-orange.svg)](LICENSE)

> 🚀 **24-40% better compression than TOON** | 📊 **30-42% compression vs JSON** | 🔍 **100% Human Readable**

---

## 📚 Table of Contents

- [What is ZON?](#-what-is-zon)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Format Reference](#-format-reference)

---

## 🚀 What is ZON?

ZON is a **smart compression format** designed specifically for transmitting structured data to Large Language Models. Unlike traditional compression (which creates binary data), ZON remains **100% human-readable** while dramatically reducing token usage.

### Why ZON?

| Problem | Solution |
| :--- | :--- |
| 💸 **High LLM costs** from verbose JSON | ZON reduces tokens by 30-42% |
| 🔍 **Binary formats aren't debuggable** | ZON is plain text - you can read it! |
| 🎯 **One-size-fits-all compression** | ZON auto-selects optimal strategy per column |

### Key Features

- ✅ **Entropy Tournament**: Auto-selects best compression strategy per column
- ✅ **100% Safe**: Guaranteed lossless reconstruction
- ✅ **Zero Configuration**: Works out of the box
- ✅ **TypeScript Support**: Full type definitions included

---

## ⚡ Quick Start

```typescript
import { encode, decode } from 'zon-format';

// Your data
const users = {
  context: {
    task: "Our favorite hikes together",
    location: "Boulder",
    season: "spring_2025"
  },
  friends: ["ana", "luis", "sam"],
  hikes: [
    {
      id: 1,
      name: "Blue Lake Trail",
      distanceKm: 7.5,
      elevationGain: 320,
      companion: "ana",
      wasSunny: true
    },
    {
      id: 2,
      name: "Ridge Overlook",
      distanceKm: 9.2,
      elevationGain: 540,
      companion: "luis",
      wasSunny: false
    },
    {
      id: 3,
      name: "Wildflower Loop",
      distanceKm: 5.1,
      elevationGain: 180,
      companion: "sam",
      wasSunny: true
    }
  ]
};

// Encode (compress)
const compressed = encode(users);
console.log(compressed);

// Decode (decompress)
const original = decode(compressed);
console.log(original); // Exact match!
```

**Output (ZON format - 96 tokens, 264 bytes):**
```
context:"{task:Our favorite hikes together,location:Boulder,season:spring_2025}"
friends:"[ana,luis,sam]"

@hikes(3):companion,distanceKm,elevationGain,id,name,wasSunny
ana,7.5,320,1,Blue Lake Trail,T
luis,9.2,540,2,Ridge Overlook,F
sam,5.1,180,3,Wildflower Loop,T
```

**vs JSON (compact - 139 tokens, 451 bytes)**

---

## 📦 Installation

### From npm

```bash
npm install zon-format
```

### From yarn

```bash
yarn add zon-format
```

### Verify Installation

```typescript
import { encode, decode } from 'zon-format';

const data = { message: "Hello ZON!" };
const encoded = encode(data);
console.log(encoded); // message:Hello ZON!

const decoded = decode(encoded);
console.log(decoded); // { message: "Hello ZON!" }
```

---

## 📚 API Reference

### `encode(data, anchorInterval?)`

Encodes a JavaScript object or array into a ZON-formatted string.

**Parameters:**
- `data` (any): The input data to encode. Must be JSON-serializable (object, array, string, number, boolean, null).
- `anchorInterval` (number, optional): Legacy parameter, defaults to 50. Not used in v1.0.2.

**Returns:**
- `string`: The ZON-encoded string.

**Example:**
```typescript
import { encode } from 'zon-format';

const data = { id: 1, name: "Alice" };
const zonStr = encode(data);
console.log(zonStr);
// Output: id:1
//         name:Alice
```

---

### `decode(zonStr)`

Decodes a ZON-formatted string back into a JavaScript object or array.

**Parameters:**
- `zonStr` (string): The ZON-encoded string to decode.

**Returns:**
- `any`: The decoded JavaScript object or array.

**Example:**
```typescript
import { decode } from 'zon-format';

const zonStr = `id:1
name:Alice`;

const data = decode(zonStr);
console.log(data); // { id: 1, name: "Alice" }
```

---

## 🤖 Examples

### Basic Usage

```typescript
import { encode, decode } from 'zon-format';

// Simple object
const user = { name: "Alice", age: 30, active: true };
const encoded = encode(user);
const decoded = decode(encoded);
// decoded === { name: "Alice", age: 30, active: true }
```

### Array of Objects (Table Format)

```typescript
import { encode, decode } from 'zon-format';

const products = [
  { id: 1, name: "Laptop", price: 999, inStock: true },
  { id: 2, name: "Mouse", price: 29, inStock: true },
  { id: 3, name: "Keyboard", price: 79, inStock: false }
];

const encoded = encode(products);
console.log(encoded);
// Output:
// @data(3):id,inStock,name,price
// 1,T,Laptop,999
// 2,T,Mouse,29
// 3,F,Keyboard,79

const decoded = decode(encoded);
// decoded === products (exact match)
```

### Mixed Metadata and Table

```typescript
import { encode, decode } from 'zon-format';

const report = {
  title: "Q1 Sales Report",
  year: 2024,
  quarter: 1,
  sales: [
    { month: "Jan", revenue: 50000, expenses: 30000 },
    { month: "Feb", revenue: 55000, expenses: 32000 },
    { month: "Mar", revenue: 60000, expenses: 35000 }
  ]
};

const encoded = encode(report);
const decoded = decode(encoded);
// Perfect reconstruction
```

### Nested Objects

```typescript
import { encode, decode } from 'zon-format';

const config = {
  app: {
    name: "MyApp",
    version: "1.0.0",
    features: {
      authentication: true,
      logging: true,
      caching: false
    }
  }
};

const encoded = encode(config);
const decoded = decode(encoded);
// Nested structure preserved
```

### LLM Integration Example

```typescript
import { encode } from 'zon-format';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Prepare data
const users = [
  { id: 1, name: "Alice", purchases: 15, total: 1500 },
  { id: 2, name: "Bob", purchases: 8, total: 800 },
  // ... 100 more users
];

// Compress with ZON (saves tokens = saves money!)
const zonData = encode(users);

// Use in prompt
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    {
      role: "system",
      content: "You will receive data in ZON format. Decode mentally and analyze."
    },
    {
      role: "user",
      content: `Analyze this user data:\n\n${zonData}\n\nWhat's the average purchase total?`
    }
  ]
});

console.log(response.choices[0].message.content);
// Cost Savings: ~30-40% fewer tokens vs JSON!
```

---

## 📖 Format Reference

### Metadata (YAML-like)

```
key:value
nested.key:value
list:[item1,item2,item3]
```

- No spaces after `:` for compactness
- Dot notation for nested objects
- Minimal quoting (only when necessary)

### Tables (@table syntax)

```
@tablename(count):col1,col2,col3
val1,val2,val3
val1,val2,val3
```

- `@` marks table start
- `(count)` shows row count
- Columns separated by commas (no spaces)

### Compression Tokens

| Token | Meaning | Example |
|-------|---------|---------|
| `T` | Boolean true | `T` instead of `true` |
| `F` | Boolean false | `F` instead of `false` |

### Type Handling

- **Booleans**: Encoded as `T` or `F`
- **Null**: Encoded as `null`
- **Numbers**: Preserved with exact representation
- **Floats**: Always include decimal point (e.g., `42.0`)
- **Strings**: Minimal quoting, quoted only when needed
- **Objects/Arrays**: Inline ZON format `{key:val}` or `[val1,val2]`

---

## 🧪 Testing

Run tests:
```bash
npm test
```

Build:
```bash
npm run build
```

---

## 🤝 Contributing

This is a port of the original Python implementation. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

---

## 📄 License

**Apache-2.0 License**

Copyright (c) 2025 Roni Bhakta. All Rights Reserved.

See [LICENSE](LICENSE) for full terms.

---

## 🙏 Acknowledgments

- Original Python implementation: [ZON-Format/ZON](https://github.com/ZON-Format/ZON)
- Inspired by TOON format for LLM token efficiency
- TypeScript port maintains 100% compatibility with Python version

---

## ✉️ Support

- **Issues**: [GitHub Issues](https://github.com/ZON-Format/zon-TS/issues)
- **Original Docs**: [Python ZON](https://github.com/ZON-Format/ZON)

---

**Made with ❤️ for the LLM community**

*ZON v1.0.2 - Compression that scales with complexity*
