/**
 * Built-in Metrics for ZON LLM Evaluation
 */

import type { Metric, MetricContext } from './types';
import { decode } from '../core/decoder';
import { validate } from '../schema/schema';

/**
 * Exact match metric - checks if answer exactly matches expected
 */
export const exactMatch: Metric = {
  name: 'exactMatch',
  description: 'Percentage of questions answered exactly correctly',
  compute: (expected: any, actual: any, context?: MetricContext): number => {

    const normalizedExpected = JSON.stringify(expected);
    const normalizedActual = JSON.stringify(actual);
    
    return normalizedExpected === normalizedActual ? 1.0 : 0.0;
  },
  higherIsBetter: true
};

/**
 * Token efficiency metric - accuracy per 1000 tokens
 */
export const tokenEfficiency: Metric = {
  name: 'tokenEfficiency',
  description: 'Accuracy percentage per 1000 tokens used',
  compute: (expected: any, actual: any, context?: MetricContext): number => {
    const isCorrect = JSON.stringify(expected) === JSON.stringify(actual);
    const accuracy = isCorrect ? 1.0 : 0.0;
    const tokens = context?.tokens || 1;
    

    return (accuracy / tokens) * 1000;
  },
  higherIsBetter: true
};

/**
 * Structural validity metric - checks if output matches schema
 */
export const structuralValidity: Metric = {
  name: 'structuralValidity',
  description: 'Percentage of responses that match the expected schema',
  compute: (expected: any, actual: any, context?: MetricContext): number => {
    if (!context?.schema) {

      return 1.0;
    }
    
    try {
      const validation = validate(actual, context.schema);
      return validation.success ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  },
  higherIsBetter: true
};

/**
 * Format correctness metric - checks if output is valid ZON
 */
export const formatCorrectness: Metric = {
  name: 'formatCorrectness',
  description: 'Percentage of responses that parse as valid ZON',
  compute: (expected: any, actual: any, context?: MetricContext): number => {
    if (typeof actual !== 'string') {

      return 1.0;
    }
    
    try {
      decode(actual);
      return 1.0;
    } catch {
      return 0.0;
    }
  },
  higherIsBetter: true
};

/**
 * Partial match metric - scores based on field-level correctness
 */
export const partialMatch: Metric = {
  name: 'partialMatch',
  description: 'Percentage of fields that match between expected and actual',
  compute: (expected: any, actual: any, context?: MetricContext): number => {
    if (typeof expected !== 'object' || typeof actual !== 'object') {
      return expected === actual ? 1.0 : 0.0;
    }
    
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.length === 0) return 1.0;
    
    let matchCount = 0;
    for (const key of expectedKeys) {
      if (key in actual && JSON.stringify(expected[key]) === JSON.stringify(actual[key])) {
        matchCount++;
      }
    }
    
    return matchCount / expectedKeys.length;
  },
  higherIsBetter: true
};

/**
 * Hallucination detection metric (placeholder for LLM-as-judge)
 * 
 * Note: This is a simplified version. In production, this would call
 * another LLM to judge if the answer contains hallucinations.
 */
export const hallucination: Metric = {
  name: 'hallucination',
  description: 'Score indicating likelihood of hallucination (0 = no hallucination, 1 = definite hallucination)',
  compute: async (expected: any, actual: any, context?: MetricContext): Promise<number> => {
    // Placeholder implementation

    

    if (!context?.sourceData) return 0.0;
    
    const sourceStr = JSON.stringify(context.sourceData).toLowerCase();
    const actualStr = JSON.stringify(actual).toLowerCase();
    

    const containsSourceData = sourceStr.includes(actualStr.substring(0, Math.min(50, actualStr.length)));
    
    return containsSourceData ? 0.0 : 0.3;
  },
  higherIsBetter: false
};

/**
 * Latency metric - measures response time
 */
export const latency: Metric = {
  name: 'latency',
  description: 'Average response time in milliseconds',
  compute: (expected: any, actual: any, context?: MetricContext): number => {
    return context?.latencyMs || 0;
  },
  higherIsBetter: false
};

/**
 * All built-in metrics
 */
export const BUILTIN_METRICS: Record<string, Metric> = {
  exactMatch,
  tokenEfficiency,
  structuralValidity,
  formatCorrectness,
  partialMatch,
  hallucination,
  latency
};

/**
 * Register all built-in metrics with an evaluator
 */
export function registerBuiltinMetrics(evaluator: any): void {
  for (const [name, metric] of Object.entries(BUILTIN_METRICS)) {
    evaluator.registerMetric(name, metric);
  }
}
