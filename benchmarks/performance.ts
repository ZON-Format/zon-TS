import { encode, decode } from '../src/index';
import * as msgpack from 'msgpack-lite';
import { encode as gptEncode } from 'gpt-tokenizer';
import * as fs from 'fs';
import * as path from 'path';

// Datasets
const hikingData = {
  context: {
    task: 'Our favorite hikes together',
    location: 'Boulder',
    season: 'spring_2025'
  },
  friends: ['ana', 'luis', 'sam'],
  hikes: [
    { id: 1, name: 'Blue Lake Trail', distanceKm: 7.5, elevationGain: 320, companion: 'ana', wasSunny: true },
    { id: 2, name: 'Ridge Overlook', distanceKm: 9.2, elevationGain: 540, companion: 'luis', wasSunny: false },
    { id: 3, name: 'Wildflower Loop', distanceKm: 5.1, elevationGain: 180, companion: 'sam', wasSunny: true }
  ]
};

const largeArray = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  value: Math.random() * 1000,
  active: i % 2 === 0,
  tags: ['a', 'b', 'c']
}));

const nestedObject = {
  level1: {
    name: 'Root',
    children: Array.from({ length: 10 }, (_, i) => ({
      id: i,
      level2: {
        name: `Child ${i}`,
        children: Array.from({ length: 5 }, (_, j) => ({
          id: j,
          level3: {
            name: `Grandchild ${j}`,
            value: Math.random()
          }
        }))
      }
    }))
  }
};

const datasets = [
  { name: 'Hiking (Small, Mixed)', data: hikingData },
  { name: 'Large Array (1k items)', data: largeArray },
  { name: 'Nested Object (Deep)', data: nestedObject }
];

function measure(name: string, data: any) {
  console.log(`\n--- ${name} ---`);
  
  // JSON
  const jsonStart = performance.now();
  const jsonStr = JSON.stringify(data);
  const jsonEnd = performance.now();
  const jsonParseStart = performance.now();
  JSON.parse(jsonStr);
  const jsonParseEnd = performance.now();
  const jsonSize = Buffer.byteLength(jsonStr);
  const jsonTokens = gptEncode(jsonStr).length;

  // MsgPack
  const msgpackStart = performance.now();
  const msgpackBuf = msgpack.encode(data);
  const msgpackEnd = performance.now();
  const msgpackParseStart = performance.now();
  msgpack.decode(msgpackBuf);
  const msgpackParseEnd = performance.now();
  const msgpackSize = msgpackBuf.length;
  // MsgPack is binary, tokens not applicable directly for LLM context, but size matters for storage/network.
  // We'll skip token count for MsgPack or assume base64 if sent to LLM (which bloats it).

  // ZON
  const zonStart = performance.now();
  const zonStr = encode(data);
  const zonEnd = performance.now();
  const zonParseStart = performance.now();
  decode(zonStr);
  const zonParseEnd = performance.now();
  const zonSize = Buffer.byteLength(zonStr);
  const zonTokens = gptEncode(zonStr).length;

  console.table({
    'JSON': {
      'Size (bytes)': jsonSize,
      'Tokens (GPT)': jsonTokens,
      'Encode (ms)': (jsonEnd - jsonStart).toFixed(3),
      'Decode (ms)': (jsonParseEnd - jsonParseStart).toFixed(3)
    },
    'MsgPack': {
      'Size (bytes)': msgpackSize,
      'Tokens (GPT)': 'N/A',
      'Encode (ms)': (msgpackEnd - msgpackStart).toFixed(3),
      'Decode (ms)': (msgpackParseEnd - msgpackParseStart).toFixed(3)
    },
    'ZON': {
      'Size (bytes)': zonSize,
      'Tokens (GPT)': zonTokens,
      'Encode (ms)': (zonEnd - zonStart).toFixed(3),
      'Decode (ms)': (zonParseEnd - zonParseStart).toFixed(3)
    }
  });

  const savings = ((jsonTokens - zonTokens) / jsonTokens * 100).toFixed(1);
  console.log(`ZON Token Savings vs JSON: ${savings}%`);
}

async function run() {
  for (const ds of datasets) {
    measure(ds.name, ds.data);
  }
}

run();
