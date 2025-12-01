import { ZonEncoder } from '../encoder';
import { ZonDecoder } from '../decoder';

describe('Intelligent Type Coercion', () => {
  let decoder: ZonDecoder;

  beforeEach(() => {
    decoder = new ZonDecoder();
  });

  it('should coerce numeric strings to numbers when enabled', () => {
    const data = [
      { id: '1', score: '95' },
      { id: '2', score: '87' }
    ];

    // Enable coercion
    const encoder = new ZonEncoder(undefined, true, true);
    const encoded = encoder.encode(data);
    
    // Should be encoded as numbers (no quotes)
    // Actual output might be:
    // @2:id,score
    // 1,95
    // 2,87
    expect(encoded).toContain('1,95');
    expect(encoded).not.toContain('"1"');
    expect(encoded).not.toContain('"95"');

    const decoded = decoder.decode(encoded);
    expect(typeof decoded[0].id).toBe('number');
    expect(typeof decoded[0].score).toBe('number');
    expect(decoded[0].id).toBe(1);
  });

  it('should NOT coerce when disabled (default)', () => {
    const data = [
      { id: '1', score: '95' }
    ];

    // Default (disabled)
    const encoder = new ZonEncoder();
    const encoded = encoder.encode(data);
    
    // Should be encoded as strings (quoted or just string)
    // "1" should be quoted to preserve string type if it looks like a number
    expect(encoded).toContain('"1"');
    
    const decoded = decoder.decode(encoded);
    expect(typeof decoded[0].id).toBe('string');
    expect(decoded[0].id).toBe('1');
  });

  it('should coerce boolean strings', () => {
    const data = [
      { active: 'true' },
      { active: 'FALSE' },
      { active: '1' },
      { active: '0' }
    ];

    const encoder = new ZonEncoder(undefined, true, true);
    const encoded = encoder.encode(data);
    
    // Should be T/F
    expect(encoded).toContain('T');
    expect(encoded).toContain('F');
    
    const decoded = decoder.decode(encoded);
    expect(decoded[0].active).toBe(true);
    expect(decoded[1].active).toBe(false);
    expect(decoded[2].active).toBe(true);
    expect(decoded[3].active).toBe(false);
  });

  it('should coerce JSON strings', () => {
    const data = [
      { config: '{"a":1}' },
      { config: '{"b":2}' }
    ];

    const encoder = new ZonEncoder(undefined, true, true);
    const encoded = encoder.encode(data);
    
    // Should be encoded as ZON object structure
    // {a:1}
    expect(encoded).toContain('{a:1}');
    expect(encoded).not.toContain('"{\\"a\\":1}"'); // Should not be a quoted JSON string

    const decoded = decoder.decode(encoded);
    expect(typeof decoded[0].config).toBe('object');
    expect(decoded[0].config.a).toBe(1);
  });

  it('should NOT coerce mixed types', () => {
    const data = [
      { val: '123' },
      { val: 'abc' } // Not numeric
    ];

    const encoder = new ZonEncoder(undefined, true, true);
    const encoded = encoder.encode(data);
    
    // Should remain strings because column is mixed
    // "123" should be quoted to preserve string type if it looks like a number
    expect(encoded).toContain('"123"');
    expect(encoded).toContain('abc');

    const decoded = decoder.decode(encoded);
    expect(typeof decoded[0].val).toBe('string');
  });
});
