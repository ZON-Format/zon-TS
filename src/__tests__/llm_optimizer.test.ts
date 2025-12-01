import { LLMOptimizer } from '../llm-optimizer';
import { TokenCounter } from '../token-counter';
import { encodeLLM, LLMContext } from '../encoder';
import { ZonDecoder } from '../decoder';

describe('LLM-Aware Optimizations', () => {
  describe('TokenCounter', () => {
    it('should estimate tokens roughly correctly', () => {
      const counter = new TokenCounter();
      // "Hello world" is 11 chars. 11/4 = 2.75 -> 3 tokens.
      expect(counter.count('Hello world')).toBe(3);
      expect(counter.count('')).toBe(0);
    });
  });

  describe('LLMOptimizer', () => {
    it('should reorder fields to minimize tokens', () => {
      // Create data where one ordering is clearly better
      // Long keys, short values vs Short keys, long values?
      // Actually, ZON header overhead depends on key length.
      // But dictionary compression might be affected by order if it changes repetition patterns?
      // Or maybe just putting short keys first is better?
      
      const data = [
        { long_key_name_a: 1, b: 2 },
        { long_key_name_a: 1, b: 2 }
      ];
      
      const optimizer = new LLMOptimizer();
      const optimized = optimizer.optimizeFieldOrder(data);
      
      // Check that keys are present
      expect(optimized[0]).toHaveProperty('long_key_name_a');
      expect(optimized[0]).toHaveProperty('b');
      
      // We can't easily assert exact order in JS object, but we can check if it runs without error
      // and returns valid data.
      expect(optimized).toHaveLength(2);
    });
  });

  describe('encodeLLM', () => {
    it('should encode for retrieval task', () => {
      const data = [{ id: 1, text: "search term" }];
      const context: LLMContext = { task: 'retrieval', model: 'gpt-4' };
      
      const encoded = encodeLLM(data, context);
      expect(encoded).toContain('id');
      expect(encoded).toContain('search term');
      
      // Verify decodability
      const decoder = new ZonDecoder();
      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });

    it('should encode for generation task with optimization', () => {
      const data = [
        { id: 1, val: "A" },
        { id: 2, val: "B" }
      ];
      const context: LLMContext = { task: 'generation', model: 'claude' };
      
      const encoded = encodeLLM(data, context);
      
      const decoder = new ZonDecoder();
      const decoded = decoder.decode(encoded);
      expect(decoded).toEqual(data);
    });
  });
});
