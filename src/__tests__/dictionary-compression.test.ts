import { ZonEncoder } from '../encoder';
import { ZonDecoder } from '../decoder';
import { encode } from '../encoder';
import { decode } from '../decoder';

describe('Dictionary Compression', () => {
  it('detects and compresses repeated strings', () => {
    // Need enough data to overcome dictionary definition overhead
    const data = Array.from({ length: 20 }, (_, i) => ({
      status: i % 2 === 0 ? 'pending' : 'completed',
      priority: i % 3 === 0 ? 'high' : (i % 3 === 1 ? 'medium' : 'low')
    }));

    const encoder = new ZonEncoder();
    const encoded = encoder.encode(data);

    // Should contain dictionary definitions
    expect(encoded).toContain('status[');
    expect(encoded).toContain('priority[');
    
    // Should contain indices in the table
    expect(encoded).toMatch(/\d,\d/); 
  });

  it('round-trips correctly with dictionary compression', () => {
    const data = [
      { status: 'pending', priority: 'high' },
      { status: 'pending', priority: 'low' },
      { status: 'completed', priority: 'high' },
      { status: 'pending', priority: 'high' }
    ];

    const encoded = encode(data);
    const decoded = decode(encoded);

    expect(decoded).toEqual(data);
  });

  it('achieves savings on enum-heavy data', () => {
    // Generate enum-heavy data
    const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    const priorities = ['critical', 'high', 'medium', 'low', 'trivial'];
    
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      status: statuses[i % statuses.length], // 20% unique
      priority: priorities[i % priorities.length], // 20% unique
      category: 'general' // constant value
    }));

    const encoderWithDict = new ZonEncoder(10, true);
    const encodedWithDict = encoderWithDict.encode(data);

    const encoderWithoutDict = new ZonEncoder(10, false);
    const encodedWithoutDict = encoderWithoutDict.encode(data);

    // Calculate savings
    const savings = (encodedWithoutDict.length - encodedWithDict.length) / encodedWithoutDict.length;
    
    // Should be significant (> 20%)
    expect(savings).toBeGreaterThan(0.2);
    
    // Verify round-trip for both
    expect(decode(encodedWithDict)).toEqual(data);
    expect(decode(encodedWithoutDict)).toEqual(data);
  });

  it('does not compress unique strings', () => {
    const data = [
      { id: 'uuid-1', name: 'Alice' },
      { id: 'uuid-2', name: 'Bob' },
      { id: 'uuid-3', name: 'Charlie' }
    ];

    const encoded = encode(data);
    
    // Should NOT contain dictionary definitions for unique fields
    expect(encoded).not.toContain('id[');
    expect(encoded).not.toContain('name[');
  });

  it('handles mixed dictionary and regular columns', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      type: i % 3 === 0 ? 'bot' : 'user', // Compressible
      name: `User${i}`,                   // Unique (not compressible)
      role: i % 4 === 0 ? 'admin' : 'user' // Compressible
    }));

    const encoded = encode(data);
    const decoded = decode(encoded);

    expect(decoded).toEqual(data);
    
    // 'type' and 'role' should be compressed, 'name' should not
    expect(encoded).toContain('type[');
    expect(encoded).toContain('role[');
    expect(encoded).not.toContain('name[');
  });
});
