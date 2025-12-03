import { encode, encodeAdaptive } from '../src/index';

// Sample dataset for demonstration
const sampleData = {
  users: [
    { id: 1, name: "Alice Smith", email: "alice@example.com", active: true, role: "admin" },
    { id: 2, name: "Bob Jones", email: "bob@example.com", active: false, role: "user" },
    { id: 3, name: "Carol White", email: "carol@example.com", active: true, role: "editor" }
  ],
  config: {
    theme: "dark",
    version: "1.2.0",
    features: {
      beta: true,
      analytics: false
    }
  },
  metadata: {
    generated: "2025-01-15T10:30:00Z",
    source: "demo-app"
  }
};

console.log("=== ZON Encoding Modes Demo ===\n");

// ==========================================
// 1. COMPACT MODE - Maximum compression (DEFAULT)
// ==========================================
console.log("1. COMPACT MODE (maximum compression, DEFAULT):");
console.log("-----------------------------------------------");
const compactResult = encodeAdaptive(sampleData, { mode: 'compact' });
console.log(compactResult);
console.log("\n");

// ==========================================
// 2. READABLE MODE - Human-friendly YAML-like
// ==========================================
console.log("2. READABLE MODE (human-friendly, YAML-like):");
console.log("---------------------------------------------");
const readableResult = encodeAdaptive(sampleData, { mode: 'readable' });
console.log(readableResult);
console.log("\n");

// ==========================================
// 3. LLM-OPTIMIZED MODE - Balance clarity & tokens
// ==========================================
console.log("3. LLM-OPTIMIZED MODE (balance clarity & tokens):");
console.log("--------------------------------------------------");
const llmResult = encodeAdaptive(sampleData, { mode: 'llm-optimized' });
console.log(llmResult);
console.log("\n");

// ==========================================
// INDENTATION CONTROL (Readable Mode)
// ==========================================
console.log("=== Indentation Control ===\n");

const nestedData = {
  level1: {
    level2: {
      level3: {
        value: "deep"
      }
    }
  }
};

console.log("Default (2 spaces):");
console.log(encodeAdaptive(nestedData, { mode: 'readable' }));
console.log("\n");

console.log("4 spaces:");
console.log(encodeAdaptive(nestedData, { mode: 'readable', indent: 4 }));
console.log("\n");

console.log("0 spaces (flat):");
console.log(encodeAdaptive(nestedData, { mode: 'readable', indent: 0 }));
console.log("\n");

// ==========================================
// encode() vs encodeAdaptive()
// ==========================================
console.log("=== encode() vs encodeAdaptive() ===\n");

const simpleData = { name: "Alice", age: 30, active: true };

console.log("Using encode() with manual options:");
console.log(encode(simpleData, {
  enableDictCompression: false,
  enableTypeCoercion: false
}));
console.log("\n");

console.log("Using encodeAdaptive() with mode:");
console.log(encodeAdaptive(simpleData, { mode: 'readable' }));
console.log("\n");

// ==========================================
// FLAT vs NESTED (Best Practice)
// ==========================================
console.log("=== Flat vs Nested Structures ===\n");

const flatData = {
  employees: [
    { id: 1, name: "Alice", department: "Engineering" },
    { id: 2, name: "Bob", department: "Sales" }
  ]
};

const nestedDataBad = {
  company: {
    departments: {
      engineering: {
        employees: [{ id: 1, name: "Alice" }]
      },
      sales: {
        employees: [{ id: 2, name: "Bob" }]
      }
    }
  }
};

console.log("RECOMMENDED (Flat structure):");
console.log(encodeAdaptive(flatData, { mode: 'compact' }));
console.log("\n");

console.log("AVOID (Deep nesting):");
console.log(encodeAdaptive(nestedDataBad, { mode: 'compact' }));
console.log("\n");

console.log("Flat structure achieves better compression and token efficiency!");
