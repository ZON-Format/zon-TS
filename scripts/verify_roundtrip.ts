
import * as fs from 'fs';
import * as path from 'path';
import { encode, decode } from '../src/index';
import * as assert from 'assert';

const EXAMPLES_DIR = path.join(process.cwd(), 'examples');

console.log(`Verifying roundtrip for examples in ${EXAMPLES_DIR}...\n`);

const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.json'));

let passed = 0;
let failed = 0;

files.forEach(file => {
  const jsonPath = path.join(EXAMPLES_DIR, file);
  const originalJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  try {
    // 1. Encode original JSON -> ZON
    const encodedZon = encode(originalJson);
    
    // 2. Decode ZON -> JSON
    const decodedJson = decode(encodedZon);
    
    // 3. Compare (ignoring key order)
    const sortedOriginal = sortKeys(originalJson);
    const sortedDecoded = sortKeys(decodedJson);
    
    assert.deepStrictEqual(sortedDecoded, sortedOriginal);
    console.log(`✅ ${file}: Roundtrip successful`);
    passed++;
  } catch (e: any) {
    console.error(`❌ ${file}: Roundtrip FAILED`);
    console.error('Error:', e.message);
    // console.error('Original:', JSON.stringify(originalJson, null, 2));
    // if (typeof decodedJson !== 'undefined') {
    //   console.error('Decoded :', JSON.stringify(decodedJson, null, 2));
    // }
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}
