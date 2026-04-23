import { encode, decode } from '../index';

// Bug 1: Boolean-like keys in inline ZON objects
test('Inline object with f key round-trips', () => {
  const data = {"f": 1};
  const encoded = encode(data);
  console.log('Bug1 Encoded:', JSON.stringify(encoded));
  const decoded = decode(encoded);
  console.log('Bug1 Decoded:', JSON.stringify(decoded));
  // This should be {"f": 1} not {false: 1}
  expect(decoded).toEqual({"f": 1});
  expect(Object.keys(decoded as any)[0]).toBe('f');
});

test('Inline nested object with f key round-trips', () => {
  const data = {"a": {"b": {"c": {"d": {"e": {"f": 1}}}}}};
  const encoded = encode(data);
  console.log('Bug1 nested Encoded:', JSON.stringify(encoded));
  const decoded = decode(encoded) as any;
  console.log('Bug1 nested Decoded:', JSON.stringify(decoded));
  const inner = decoded?.a?.b?.c?.d?.e;
  expect(inner).toBeDefined();
  expect(Object.keys(inner)).toContain('f');
  expect(Object.keys(inner)).not.toContain('false');
});

test('Object with null/none/nil keys round-trips', () => {
  const data = {"null": 1, "none": 2, "nil": 3};
  const encoded = encode(data);
  console.log('null-key Encoded:', JSON.stringify(encoded));
  const decoded = decode(encoded) as any;
  console.log('null-key Decoded:', JSON.stringify(decoded));
  expect(decoded).toHaveProperty('null');
  expect(decoded).toHaveProperty('none');
  expect(decoded).toHaveProperty('nil');
});

// Bug 2: Dictionary header values with commas  
test('Dictionary values with commas round-trip', () => {
  const data = [
    {"Car": "Toyota Celica ST 185", "Year": "1996"},
    {"Car": "Toyota Corolla, AWD", "Year": "1997"},
    {"Car": "Toyota Corolla, AWD", "Year": "1998"},
    {"Car": "Toyota Corolla, AWD", "Year": "1999"},
    {"Car": "Toyota Corolla, AWD", "Year": "2000"},
    {"Car": "Toyota Corolla, AWD", "Year": "2001"},
  ];
  const encoded = encode(data);
  console.log('Bug2 Encoded:', encoded);
  const decoded = decode(encoded) as any[];
  console.log('Bug2 Decoded:', JSON.stringify(decoded[1]));
  expect(decoded[1].Car).toBe("Toyota Corolla, AWD");
  expect(decoded[1].Year).toBe("1997");
});

test('Dictionary values with colons round-trip', () => {
  const data = [
    {"key": "value:one", "other": "a"},
    {"key": "value:one", "other": "b"},
    {"key": "value:one", "other": "c"},
    {"key": "value:one", "other": "d"},
    {"key": "value:one", "other": "e"},
    {"key": "value:two", "other": "f"},
  ];
  const encoded = encode(data);
  console.log('Bug2b Encoded:', encoded);
  const decoded = decode(encoded) as any[];
  console.log('Bug2b Decoded:', JSON.stringify(decoded[0]));
  expect(decoded[0].key).toBe("value:one");
});
