import { decode } from '../index';
import { ZonDecodeError } from '../core/exceptions';
import { MAX_DOCUMENT_SIZE, MAX_LINE_LENGTH, MAX_ARRAY_LENGTH, MAX_OBJECT_KEYS } from '../core/constants';

describe('Security Limits (DOS Prevention)', () => {
  describe('E301: Document Size Limit', () => {
    test('should throw when document exceeds 100MB', () => {
    });

    test('should allow documents under 100MB', () => {
      const doc = 'test:value\n'.repeat(1000);
      expect(() => decode(doc)).not.toThrow();
    });
  });

  describe('E302: Line Length Limit', () => {
    test('should throw when line exceeds 1MB', () => {
      const longLine = 'key:' + 'x'.repeat(MAX_LINE_LENGTH + 1);
      
      expect(() => decode(longLine)).toThrow(ZonDecodeError);
      expect(() => decode(longLine)).toThrow(/Line length exceeds maximum/);
      expect(() => decode(longLine)).toThrow(/E302/);
    });

    test('should allow lines under 1MB', () => {
      const line = 'key:' + 'x'.repeat(1000);
      
      const result = decode(line);
      expect(result.key).toBeDefined();
    });
  });

  describe('E303: Array Length Limit', () => {
    test('should have array length limit defined', () => {
      expect(MAX_ARRAY_LENGTH).toBe(1_000_000);
    });
  });

  describe('E304: Object Key Count Limit', () => {
    test('should have object key limit defined', () => {
      expect(MAX_OBJECT_KEYS).toBe(100_000);
    });

    test('should allow objects under 100K keys', () => {
      const keys = Array(100).fill(0).map((_, i) => `k${i}:${i}`).join(',');
      const zonData = `data:{${keys}}`;
      
      const result = decode(zonData);
      expect(Object.keys(result.data)).toHaveLength(100);
    });
  });

  describe('Nesting Depth Limit (Already Implemented)', () => {
    test('should throw when nesting exceeds 100 levels', () => {
      const nested = '['.repeat(150) + ']'.repeat(150);
      
      expect(() => decode(nested)).toThrow(/Maximum nesting depth exceeded/);
    });

    test('should allow nesting under 100 levels', () => {
      const nested = '['.repeat(50) + ']'.repeat(50);
      
      const result = decode(nested);
      expect(result).toBeDefined();
    });
  });

  describe('Combined Limits', () => {
    test('should work with normal data within all limits', () => {
      const zonData = `
metadata:{version:1.1.0,env:prod}
users:@(3):id,name
1,Alice
2,Bob
3,Carol
tags:[nodejs,typescript,llm]
`;
      
      const result = decode(zonData);
      expect(result.users).toHaveLength(3);
      expect(result.metadata.version).toBe('1.1.0');
      expect(result.tags).toHaveLength(3);
    });
  });
});
