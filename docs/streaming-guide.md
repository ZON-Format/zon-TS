# Streaming Guide

**Version:** 1.3.0  
**Status:** Stable

## Overview

ZON provides streaming support for processing large datasets that exceed available memory. The streaming API uses async generators to encode and decode data incrementally, making it ideal for:

- Processing multi-gigabyte datasets
- Real-time data pipelines
- Log file analysis
- Streaming API responses

## Streaming Encoder

### Basic Usage

```typescript
import { ZonStreamEncoder } from 'zon-format';

const encoder = new ZonStreamEncoder();

async function* generateData() {
  for (let i = 0; i < 1000000; i++) {
    yield { id: i, name: `Item ${i}`, value: Math.random() };
  }
}

// Stream encoding
for await (const chunk of encoder.encode(generateData())) {
  process.stdout.write(chunk);
}
```

### Output Format

The stream encoder produces anonymous table format:

```
@:id,name,value
1,Item 1,0.543
2,Item 2,0.891
...
```

**Note:** Row count is omitted in streaming mode since the total is unknown upfront.

## Streaming Decoder

### Basic Usage

```typescript
import { ZonStreamDecoder } from 'zon-format';

const decoder = new ZonStreamDecoder();

async function* readChunks() {
  // Simulate reading from file/network
  yield '@:id,name\n';
  yield '1,Alice\n';
  yield '2,Bob\n';
}

for await (const obj of decoder.decode(readChunks())) {
  console.log(obj); // { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }
}
```

### Handling Split Lines

The decoder automatically buffers incomplete lines:

```typescript
async function* splitData() {
  yield '@:id,na';         // Header split mid-column
  yield 'me\n1,Alice\n';   // Completes header, adds row
}

// Works correctly despite split
for await (const obj of decoder.decode(splitData())) {
  console.log(obj); // { id: 1, name: 'Alice' }
}
```

## Use Cases

### 1. File Processing

```typescript
import { createReadStream } from 'fs';
import { ZonStreamDecoder } from 'zon-format';

const decoder = new ZonStreamDecoder();

async function* readFile(path: string) {
  const stream = createReadStream(path, 'utf-8');
  for await (const chunk of stream) {
    yield chunk;
  }
}

for await (const record of decoder.decode(readFile('large-data.zonf'))) {
  // Process one record at a time
  await processRecord(record);
}
```

### 2. HTTP Streaming

```typescript
async function* fetchStream(url: string) {
  const response = await fetch(url);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

const zonDecoder = new ZonStreamDecoder();
for await (const item of zonDecoder.decode(fetchStream('/api/data'))) {
  console.log(item);
}
```

### 3. ETL Pipeline

```typescript
async function* etlPipeline() {
  const encoder = new ZonStreamEncoder();
  
  // Extract from database
  const query = db.query('SELECT * FROM users');
  
  // Transform & stream
  for await (const chunk of encoder.encode(query)) {
    yield chunk;
  }
}

// Load to file
const outputStream = createWriteStream('users.zonf');
for await (const chunk of etlPipeline()) {
  outputStream.write(chunk);
}
```

## Performance Characteristics

- **Memory Usage:** O(1) - constant memory regardless of dataset size
- **Latency:** First object available as soon as header is parsed
- **Throughput:** ~100k objects/second on modern hardware

## Limitations

- **Table-only:** Stream encoder only supports uniform objects (tables)
- **No count:** Row count is unknown in streaming mode
- **Single table:** One table per stream (no metadata mixing)

## See Also

- [API Reference](api-reference.md) - Full API documentation
- [Vercel AI SDK Integration](integrations.md#vercel-ai-sdk) - Streaming in Next.js apps
