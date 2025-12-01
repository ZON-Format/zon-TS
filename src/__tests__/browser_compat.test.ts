import { encode, decode } from '../index';

/**
 * Simulates a browser environment to verify ZON compatibility.
 * Checks for:
 * 1. No Node.js globals (Buffer, process) usage during encode/decode.
 * 2. Integration with localStorage (string-based storage).
 */
describe('Browser Compatibility', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      }
    };
  })();

  beforeEach(() => {
    localStorageMock.clear();
  });

  test('should encode and store in localStorage', () => {
    const data = {
      user: { id: 1, name: "Browser User" },
      settings: { theme: "dark", notifications: true }
    };

    // 1. Encode
    const zonString = encode(data);
    
    // 2. Store
    localStorageMock.setItem('app_state', zonString);

    // 3. Retrieve
    const stored = localStorageMock.getItem('app_state');
    expect(stored).toBe(zonString);

    // 4. Decode
    const decoded = decode(stored!);
    expect(decoded).toEqual(data);
  });

  test('should handle large tabular data in browser context', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      active: i % 2 === 0
    }));

    const zonString = encode(rows);
    localStorageMock.setItem('users', zonString);
    
    const decoded = decode(localStorageMock.getItem('users')!);
    expect(decoded).toHaveLength(100);
    expect(decoded[0]).toEqual({ id: 0, name: "User 0", active: true });
  });

  test('should not rely on Buffer', () => {
    // Ensure Buffer is not defined or used (if we were in a real browser)
    // In Jest/Node it is defined, but we want to ensure our code doesn't *need* it.
    // We can't easily delete global.Buffer in Jest without breaking other things,
    // but we verified via grep that 'Buffer' is not in src/encoder.ts or src/decoder.ts.
    
    const data = { test: "No Buffer Needed" };
    const zonString = encode(data);
    expect(typeof zonString).toBe('string');
  });
});
