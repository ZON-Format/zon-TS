import { ZonSplitter } from '../splitter';
import { decode } from '../decoder';

describe('ZonSplitter', () => {
  const generateData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      text: `This is item number ${i} with some content to take up space.`,
      tags: ['tag1', 'tag2', 'tag3']
    }));
  };

  it('splits data into chunks respecting token limit', () => {
    const data = generateData(100);
    // Approx 4 chars per token.
    // Each item is ~80 chars -> ~20 tokens.
    // Max 100 tokens -> ~5 items per chunk.
    
    const splitter = new ZonSplitter({ maxTokens: 100 });
    const result = splitter.split(data);

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.metadata.totalChunks).toBe(result.chunks.length);
    
    // Verify each chunk is valid ZON and within limit (approx)
    result.chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(400); // 100 tokens * 4 chars
      const decoded = decode(chunk);
      expect(Array.isArray(decoded)).toBe(true);
      expect(decoded.length).toBeGreaterThan(0);
    });
    
    // Verify all data is present (sum of chunk lengths >= total, due to overhead/overlap)
    const totalItems = result.chunks.reduce((sum, chunk) => sum + decode(chunk).length, 0);
    expect(totalItems).toBe(100);
  });

  it('handles overlap correctly', () => {
    const data = generateData(10);
    // Force small chunks to test overlap
    const splitter = new ZonSplitter({ maxTokens: 50, overlap: 1 });
    const result = splitter.split(data);

    const decodedChunks = result.chunks.map(c => decode(c));
    
    // Check overlap
    for (let i = 0; i < decodedChunks.length - 1; i++) {
      const currentChunk = decodedChunks[i];
      const nextChunk = decodedChunks[i+1];
      
      const lastItem = currentChunk[currentChunk.length - 1];
      const firstItemNext = nextChunk[0];
      
      expect(lastItem).toEqual(firstItemNext);
    }
  });

  it('handles single items larger than limit', () => {
    const data = [
      { id: 1, text: 'Small item' },
      { id: 2, text: 'A'.repeat(1000) }, // Huge item
      { id: 3, text: 'Small item' }
    ];
    
    const splitter = new ZonSplitter({ maxTokens: 50 }); // 200 chars limit
    const result = splitter.split(data);
    
    // Should have 3 chunks (small, huge, small)
    // The huge one exceeds limit but must be included
    expect(result.chunks.length).toBe(3);
    expect(decode(result.chunks[1])[0].text.length).toBe(1000);
  });

  it('returns empty result for empty input', () => {
    const splitter = new ZonSplitter({ maxTokens: 100 });
    const result = splitter.split([]);
    
    expect(result.chunks).toEqual([]);
    expect(result.metadata.totalChunks).toBe(0);
  });
});
