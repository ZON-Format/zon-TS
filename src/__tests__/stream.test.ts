import { ZonStreamEncoder, ZonStreamDecoder } from '../stream';

describe('ZonStreamEncoder', () => {
  it('should encode a stream of objects', async () => {
    async function* source() {
      yield { id: 1, name: 'Alice' };
      yield { id: 2, name: 'Bob' };
    }

    const encoder = new ZonStreamEncoder();
    const chunks: string[] = [];
    
    for await (const chunk of encoder.encode(source())) {
      chunks.push(chunk);
    }

    const result = chunks.join('');
    // Header + Row 1 + Row 2
    // Note: implementation details might vary slightly on newlines
    expect(result).toContain('@:id,name');
    expect(result).toContain('1,Alice');
    expect(result).toContain('2,Bob');
  });
});

describe('ZonStreamDecoder', () => {
  it('should decode a stream of strings', async () => {
    async function* source() {
      yield '@:id,name\n';
      yield '1,Alice\n';
      yield '2,Bob\n';
    }

    const decoder = new ZonStreamDecoder();
    const items: any[] = [];

    for await (const item of decoder.decode(source())) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 1, name: 'Alice' });
    expect(items[1]).toEqual({ id: 2, name: 'Bob' });
  });

  it('should handle split lines', async () => {
    async function* source() {
      yield '@:id,na';
      yield 'me\n1,Al';
      yield 'ice\n2,B';
      yield 'ob';
    }

    const decoder = new ZonStreamDecoder();
    const items: any[] = [];

    for await (const item of decoder.decode(source())) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 1, name: 'Alice' });
    expect(items[1]).toEqual({ id: 2, name: 'Bob' });
  });
});

describe('Streaming Round Trip', () => {
  it('should round trip data via streams', async () => {
    const data = [
      { id: 1, val: 'A' },
      { id: 2, val: 'B' },
      { id: 3, val: 'C' }
    ];

    async function* source() {
      for (const item of data) yield item;
    }

    const encoder = new ZonStreamEncoder();
    const decoder = new ZonStreamDecoder();

    const encodedStream = encoder.encode(source());
    const decodedItems: any[] = [];

    for await (const item of decoder.decode(encodedStream)) {
      decodedItems.push(item);
    }

    expect(decodedItems).toEqual(data);
  });
});
