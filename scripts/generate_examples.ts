import * as fs from 'fs';
import * as path from 'path';
import { encode } from '../src/index';
const datasets = require('../benchmarks/datasets');

const EXAMPLES_DIR = path.join(process.cwd(), 'examples');

if (!fs.existsSync(EXAMPLES_DIR)) {
  fs.mkdirSync(EXAMPLES_DIR);
}

const simpleKeyValue = {
  name: "ZON Format",
  version: "1.0.5",
  active: true,
  score: 98.5,
  description: null
};

const arrayOfPrimitives = [
  "apple", "banana", "cherry", "date", "elderberry"
];

const simpleTable = [
  { id: 1, name: "Alice", role: "Admin" },
  { id: 2, name: "Bob", role: "User" },
  { id: 3, name: "Charlie", role: "Guest" }
];

const employees = [
  { id: 101, name: "John Doe", department: "Engineering", salary: 85000, active: true },
  { id: 102, name: "Jane Smith", department: "Marketing", salary: 72000, active: true },
  { id: 103, name: "Sam Brown", department: "Engineering", salary: 90000, active: false },
  { id: 104, name: "Emily Davis", department: "HR", salary: 65000, active: true }
];

const mixedStructure = {
  metadata: {
    generated: "2025-01-01T12:00:00Z",
    source: "System A"
  },
  items: [
    { id: 1, value: 100 },
    { id: 2, value: 200 }
  ]
};

const nestedObjects = {
  orderId: "ORD-123",
  customer: {
    name: "Alice",
    address: {
      street: "123 Main St",
      city: "Wonderland"
    }
  },
  items: [
    { productId: "P1", qty: 2, price: 10.5 },
    { productId: "P2", qty: 1, price: 20.0 }
  ]
};

const deepConfig = {
  app: {
    server: {
      host: "localhost",
      port: 8080,
      options: {
        timeout: 5000,
        retry: 3
      }
    },
    database: {
      primary: { connection: "db://primary" },
      replica: { connection: "db://replica" }
    }
  }
};

const heavilyNested = {
  level1: {
    level2: {
      level3: {
        level4: {
          data: [1, 2, 3],
          info: "Deep"
        }
      }
    }
  }
};

