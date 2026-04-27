/**
 * Tests for boolean-like dictionary keys.
 *
 * Verifies the fix for a bug where dictionary keys like "f", "t",
 * "true", "false", "null" were incorrectly parsed as boolean/null values
 * instead of being preserved as strings.
 *
 * Fixtures wrap the boolean-like key inside a nested object or array-of-objects
 * so that encode/decode exercises _formatZonNode / _parseKey — the code paths
 * that contain the actual fix.
 */

import { encode, decode } from '../index';

describe('Boolean-like dictionary keys', () => {
  test('Key "f" should not become false', () => {
    const data = { wrapper: { f: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ f: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('f');
    expect(Object.keys(decoded.wrapper)).not.toContain('false');
  });

  test('Key "t" should not become true', () => {
    const data = { wrapper: { t: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ t: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('t');
    expect(Object.keys(decoded.wrapper)).not.toContain('true');
  });

  test('Key "true" should not become boolean true', () => {
    const data = { wrapper: { true: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ true: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('true');
  });

  test('Key "false" should not become boolean false', () => {
    const data = { wrapper: { false: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ false: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('false');
  });

  test('Key "null" should not become null', () => {
    const data = { wrapper: { null: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ null: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('null');
  });

  test('Key "none" should not become null', () => {
    const data = { wrapper: { none: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ none: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('none');
  });

  test('Key "nil" should not become null', () => {
    const data = { wrapper: { nil: 1 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper).toEqual({ nil: 1 });
    expect(Object.keys(decoded.wrapper)).toContain('nil');
  });

  test('Case variants of boolean-like keys are preserved', () => {
    const cases: Array<[string, Record<string, number>]> = [
      ['F', { F: 1 }],
      ['T', { T: 1 }],
      ['True', { True: 1 }],
      ['False', { False: 1 }],
      ['TRUE', { TRUE: 1 }],
      ['FALSE', { FALSE: 1 }],
      ['NULL', { NULL: 1 }],
      ['NONE', { NONE: 1 }],
      ['Null', { Null: 1 }],
    ];
    for (const [keyName, inner] of cases) {
      const data = { wrapper: inner };
      const encoded = encode(data);
      const decoded = decode(encoded) as any;
      expect(Object.keys(decoded.wrapper)).toContain(keyName);
      expect(decoded.wrapper[keyName]).toBe(1);
    }
  });

  test('Multiple boolean-like keys in same nested object', () => {
    const data = { wrapper: { t: 1, f: 2, true: 3, false: 4, null: 5 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(decoded.wrapper.t).toBe(1);
    expect(decoded.wrapper.f).toBe(2);
    expect(decoded.wrapper.true).toBe(3);
    expect(decoded.wrapper.false).toBe(4);
    expect(decoded.wrapper.null).toBe(5);
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

  test('Multiple sibling objects each with a boolean-like key round-trip', () => {
    const data = { a: { f: 1 }, b: { t: 2 }, c: { null: 3 } };
    const encoded = encode(data);
    const decoded = decode(encoded) as any;
    expect(Object.keys(decoded.a)).toContain('f');
    expect(decoded.a.f).toBe(1);
    expect(Object.keys(decoded.b)).toContain('t');
    expect(decoded.b.t).toBe(2);
    expect(Object.keys(decoded.c)).toContain('null');
    expect(decoded.c.null).toBe(3);
  });
});
