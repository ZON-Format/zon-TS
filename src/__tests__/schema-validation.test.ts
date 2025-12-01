import { zon, validate } from '../schema';
import { encode } from '../encoder';

describe('Enhanced Schema Validation', () => {
  describe('String Validation', () => {
    it('validates email format', () => {
      const schema = zon.string().email();
      
      const valid = schema.parse('test@example.com');
      expect(valid.success).toBe(true);
      
      const invalid = schema.parse('not-an-email');
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error).toContain('Invalid email');
      }
    });

    it('validates URL format', () => {
      const schema = zon.string().url();
      
      const valid = schema.parse('https://example.com');
      expect(valid.success).toBe(true);
      
      const invalid = schema.parse('not a url');
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error).toContain('Invalid URL');
      }
    });

    it('validates string length', () => {
      const schema = zon.string().min(3).max(10);
      
      const valid = schema.parse('hello');
      expect(valid.success).toBe(true);
      
      const tooShort = schema.parse('hi');
      expect(tooShort.success).toBe(false);
      
      const tooLong = schema.parse('this is too long');
      expect(tooLong.success).toBe(false);
    });
  });

  describe('Number Validation', () => {
    it('validates positive numbers', () => {
      const schema = zon.number().positive();
      
      const valid = schema.parse(5);
      expect(valid.success).toBe(true);
      
      const invalid = schema.parse(-5);
      expect(invalid.success).toBe(false);
      
      const zero = schema.parse(0);
      expect(zero.success).toBe(false);
    });

    it('validates integer numbers', () => {
      const schema = zon.number().int();
      
      const valid = schema.parse(42);
      expect(valid.success).toBe(true);
      
      const invalid = schema.parse(3.14);
      expect(invalid.success).toBe(false);
    });

    it('validates number range', () => {
      const schema = zon.number().min(0).max(100);
      
      const valid = schema.parse(50);
      expect(valid.success).toBe(true);
      
      const tooSmall = schema.parse(-1);
      expect(tooSmall.success).toBe(false);
      
      const tooLarge = schema.parse(101);
      expect(tooLarge.success).toBe(false);
    });

    it('combines multiple constraints', () => {
      const schema = zon.number().int().positive().max(100);
      
      const valid = schema.parse(50);
      expect(valid.success).toBe(true);
      
      const notInt = schema.parse(50.5);
      expect(notInt.success).toBe(false);
      
      const notPositive = schema.parse(-10);
      expect(notPositive.success).toBe(false);
      
      const tooLarge = schema.parse(150);
      expect(tooLarge.success).toBe(false);
    });
  });

  describe('Array Validation', () => {
    it('validates array length', () => {
      const schema = zon.array(zon.string()).min(1).max(5);
      
      const valid = schema.parse(['a', 'b', 'c']);
      expect(valid.success).toBe(true);
      
      const empty = schema.parse([]);
      expect(empty.success).toBe(false);
      
      const tooLong = schema.parse(['a', 'b', 'c', 'd', 'e', 'f']);
      expect(tooLong.success).toBe(false);
    });

    it('validates array elements', () => {
      const schema = zon.array(zon.number().positive());
      
      const valid = schema.parse([1, 2, 3]);
      expect(valid.success).toBe(true);
      
      const invalid = schema.parse([1, -2, 3]);
      expect(invalid.success).toBe(false);
    });
  });

  describe('Nullable Support', () => {
    it('allows null values', () => {
      const schema = zon.string().nullable();
      
      const validString = schema.parse('hello');
      expect(validString.success).toBe(true);
      
      const validNull = schema.parse(null);
      expect(validNull.success).toBe(true);
      if (validNull.success) {
        expect(validNull.data).toBe(null);
      }
    });

    it('rejects undefined for nullable', () => {
      const schema = zon.string().nullable();
      
      const invalid = schema.parse(undefined);
      expect(invalid.success).toBe(false);
    });
  });

  describe('Complex Schema', () => {
    it('validates nested objects with constraints', () => {
      const UserSchema = zon.object({
        id: zon.number().int().positive(),
        email: zon.string().email(),
        age: zon.number().int().min(0).max(120),
        tags: zon.array(zon.string()).max(10).optional(),
        website: zon.string().url().optional(),
      });

      const validUser = {
        id: 1,
        email: 'alice@example.com',
        age: 25,
        tags: ['developer', 'typescript'],
        website: 'https://alice.dev',
      };

      const result = UserSchema.parse(validUser);
      expect(result.success).toBe(true);
    });

    it('catches validation errors in nested structures', () => {
      const UserSchema = zon.object({
        id: zon.number().int().positive(),
        email: zon.string().email(),
        age: zon.number().int().min(0).max(120),
      });

      const invalidUser = {
        id: -1, // Should be positive
        email: 'not-an-email',
        age: 150, // Too old
      };

      const result = UserSchema.parse(invalidUser);
      expect(result.success).toBe(false);
    });
  });

  describe('Integration with encode/decode', () => {
    it('validates before encoding', () => {
      const schema = zon.array(zon.object({
        id: zon.number().int().positive(),
        name: zon.string().min(1),
      }));

      const validData = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const result = schema.parse(validData);
      expect(result.success).toBe(true);

      if (result.success) {
        const encoded = encode(result.data);
        expect(encoded).toBeTruthy();
      }
    });

    it('rejects invalid data before encoding', () => {
      const schema = zon.array(zon.object({
        id: zon.number().int().positive(),
        name: zon.string().min(1),
      }));

      const invalidData = [
        { id: -1, name: 'Alice' }, // Invalid ID
        { id: 2, name: '' }, // Empty name
      ];

      const result = schema.parse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('provides clear error messages with paths', () => {
      const schema = zon.object({
        users: zon.array(zon.object({
          age: zon.number().min(0).max(120),
        })),
      });

      const data = {
        users: [
          { age: 25 },
          { age: 150 }, // Invalid
        ],
      };

      const result = schema.parse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('users.1.age');
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0].path).toEqual(['users', 1, 'age']);
      }
    });
  });
});
