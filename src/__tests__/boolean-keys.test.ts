/**
 * Tests for boolean-like dictionary keys.
 *
 * Verifies the fix for a bug where dictionary keys like "f", "t",
 * "true", "false", "null" were incorrectly parsed as boolean/null values
 * instead of being preserved as strings.
 */

import { encode, decode } from '../index';

describe('Boolean-like dictionary keys', () => {
  test('Key "f" should not become false', () => {
    const data = { f: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ f: 1 });
    expect(Object.keys(decoded)).toContain('f');
    expect(Object.keys(decoded)).not.toContain('false');
  });

  test('Key "t" should not become true', () => {
    const data = { t: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ t: 1 });
    expect(Object.keys(decoded)).toContain('t');
    expect(Object.keys(decoded)).not.toContain('true');
  });

  test('Key "true" should not become boolean true', () => {
    const data = { true: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ true: 1 });
    expect(Object.keys(decoded)).toContain('true');
  });

  test('Key "false" should not become boolean false', () => {
    const data = { false: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ false: 1 });
    expect(Object.keys(decoded)).toContain('false');
  });

  test('Key "null" should not become null', () => {
    const data = { null: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ null: 1 });
    expect(Object.keys(decoded)).toContain('null');
  });

  test('Key "none" should not become null', () => {
    const data = { none: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ none: 1 });
    expect(Object.keys(decoded)).toContain('none');
  });

  test('Key "nil" should not become null', () => {
    const data = { nil: 1 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual({ nil: 1 });
    expect(Object.keys(decoded)).toContain('nil');
  });

  test('Case variants of boolean-like keys are preserved', () => {
    const cases = [
      { F: 1 },
      { T: 1 },
      { True: 1 },
      { False: 1 },
      { TRUE: 1 },
      { FALSE: 1 },
      { NULL: 1 },
      { NONE: 1 },
      { Null: 1 },
    ];
    for (const data of cases) {
      const encoded = encode(data);
      const decoded = decode(encoded) as any;
      expect(decoded).toEqual(data);
    }
  });

  test('Multiple boolean-like keys in same object', () => {
    const data = { t: 1, f: 2, true: 3, false: 4, null: 5 };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.t).toBe(1);
    expect(decoded.f).toBe(2);
    expect(decoded.true).toBe(3);
    expect(decoded.false).toBe(4);
    expect(decoded.null).toBe(5);
  });

  test('Nested object with boolean-like key round-trips', () => {
    const data = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded).toEqual(data);
    const inner = decoded?.a?.b?.c?.d?.e;
    expect(Object.keys(inner)).toContain('f');
    expect(Object.keys(inner)).not.toContain('false');
  });
});