const examples = [
  { name: '01_simple_key_value', data: simpleKeyValue, desc: 'Simple Key-Value Object' },
  { name: '02_array_of_primitives', data: arrayOfPrimitives, desc: 'Array of Strings' },
  { name: '03_simple_table', data: simpleTable, desc: 'Simple Array of Objects (Table)' },
  { name: '04_uniform_table', data: employees, desc: 'Uniform Tabular Data (Employees)' },
  { name: '05_mixed_structure', data: mixedStructure, desc: 'Mixed Structure (Metadata + Table)' },
  { name: '06_nested_objects', data: nestedObjects, desc: 'Nested Objects & Arrays' },
  { name: '07_deep_config', data: deepConfig, desc: 'Deeply Nested Configuration' },
  { name: '08_complex_nested', data: heavilyNested, desc: 'Heavily Nested Complex Data' },
  { name: '09_unified_dataset', data: datasets.unifiedDataset, desc: 'Unified Benchmark Dataset' },
  { 
    name: '10_dirty_data', 
    data: {
      primitives: {
        integers: [0, 1, -1, 42, -42, 9007199254740991, -9007199254740991],
        floats: [0.0, 1.1, -1.1, 3.14159, -2.71828, 1.5e10, 1.5e-10],
        booleans: [true, false],
        nulls: [null],
        strings: [
          "", " ", "simple", "with spaces", "with, comma", "with: colon",
          "with \"quotes\"", "with 'single quotes'", "with \\n newline",
          "https://example.com/path?query=1&param=2",
          "special: !@#$%^&*()_+{}[]|\\\\:;\"'<>,.?/~`"
        ]
      },
      edge_cases: {
        empty_obj: {},
        empty_arr: [],
        nested_empty: { a: {}, b: [] },
        mixed_arr: [1, "two", true, null, { a: 1 }, [2]]
      }
    }, 
    desc: 'Dirty Data (All Types & Edge Cases)' 
  },
  {
    name: '11_complex_nested',
    data: {
      level1: {
        id: "L1",
        meta: { created: "2025-01-01", active: true },
        children: [
          {
            id: "L2-A",
            type: "group",
            items: [
              { id: "L3-A1", val: 10, tags: ["a", "b"] },
              { id: "L3-A2", val: 20, tags: ["c"] }
            ],
            config: {
              settings: {
                deep: {
                  deeper: {
                    deepest: "value"
                  }
                }
              }
            }
          },
          {
            id: "L2-B",
            type: "leaf",
            data: [
              { x: 1, y: 2 },
              { x: 3, y: 4, z: 5 },
              { x: 6 }
            ]
          }
        ]
      }
    },
    desc: 'Deeply Nested Complex Structure'
  },
  {
    name: '12_nasty_strings',
    data: {
      unicode: [
        "Emoji: 🚀🔥🎉💀👽",
        "Chinese: 你好世界",
        "Arabic: مرحبا بالعالم",
        "Russian: Привет мир",
        "Zalgo: H̴e̴l̴l̴o̴ ̴W̴o̴r̴l̴d̴"
      ],
      control_chars: [
        "Null: \\u0000",
        "Backspace: \\b",
        "Form Feed: \\f",
        "Newline: \\n",
        "Carriage Return: \\r",
        "Tab: \\t",
        "Vertical Tab: \\v"
      ],
      json_injection: [
        "{\\\"key\\\": \\\"value\\\"}",
        "[1, 2, 3]",
        "null",
        "true",
        "false",
        "// comment",
        "/* comment */"
      ],
      script_injection: [
        "<script>alert('xss')</script>",
        "javascript:void(0)",
        "'; DROP TABLE users; --"
      ],
      path_traversal: [
        "../../etc/passwd",
        "..\\\\..\\\\windows\\\\system32\\\\config\\\\sam"
      ]
    },
    desc: 'Nasty Strings (Unicode, Injection, Control Chars)'
  },
  {
    name: '13_deep_recursion',
    data: (function() {
      let obj: any = { end: "bottom" };
      for (let i = 0; i < 50; i++) {
        obj = { level: i, next: obj };
      }
      return obj;
    })(),
    desc: 'Deep Recursion (50 Levels)'
  },
  {
    name: '14_hiking_example',
    data: {
      "context": {
        "task": "Our favorite hikes together",
        "location": "Boulder",
        "season": "spring_2025"
      },
      "friends": [
        "ana",
        "luis",
        "sam"
      ],
      "hikes": [
        {
          "id": 1,
          "name": "Blue Lake Trail",
          "distanceKm": 7.5,
          "elevationGain": 320,
          "companion": "ana",
          "wasSunny": true
        },
        {
          "id": 2,
          "name": "Ridge Overlook",
          "distanceKm": 9.2,
          "elevationGain": 540,
          "companion": "luis",
          "wasSunny": false
        },
        {
          "id": 3,
          "name": "Wildflower Loop",
          "distanceKm": 5.1,
          "elevationGain": 180,
          "companion": "sam",
          "wasSunny": true
        }
      ]
    },
    desc: 'Hiking Example (User Request)'
  }
];

console.log(`Generating examples in ${EXAMPLES_DIR}...\\n`);

examples.forEach((ex, index) => {
  const jsonPath = path.join(EXAMPLES_DIR, `${ex.name}.json`);
  const zonPath = path.join(EXAMPLES_DIR, `${ex.name}.zonf`);

  const jsonContent = JSON.stringify(ex.data, null, 2);
  const zonContent = encode(ex.data);

  fs.writeFileSync(jsonPath, jsonContent);
  fs.writeFileSync(zonPath, zonContent);

  console.log(`✅ Generated ${ex.name}`);
  console.log(`   Description: ${ex.desc}`);
  console.log(`   JSON: ${jsonContent.length} bytes`);
  console.log(`   ZON:  ${zonContent.length} bytes`);
  console.log('---');
});

console.log('\\nDone! View the examples in the \"examples/\" folder.');
