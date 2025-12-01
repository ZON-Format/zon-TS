export class TokenCounter {
  /**
   * Estimates the number of tokens in a string.
   * Uses a simple heuristic: ~4 characters per token.
   * 
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  count(text: string): number {
    if (!text) return 0;
    
    // Simple heuristic: 1 token ~= 4 chars
    // This is a rough approximation for English text in BPE tokenizers (GPT, Llama)
    // For code/data, it might be slightly different, but good for relative comparison.
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimates tokens for a specific model (placeholder for future expansion).
   * 
   * @param text - Text to count
   * @param model - Model identifier
   * @returns Estimated token count
   */
  countForModel(text: string, model: string): number {
    // In the future, we could add model-specific heuristics
    // e.g. Claude might be slightly different than GPT-4
    return this.count(text);
  }
}
