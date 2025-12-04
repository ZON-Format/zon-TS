/**
 * Data Complexity Analyzer for Adaptive Encoding
 * 
 * Analyzes data structures to determine optimal encoding strategies.
 */

export interface ComplexityMetrics {
  /** Maximum nesting depth in the data structure */
  nesting: number;
  
  /** Irregularity score (0.0 = uniform, 1.0 = highly irregular) */
  irregularity: number;
  
  /** Total number of unique fields across all objects */
  fieldCount: number;
  
  /** Size of largest array in the structure */
  arraySize: number;
  
  /** Proportion of arrays vs objects */
  arrayDensity: number;
  
  /** Average fields per object */
  avgFieldsPerObject: number;
}

export interface AnalysisResult extends ComplexityMetrics {
  /** Recommended encoding strategy */
  recommendation: 'table' | 'inline' | 'json' | 'mixed';
  
  /** Confidence in recommendation (0.0-1.0) */
  confidence: number;
  
  /** Reasoning for the recommendation */
  reason: string;
}

/**
 * Analyzes data complexity to guide encoding decisions.
 */
export class DataComplexityAnalyzer {
  /**
   * Analyzes a data structure and returns complexity metrics.
   * 
   * @param data - Data to analyze
   * @returns Complexity metrics and encoding recommendation
   */
  analyze(data: any): AnalysisResult {
    const metrics = this.calculateMetrics(data);
    const recommendation = this.getRecommendation(metrics);
    
    return {
      ...metrics,
      ...recommendation
    };
  }
  
  /**
   * Calculates complexity metrics for data.
   */
  private calculateMetrics(data: any): ComplexityMetrics {
    const stats = {
      maxNesting: 0,
      allKeys: new Set<string>(),
      keySets: [] as Set<string>[],
      largestArray: 0,
      arrayCount: 0,
      objectCount: 0,
      fieldCounts: [] as number[]
    };
    

    this.traverse(data, 1, stats);
    

    const irregularity = this.calculateIrregularity(stats.keySets);
    

    const total = stats.arrayCount + stats.objectCount;
    const arrayDensity = total > 0 ? stats.arrayCount / total : 0;
    

    const avgFieldsPerObject = stats.fieldCounts.length > 0
      ? stats.fieldCounts.reduce((a, b) => a + b, 0) / stats.fieldCounts.length
      : 0;
    
    return {
      nesting: stats.maxNesting,
      irregularity,
      fieldCount: stats.allKeys.size,
      arraySize: stats.largestArray,
      arrayDensity,
      avgFieldsPerObject
    };
  }
  
  /**
   * Traverses data structure to collect statistics.
   */
  private traverse(data: any, depth: number, stats: any): void {

    if (typeof data === 'object' && data !== null) {
      stats.maxNesting = Math.max(stats.maxNesting, depth);
    }
    
    if (Array.isArray(data)) {
      stats.arrayCount++;
      stats.largestArray = Math.max(stats.largestArray, data.length);
      
      for (const item of data) {
        this.traverse(item, depth + 1, stats);
      }
    } else if (typeof data === 'object' && data !== null) {
      stats.objectCount++;
      
      const keys = new Set(Object.keys(data));
      stats.keySets.push(keys);
      stats.fieldCounts.push(keys.size);
      
      keys.forEach(k => stats.allKeys.add(k));
      
      for (const value of Object.values(data)) {
        this.traverse(value, depth + 1, stats);
      }
    }
  }
  
  /**
   * Calculates schema irregularity score.
   * Higher score = more variation in object shapes.
   */
  private calculateIrregularity(keySets: Set<string>[]): number {
    if (keySets.length <= 1) return 0;
    
    let totalOverlap = 0;
    let comparisons = 0;
    
    for (let i = 0; i < keySets.length; i++) {
      for (let j = i + 1; j < keySets.length; j++) {
        const keys1 = keySets[i];
        const keys2 = keySets[j];
        
        let shared = 0;
        keys1.forEach(k => {
          if (keys2.has(k)) shared++;
        });
        
        const union = keys1.size + keys2.size - shared;
        const similarity = union > 0 ? shared / union : 1;
        
        totalOverlap += similarity;
        comparisons++;
      }
    }
    
    if (comparisons === 0) return 0;
    
    const avgSimilarity = totalOverlap / comparisons;
    return 1 - avgSimilarity;
  }
  
  /**
   * Determines encoding recommendation based on metrics.
   */
  private getRecommendation(metrics: ComplexityMetrics): {
    recommendation: 'table' | 'inline' | 'json' | 'mixed';
    confidence: number;
    reason: string;
  } {

   if (metrics.nesting > 4) {
      return {
        recommendation: 'inline',
        confidence: 0.9,
        reason: `Deep nesting (${metrics.nesting} levels) favors inline format for readability`
      };
    }
    

    if (metrics.irregularity > 0.7) {
      return {
        recommendation: 'json',
        confidence: 0.85,
        reason: `High irregularity (${(metrics.irregularity * 100).toFixed(0)}%) makes table format inefficient`
      };
    }
    

    if (metrics.arraySize >= 3 && metrics.irregularity < 0.3) {
      return {
        recommendation: 'table',
        confidence: 0.95,
        reason: `Large uniform array (${metrics.arraySize} items, ${(metrics.irregularity * 100).toFixed(0)}% irregularity) is ideal for table format`
      };
    }
    

    if (metrics.nesting > 2 && metrics.arrayDensity > 0.3) {
      return {
        recommendation: 'mixed',
        confidence: 0.7,
        reason: 'Mixed structure with nested arrays benefits from hybrid approach'
      };
    }
    

    return {
      recommendation: 'table',
      confidence: 0.6,
      reason: 'Standard structure suitable for table format'
    };
  }
  
  /**
   * Checks if data is suitable for table encoding.
   */
  isSuitableForTable(data: any): boolean {
    const analysis = this.analyze(data);
    return analysis.recommendation === 'table' && analysis.confidence > 0.7;
  }
  
  /**
   * Gets optimal complexity threshold for mode selection.
   */
  getComplexityThreshold(mode: 'aggressive' | 'balanced' | 'conservative'): number {
    switch (mode) {
      case 'aggressive':
        return 0.8;  // Only switch away from table for very irregular data
      case 'conservative':
        return 0.4;  // More readily use inline/json formats
      case 'balanced':
      default:
        return 0.6;
    }
  }
}

/**
 * Global analyzer instance.
 */
export const globalAnalyzer = new DataComplexityAnalyzer();
