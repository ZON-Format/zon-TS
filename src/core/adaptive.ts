/**
 * Adaptive Encoding API
 * 
 * Provides intelligent format selection based on data characteristics.
 */

import { encode, ZonEncoder, type EncodeOptions } from './encoder';
import { DataComplexityAnalyzer, type ComplexityMetrics } from './analyzer';
import { TABLE_MARKER } from './constants';
import { expandPrint } from '../tools/printer';


export { DataComplexityAnalyzer, type ComplexityMetrics, type AnalysisResult } from './analyzer';

export type EncodingMode = 'compact' | 'readable' | 'llm-optimized';

export interface AdaptiveEncodeOptions extends EncodeOptions {
  /** Encoding mode (default: 'compact') */
  mode?: EncodingMode;
  
  /** Complexity threshold for auto mode (0.0-1.0, default: 0.6) */
  complexityThreshold?: number;
  
  /** Maximum nesting depth for table format (default: 3) */
  maxNestingForTable?: number;
  
  /** Force specific encoding for paths */
  forceFormatPaths?: Record<string, 'table' | 'inline' | 'json'>;
  
  /** Encoding hints */
  hints?: {
    /** Target audience for the output */
    targetAudience?: 'llm' | 'human' | 'machine';
    /** Optimization priority */
    prioritize?: 'size' | 'readability' | 'speed';
  };
  
  /** Indentation size for readable mode (default: 2) */
  indent?: number;
  
  /** Enable detailed analysis logging */
  debug?: boolean;
}

export interface AdaptiveEncodeResult {
  /** Encoded ZON string */
  output: string;
  
  /** Complexity metrics */
  metrics: ComplexityMetrics;
  
  /** Mode that was used */
  modeUsed: EncodingMode;
  
  /** Reasons for encoding decisions */
  decisions: string[];
}

/**
 * Adaptive encoder that selects optimal encoding strategy.
 */
export class AdaptiveEncoder {
  private analyzer: DataComplexityAnalyzer;
  
  constructor() {
    this.analyzer = new DataComplexityAnalyzer();
  }
  
  /**
   * Encodes data using adaptive strategy selection.
   * 
   * @param data - Data to encode
   * @param options - Adaptive encoding options
   * @returns Encoded string or detailed result if debug=true
   */
  encode(data: any, options?: AdaptiveEncodeOptions): string | AdaptiveEncodeResult {
    const mode = options?.mode || 'compact';
    const decisions: string[] = [];
    

    const analysis = this.analyzer.analyze(data);
    const metrics = analysis;
    
    decisions.push(`Analyzed data: ${analysis.reason}`);
    
    let encodeOptions: EncodeOptions;
    let modeUsed: EncodingMode = mode;
    
    switch (mode) {
      case 'compact':
        encodeOptions = this.getCompactOptions(decisions);
        break;
        
      case 'readable':
        encodeOptions = this.getReadableOptions(decisions);
        break;
        
      case 'llm-optimized':
        encodeOptions = this.getLLMOptimizedOptions(analysis, decisions);
        break;
    }
    
    // Merge with user options
    encodeOptions = { ...encodeOptions, ...options };
    
    let output = encode(data, encodeOptions);

    // Apply formatting for readable mode
    // Only expand if it's NOT a table (tables are already readable/compact)
    if (modeUsed === 'readable' && !output.startsWith(TABLE_MARKER)) {
      output = expandPrint(output, options?.indent);
    }
    
    if (options?.debug) {
      return {
        output,
        metrics,
        modeUsed,
        decisions
      };
    }
    
    return output;
  }
  
  /**
   * Selects encoding options for auto mode.
   */
  private selectAutoOptions(
    analysis: any,
    options: AdaptiveEncodeOptions | undefined,
    decisions: string[]
  ): EncodeOptions {
    const threshold = options?.complexityThreshold || 0.6;
    const maxNesting = options?.maxNestingForTable || 3;
    
    // Deep nesting → disable table format
    if (analysis.nesting > maxNesting) {
      decisions.push(`Deep nesting (${analysis.nesting}) → inline format preferred`);
      return {
        enableDictCompression: false,  // Inline format doesn't use dict compression
      };
    }
    
    // High irregularity → use basic encoding
    if (analysis.irregularity > threshold) {
      decisions.push(`High irregularity (${(analysis.irregularity * 100).toFixed(0)}%) → basic encoding`);
      return {
        enableDictCompression: false,
        enableTypeCoercion: false
      };
    }
    
    // Uniform data → enable all optimizations
    decisions.push('Uniform data → table format with optimizations');
    return {
      enableDictCompression: true,
      enableTypeCoercion: true
    };
  }
  
