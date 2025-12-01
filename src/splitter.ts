import { encode } from './encoder';

export interface SplitOptions {
  maxTokens: number;
  overlap?: number; // Number of items to overlap
  tokenRatio?: number; // Characters per token (default 4)
}

export interface ChunkResult {
  chunks: string[];
  metadata: {
    totalChunks: number;
    totalTokens: number;
    chunkSizes: number[];
  };
}

export class ZonSplitter {
  private maxChars: number;
  private overlap: number;

  constructor(options: SplitOptions) {
    const ratio = options.tokenRatio || 4;
    this.maxChars = options.maxTokens * ratio;
    this.overlap = options.overlap || 0;
  }

  /**
   * Splits a large array of data into ZON-encoded chunks.
   * 
   * @param data - Array of objects to split
   * @returns ChunkResult containing encoded strings and metadata
   */
  split(data: any[]): ChunkResult {
    if (!Array.isArray(data) || data.length === 0) {
      return { chunks: [], metadata: { totalChunks: 0, totalTokens: 0, chunkSizes: [] } };
    }

    const chunks: string[] = [];
    const chunkSizes: number[] = [];
    let currentChunkItems: any[] = [];
    let totalTokens = 0;

    // Helper to estimate tokens (approx 4 chars per token)
    const estimateTokens = (str: string) => Math.ceil(str.length / 4);

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      // Always check encoding to ensure correctness
      const candidateItems = [...currentChunkItems, item];
      const encoded = encode(candidateItems);
      
      if (encoded.length > this.maxChars) {
        if (currentChunkItems.length > 0) {
          const chunkEncoded = encode(currentChunkItems);
          chunks.push(chunkEncoded);
          const tokens = estimateTokens(chunkEncoded);
          chunkSizes.push(tokens);
          totalTokens += tokens;
          
          const overlapItems = this.overlap > 0 ? currentChunkItems.slice(-this.overlap) : [];
          currentChunkItems = [...overlapItems, item];
        } else {
          // Single item too big
          const chunkEncoded = encode([item]);
          chunks.push(chunkEncoded);
          const tokens = estimateTokens(chunkEncoded);
          chunkSizes.push(tokens);
          totalTokens += tokens;
          
          currentChunkItems = [];
        }
      } else {
        currentChunkItems.push(item);
      }
    }

    // Final chunk
    if (currentChunkItems.length > 0) {
      const finalEncoded = encode(currentChunkItems);
      chunks.push(finalEncoded);
      const tokens = estimateTokens(finalEncoded);
      chunkSizes.push(tokens);
      totalTokens += tokens;
    }

    return {
      chunks,
      metadata: {
        totalChunks: chunks.length,
        totalTokens,
        chunkSizes
      }
    };
  }
}
