/**
 * Tests for dictionary header value quoting.
 *
 * Verifies the fix for a bug where dictionary compression header values
 * containing commas or colons were truncated at the delimiter, causing
 * incorrect round-trips.
 */

import { encode, decode } from '../index';

describe('Dictionary header value quoting', () => {
  test('Dictionary values with commas round-trip correctly', () => {
    const data = [
      { Car: 'Toyota Celica ST 185', Year: '1996' },
      { Car: 'Toyota Corolla, AWD', Year: '1997' },
      { Car: 'Toyota Corolla, AWD', Year: '1998' },
      { Car: 'Toyota Corolla, AWD', Year: '1999' },
      { Car: 'Toyota Corolla, AWD', Year: '2000' },
      { Car: 'Toyota Corolla, AWD', Year: '2001' },
    ];
    const encoded = encode(data);
    const decoded = decode(encoded) as any[];
    expect(decoded[0].Car).toBe('Toyota Celica ST 185');
    expect(decoded[1].Car).toBe('Toyota Corolla, AWD');
    expect(decoded[1].Year).toBe('1997');
  });

  test('Dictionary values with colons round-trip correctly', () => {
    const data = [
      { key: 'value:one', other: 'a' },
      { key: 'value:one', other: 'b' },
      { key: 'value:one', other: 'c' },
      { key: 'value:one', other: 'd' },
      { key: 'value:one', other: 'e' },
      { key: 'value:two', other: 'f' },
    ];
    const encoded = encode(data);
    const decoded = decode(encoded) as any[];
    expect(decoded[0].key).toBe('value:one');
    expect(decoded[5].key).toBe('value:two');
  });

  test('All rows preserved after dictionary decompression', () => {
    const data = [
      { Car: 'Toyota Celica ST 185', Year: '1996' },
      { Car: 'Toyota Corolla, AWD', Year: '1997' },
      { Car: 'Toyota Corolla, AWD', Year: '1998' },
      { Car: 'Toyota Corolla, AWD', Year: '1999' },
      { Car: 'Toyota Corolla, AWD', Year: '2000' },
      { Car: 'Toyota Corolla, AWD', Year: '2001' },
    ];
    const encoded = encode(data);
    const decoded = decode(encoded) as any[];
    expect(decoded).toHaveLength(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(decoded[i]).toEqual(data[i]);
    }
  });
});