  /**
   * Gets encoding options for compact mode.
   */
  private getCompactOptions(decisions: string[]): EncodeOptions {
    decisions.push('Compact mode: maximum compression enabled');
    return {
      enableDictCompression: true,
      enableTypeCoercion: false      // Use T/F for max compression
    };
  }
  
  /**
   * Gets encoding options for readable mode.
   * Tables are enabled for uniform data, but dictionary compression and delta encoding are disabled.
   */
  private getReadableOptions(decisions: string[]): EncodeOptions {
    decisions.push('Readable mode: optimizing for human readability with tables for uniform data');
    return {
      enableDictCompression: false,   // Disable dictionary compression for readability
      enableTypeCoercion: false,      // No type transformations
      disableTables: false            // Enable tables for uniform data patterns
    };
  }
  
  /**
   * Gets encoding options for LLM-optimized mode.
   * Dictionary compression and delta encoding disabled for clarity - shows actual values not indices.
   */
  private getLLMOptimizedOptions(analysis: any, decisions: string[]): EncodeOptions {
    decisions.push('LLM-optimized mode: balancing tokens and clarity');
    
    // For LLMs, prioritize clarity over compression
    // Dictionary compression (showing indices like "0" instead of "Engineering") 
    // and delta encoding (+1) reduce readability and make data harder for LLMs
    return {
      enableDictCompression: false,   // Show actual values, not dictionary indices
      enableTypeCoercion: true        // Use true/false for LLM clarity
    };
  }
  
  /**
   * Determines effective mode based on analysis.
   */
  private determineEffectiveMode(analysis: any): EncodingMode {
    if (analysis.recommendation === 'json' || analysis.nesting > 4) {
      return 'llm-optimized'; // Use safe standard encoding instead of readable (YAML-like)
    } else if (analysis.recommendation === 'table' && analysis.confidence > 0.8) {
      return 'compact';
    }
    return 'llm-optimized';
  }
}

/**
 * Global adaptive encoder instance.
 */
const globalAdaptiveEncoder = new AdaptiveEncoder();

/**
 * Encodes data with adaptive strategy selection.
 * 
 * @param data - Data to encode
 * @param options - Adaptive encoding options
 * @returns Encoded ZON string
 * 
 * @example
 * ```typescript
 * // Auto mode - analyzes and selects best strategy
 * const output = encodeAdaptive(data);
 * 
 * // Explicit mode
 * const output = encodeAdaptive(data, { mode: 'compact' });
 * 
 * // With debugging
 * const result = encodeAdaptive(data, { debug: true });
 * console.log(result.decisions);  // See encoding decisions
 * ```
 */
export function encodeAdaptive(
  data: any,
  options?: AdaptiveEncodeOptions
): string | AdaptiveEncodeResult {
  return globalAdaptiveEncoder.encode(data, options);
}

/**
 * Analyzes data and recommends optimal encoding mode.
 * 
 * @param data - Data to analyze
 * @returns Recommended mode and reasoning
 */
export function recommendMode(data: any): {
  mode: EncodingMode;
  reason: string;
  confidence: number;
} {
  const analyzer = new DataComplexityAnalyzer();
  const analysis = analyzer.analyze(data);
  
  if (analysis.irregularity > 0.7) {
    return {
      mode: 'llm-optimized', // Fallback to LLM-optimized (standard ZON) for safety
      reason: 'Highly irregular data benefits from standard structure',
      confidence: 0.9
    };
  } else if (analysis.recommendation === 'table' && analysis.confidence > 0.5) {
    // Lowered from 0.8 to 0.5 to better match uniform data detection
    return {
      mode: 'compact',
      reason: 'Uniform tabular data allows maximum compression',
      confidence: analysis.confidence
    };
  } else {
    return {
      mode: 'llm-optimized',
      reason: 'Balanced approach for mixed or moderate complexity data',
      confidence: 0.75
    };
  }
}
