import { ZonEncoder } from '../core/encoder';
import { ZonDecoder } from '../core/decoder';


describe('Advanced Sparse Encoding', () => {
  let encoder: ZonEncoder;
  let decoder: ZonDecoder;

  beforeEach(() => {
    encoder = new ZonEncoder();
    decoder = new ZonDecoder();
  });



  describe('Hierarchical Sparse Encoding', () => {
    it('should flatten nested objects into dot-notation columns', () => {
      const data = [
        { user: { name: 'Alice', address: { city: 'NY' } } },
        { user: { name: 'Bob', address: { city: 'SF' } } }
      ];

      const encoded = encoder.encode(data);
      // Should have columns: user.name, user.address.city
      expect(encoded).toContain('user.name');
      expect(encoded).toContain('user.address.city');
      
      // Should NOT have JSON objects
      expect(encoded).not.toContain('{"name":');

      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });

    it('should handle sparse nested fields', () => {
      const data = [
        { user: { name: 'Alice', details: { age: 30 } } },
        { user: { name: 'Bob' } }, // Missing details
        { user: { name: 'Charlie', details: { height: 180 } } } // Different detail
      ];

      const encoded = encoder.encode(data);
      
      // user.name should be core
      // user.details.age and user.details.height should be sparse
      expect(encoded).toContain('user.name');
      
      // Check for sparse syntax
      // Row 1: ...,user.details.age:30
      // Row 3: ...,user.details.height:180
      expect(encoded).toMatch(/user\.details\.age:30/);
      expect(encoded).toMatch(/user\.details\.height:180/);

      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });

    it('should handle arrays within nested objects correctly (not flatten arrays)', () => {
      const data = [
        { group: { tags: ['a', 'b'] } },
        { group: { tags: ['c'] } }
      ];

      const encoded = encoder.encode(data);
      // Should have column group.tags
      expect(encoded).toContain('group.tags');
      // Value should be array string (ZON format: [a,b])
      expect(encoded).toContain('[a,b]');

      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });
    
    it('should handle deep nesting up to limit', () => {
      const data = [
        { a: { b: { c: { d: { e: 1 } } } } }
      ];
      
      const encoded = encoder.encode(data);
      // Depth 5 is limit. a.b.c.d.e is depth 5.
      expect(encoded).toContain('a.b.c.d.e');
      
      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });
  });
});
