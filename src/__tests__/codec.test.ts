/**
 * ZON Codec Tests
 * Port of test_codec.py from the Python implementation
 */

import { encode, decode } from '../index';

describe('ZON Codec', () => {
  describe('Round-trip tests', () => {
    test('Empty object', () => {
      const data = {};
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Simple metadata', () => {
      const data = { name: 'Alice', age: 30, active: true };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Nested object', () => {
      const data = {
        user: {
          name: 'Bob',
          profile: {
            age: 25,
            city: 'NYC'
          }
        }
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Array of objects (table)', () => {
      const data = [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
        { id: 3, name: 'Charlie', score: 92 }
      ];
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Mixed metadata and table', () => {
      const data = {
        title: 'Sales Report',
        year: 2024,
        records: [
          { month: 'Jan', sales: 1000 },
          { month: 'Feb', sales: 1200 },
          { month: 'Mar', sales: 1100 }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Boolean values', () => {
      const data = {
        success: true,
        error: false,
        items: [
          { id: 1, active: true },
          { id: 2, active: false }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Null values', () => {
      const data = {
        name: 'Test',
        value: null,
        items: [
          { id: 1, data: null },
          { id: 2, data: 'value' }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Numbers (integers and floats)', () => {
      const data = {
        integer: 42,
        float: 3.14,
        negative: -10,
        negativeFloat: -2.5,
        items: [
          { id: 1, value: 100 },
          { id: 2, value: 200.5 }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Strings with special characters', () => {
      const data = {
        plain: 'hello',
        withComma: 'hello, world',
        withQuotes: 'say "hello"',
        withNewline: 'line1\nline2',
        items: [
          { id: 1, text: 'normal' },
          { id: 2, text: 'with, comma' }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Empty arrays', () => {
      const data = {
        empty: [],
        nested: {
          also_empty: []
        }
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Nested arrays in metadata', () => {
      const data = {
        tags: ['javascript', 'typescript', 'node'],
        matrix: [[1, 2], [3, 4]],
        items: [
          { id: 1, values: [10, 20] },
          { id: 2, values: [30, 40] }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Complex nested objects in table cells', () => {
      const data = [
        {
          id: 1,
          metadata: { tags: ['a', 'b'], count: 5 }
        },
        {
          id: 2,
          metadata: { tags: ['c'], count: 3 }
        }
      ];
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });
  });

  describe('Hikes example from README', () => {
    test('Full hikes example', () => {
      const data = {
        context: {
          task: 'Our favorite hikes together',
          location: 'Boulder',
          season: 'spring_2025'
        },
        friends: ['ana', 'luis', 'sam'],
        hikes: [
          {
            id: 1,
            name: 'Blue Lake Trail',
            distanceKm: 7.5,
            elevationGain: 320,
            companion: 'ana',
            wasSunny: true
          },
          {
            id: 2,
            name: 'Ridge Overlook',
            distanceKm: 9.2,
            elevationGain: 540,
            companion: 'luis',
            wasSunny: false
          },
          {
            id: 3,
            name: 'Wildflower Loop',
            distanceKm: 5.1,
            elevationGain: 180,
            companion: 'sam',
            wasSunny: true
          }
        ]
      };

      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);

      // Verify the encoded format structure
      expect(encoded).toContain('context:');
      expect(encoded).toContain('friends:');
      expect(encoded).toContain('@hikes(3):');
    });
  });

  describe('Edge cases', () => {
    test('String that looks like a number', () => {
      const data = {
        stringNumber: '123',
        actualNumber: 123,
        items: [
          { id: 1, code: '001' },
          { id: 2, code: '002' }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
      expect(typeof decoded.stringNumber).toBe('string');
      expect(typeof decoded.actualNumber).toBe('number');
    });

    test('String that looks like boolean', () => {
      const data = {
        stringTrue: 'true',
        actualTrue: true,
        stringFalse: 'false',
        actualFalse: false,
        items: [
          { id: 1, status: 'T' },
          { id: 2, status: true }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
      expect(typeof decoded.stringTrue).toBe('string');
      expect(typeof decoded.actualTrue).toBe('boolean');
    });

    test('Empty strings', () => {
      const data = {
        empty: '',
        items: [
          { id: 1, name: '' },
          { id: 2, name: 'value' }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Whitespace preservation', () => {
      const data = {
        leading: '  space',
        trailing: 'space  ',
        both: '  both  ',
        items: [
          { id: 1, text: '  padded  ' }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Very long strings', () => {
      const longString = 'a'.repeat(1000);
      const data = {
        long: longString,
        items: [
          { id: 1, text: longString }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Large arrays', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: i * 10
      }));
      const data = { items };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });

    test('Deeply nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });
  });

  describe('Data type preservation', () => {
    test('Integer vs float distinction', () => {
      const data = {
        integer: 42,
        float: 42.0,
        explicitFloat: 3.14,
        items: [
          { id: 1, intVal: 100, floatVal: 100.5 },
          { id: 2, intVal: 200, floatVal: 200.0 }
        ]
      };
      const encoded = encode(data);
      const decoded = decode(encoded);
      
      expect(decoded.integer).toBe(42);
      expect(decoded.float).toBe(42.0);
      expect(decoded.explicitFloat).toBe(3.14);
    });

    test('Boolean shorthand T/F', () => {
      const data = [
        { id: 1, flag: true },
        { id: 2, flag: false },
        { id: 3, flag: true }
      ];
      const encoded = encode(data);
      
      // Check that booleans are encoded as T/F (with or without comma)
      expect(encoded).toMatch(/[,\n]T/);
      expect(encoded).toMatch(/[,\n]F/);
      
      const decoded = decode(encoded);
      expect(decoded).toEqual(data);
    });
  });
});
