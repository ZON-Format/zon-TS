import { TokenCounter } from './token-counter';
import { ZonEncoder } from './encoder';

export class LLMOptimizer {
  private tokenizer: TokenCounter;

  constructor() {
    this.tokenizer = new TokenCounter();
  }

  /**
   * Optimizes the order of fields in an array of objects to minimize token usage.
   * 
   * @param data - Array of objects to optimize
   * @returns Data with optimized field order
   */
  optimizeFieldOrder(data: any[]): any[] {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    const sample = data[0];
    if (typeof sample !== 'object' || sample === null) {
      return data;
    }

    const fields = Object.keys(sample);
    if (fields.length <= 1) {
      return data;
    }

    const encoder = new ZonEncoder();
    
    // Generate candidate orderings
    const orderings = this._generateOrderings(fields);
    
    let bestOrdering = fields;
    let minTokens = Infinity;

    // Test each ordering on a subset of data (to be fast)
    const testData = data.slice(0, Math.min(data.length, 5));

    for (const ordering of orderings) {
      const reordered = this._reorderData(testData, ordering);
      const encoded = encoder.encode(reordered);
      const tokens = this.tokenizer.count(encoded);

      if (tokens < minTokens) {
        minTokens = tokens;
        bestOrdering = ordering;
      }
    }

    // Return full data reordered with the best ordering
    return this._reorderData(data, bestOrdering);
  }

  private _reorderData(data: any[], ordering: string[]): any[] {
    return data.map(row => {
      const newRow: any = {};
      for (const field of ordering) {
        if (field in row) {
          newRow[field] = row[field];
        }
      }
      // Keep any fields not in ordering (shouldn't happen if derived from keys)
      for (const key of Object.keys(row)) {
        if (!ordering.includes(key)) {
          newRow[key] = row[key];
        }
      }
      return newRow;
    });
  }

  private _generateOrderings(fields: string[]): string[][] {
    const orderings: string[][] = [];

    // 1. Original order
    orderings.push([...fields]);

    // 2. Alphabetical
    orderings.push([...fields].sort());

    // 3. Length (Shortest keys first) - often better for tokenization
    orderings.push([...fields].sort((a, b) => a.length - b.length));

    // 4. Length (Longest keys first)
    orderings.push([...fields].sort((a, b) => b.length - a.length));

    return orderings;
  }
}
